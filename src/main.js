// SPDX-License-Identifier: GPL-3.0-or-later
// Feuillet — éditeur Markdown pour Windows 11. Copyright (C) 2026 les contributeurs de Feuillet.

// Feuillet — interface (WebView2) d'une application Tauri.
// Le Rust s'occupe des fichiers et du rendu Markdown → HTML (nettoyé) ;
// ici on gère l'interface : modes lecture / édition, sommaire, recherche, etc.

import { invoke, convertFileSrc } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { getCurrentWebview } from '@tauri-apps/api/webview';
import { open as openDialog, save as saveDialog } from '@tauri-apps/plugin-dialog';
import hljs from 'highlight.js/lib/common';
import mdLight from 'github-markdown-css/github-markdown-light.css?raw';
import mdDark from 'github-markdown-css/github-markdown-dark.css?raw';
import codeLight from 'highlight.js/styles/github.css?raw';
import codeDark from 'highlight.js/styles/github-dark.css?raw';
import { createEditor } from './editor.js';
import { applyFormat } from './format.js';
import { Finder } from './find.js';
import { paginate, clearPages, fitSheet, currentPage } from './pages.js';
import { t, setLanguage, getLanguage, formatNumber } from './i18n.js';

const APP = 'Feuillet';
const MD_EXTENSIONS = ['md', 'markdown', 'mdown', 'mkd', 'mkdn', 'mdx', 'txt'];
const MAX_RECENTS = 12;

const appWindow = getCurrentWindow();
const webview = getCurrentWebview();
// Éléments de l'interface, repérés une fois au démarrage : un id présent dans le
// document affiché ne peut ainsi jamais être confondu avec un élément de l'interface.
const UI = new Map([...document.querySelectorAll('[id]')].map((n) => [n.id, n]));
const $ = (id) => UI.get(id);
const ID_PREFIX = 'user-content-';
const MAX_HISTORY = 50;

const el = {
  workspace: $('workspace'),
  welcome: $('welcome'),
  editorPane: $('editor-pane'),
  previewPane: $('preview-pane'),
  preview: $('preview'),
  toc: $('toc'),
  tocList: $('toc-list'),
  formatbar: $('formatbar'),
  findbar: $('findbar'),
  findInput: $('find-input'),
  findCount: $('find-count'),
  save: $('btn-save'),
  back: $('btn-back'),
};

// ---------------------------------------------------------------------------
// Réglages (mémorisés dans le profil WebView2 de l'application)
// ---------------------------------------------------------------------------

const settings = Object.assign(
  {
    dark: matchMedia('(prefers-color-scheme: dark)').matches,
    zoom: 1,
    toc: true,
    autoReload: true,
    pageMode: true,
    // Un retour à la ligne dans le fichier = un retour à la ligne à l'affichage
    // (le Markdown pur demande une ligne vide ou deux espaces en fin de ligne).
    hardBreaks: true,
    lang: 'auto', // « auto » = langue de Windows
    recent: [],
  },
  readSettings(),
);

function readSettings() {
  let raw;
  try {
    raw = JSON.parse(localStorage.getItem('settings') || '{}');
  } catch {
    return {};
  }
  if (!raw || typeof raw !== 'object') return {};
  const out = {};
  for (const key of ['dark', 'toc', 'autoReload', 'pageMode', 'hardBreaks']) {
    if (typeof raw[key] === 'boolean') out[key] = raw[key];
  }
  if (Number.isFinite(raw.zoom)) out.zoom = raw.zoom;
  if (['auto', 'fr', 'en'].includes(raw.lang)) out.lang = raw.lang;
  if (Array.isArray(raw.recent)) out.recent = raw.recent.filter((p) => typeof p === 'string' && p).slice(0, MAX_RECENTS);
  return out;
}

function saveSettings() {
  try {
    localStorage.setItem('settings', JSON.stringify(settings));
  } catch {
    /* stockage indisponible : tant pis, rien de grave */
  }
}

// ---------------------------------------------------------------------------
// État du document
// ---------------------------------------------------------------------------

/** @type {{path: string|null, text: string, saved: string, crlf: boolean, encoding: string, bom: boolean, mtime: number|null} | null} */
let doc = null;
let mode = 'read';
let editor = null;
const history = [];
let headings = [];
let sourceBlocks = [];
let renderTimer = 0;
let renderSeq = 0;
let finder;
let syncFromEditor = false;
let pageInfo = { pages: 0, breaks: [] };
let pageScale = 1;
let printLight = false;

const fileName = (p) => (p ? p.split(/[\\/]/).pop() : t('untitled'));
const dirName = (p) => (p ? p.replace(/[\\/][^\\/]*$/, '') : null);
const currentText = () => (editor && doc ? editor.text() : doc?.text ?? '');
const isDirty = () => !!doc && currentText() !== doc.saved;

// ---------------------------------------------------------------------------
// Thème, accent, zoom
// ---------------------------------------------------------------------------

/** Couleurs du document (aperçu) et de l'interface. */
function applyDocTheme(dark) {
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  $('theme-markdown').textContent = dark ? mdDark : mdLight;
  $('theme-code').textContent = dark ? codeDark : codeLight;
}

function applyTheme() {
  const dark = settings.dark;
  applyDocTheme(dark);
  $('btn-theme').querySelector('i').innerHTML = dark ? '&#xE706;' : '&#xE708;';
  $('btn-theme').title = t(dark ? 'theme.toLight' : 'theme.toDark');
  // Barre de titre et Mica de Windows assortis au thème choisi.
  appWindow.setTheme(dark ? 'dark' : 'light').catch(() => {});
  editor?.setDark(dark);
}

function toggleTheme() {
  settings.dark = !settings.dark;
  saveSettings();
  applyTheme();
}

async function applyAccent() {
  try {
    const accent = await invoke('accent_color');
    if (accent) document.documentElement.style.setProperty('--accent-base', accent);
  } catch {
    /* couleur par défaut */
  }
}

function setZoom(z) {
  settings.zoom = Math.round(Math.min(3, Math.max(0.5, z)) * 10) / 10;
  saveSettings();
  webview.setZoom(settings.zoom).catch(() => {});
  $('btn-zoom-reset').textContent = `${Math.round(settings.zoom * 100)} %`;
}

// ---------------------------------------------------------------------------
// Ouvrir, créer, enregistrer
// ---------------------------------------------------------------------------

/** Effectue `action` après avoir proposé d'enregistrer les modifications en cours. */
async function guard(action) {
  if (dialogResolve) return false; // une question est déjà posée
  if (isDirty()) {
    const choice = await askSave();
    if (choice === 'cancel') return false;
    if (choice === 'save' && !(await save())) return false;
  }
  await action();
  return true;
}

async function openPath(path, fragment = null, remember = true) {
  try {
    const file = await invoke('read_file', { path });
    if (remember && doc?.path && doc.path !== file.path) pushHistory(doc.path);
    loadDocument({ path: file.path, text: file.content, saved: file.content, crlf: file.crlf, encoding: file.encoding, bom: file.bom, mtime: file.mtime });
    addRecent(file.path);
    await renderNow();
    if (fragment) scrollToAnchor(fragment);
    else el.previewPane.scrollTop = 0;
  } catch (e) {
    notify(String(e), true);
    settings.recent = settings.recent.filter((p) => p !== path);
    saveSettings();
    renderRecents();
  }
}

function loadDocument(d) {
  doc = d;
  editor?.load(d.text);
  if (mode !== 'read') ensureEditor();
  finder?.clear();
  updateChrome();
}

async function newDocument() {
  if (doc?.path) pushHistory(doc.path);
  loadDocument({ path: null, text: '', saved: '', crlf: true, encoding: 'utf8', bom: false, mtime: null });
  setMode('split');
  await renderNow();
  editor.focus();
}

async function pickAndOpen() {
  const path = await openDialog({
    title: t('dlg.open'),
    multiple: false,
    directory: false,
    defaultPath: dirName(doc?.path) ?? undefined,
    filters: [
      { name: 'Markdown', extensions: MD_EXTENSIONS },
      { name: t('filter.all'), extensions: ['*'] },
    ],
  });
  if (path) await openPath(path);
}

async function save() {
  if (!doc) return false;
  if (!doc.path) return saveAs();
  return writeTo(doc.path);
}

async function saveAs() {
  if (!doc) return false;
  const dir = dirName(doc.path);
  const path = await saveDialog({
    title: t('dlg.saveas'),
    defaultPath: dir ? `${dir}\\${fileName(doc.path)}` : fileName(doc.path),
    filters: [{ name: 'Markdown', extensions: ['md'] }, { name: t('filter.all'), extensions: ['*'] }],
  });
  if (!path) return false;
  return writeTo(path);
}

async function writeTo(path) {
  const text = currentText();
  try {
    const saved = await invoke('save_file', { path, content: text, crlf: doc.crlf, encoding: doc.encoding, bom: doc.bom });
    const converted = saved.encoding !== doc.encoding;
    Object.assign(doc, { path: saved.path, mtime: saved.mtime, saved: text, text, encoding: saved.encoding, bom: saved.bom });
    addRecent(saved.path);
    notify(t(converted ? 'msg.savedUtf8' : 'msg.saved'));
    updateChrome();
    return true;
  } catch (e) {
    notify(String(e), true);
    return false;
  }
}

async function reload(fromDisk = true) {
  if (!doc?.path) return;
  try {
    const file = await invoke('read_file', { path: doc.path });
    Object.assign(doc, { text: file.content, saved: file.content, crlf: file.crlf, encoding: file.encoding, bom: file.bom, mtime: file.mtime });
    if (editor && editor.text() !== file.content) editor.replace(file.content);
    await renderNow();
    updateChrome();
    if (fromDisk) notify(t('msg.reloaded'));
  } catch (e) {
    notify(String(e), true);
  }
}

async function goBack() {
  const prev = history.pop();
  if (prev) await openPath(prev, null, false);
}

function pushHistory(path) {
  history.push(path);
  if (history.length > MAX_HISTORY) history.shift();
}

function addRecent(path) {
  settings.recent = [path, ...settings.recent.filter((p) => p.toLowerCase() !== path.toLowerCase())].slice(0, MAX_RECENTS);
  saveSettings();
  renderRecents();
}

// Vérifie régulièrement si le fichier a été modifié par un autre programme.
let watching = false;
setInterval(async () => {
  if (watching || !settings.autoReload || !doc?.path || document.hidden || dialogResolve) return;
  watching = true;
  try {
    const watched = doc;
    const mtime = await invoke('file_mtime', { path: watched.path }).catch(() => null);
    if (!mtime || mtime === watched.mtime || watched !== doc) return;
    if (isDirty()) {
      // On n'écrase pas les modifications en cours : on prévient seulement.
      doc.mtime = mtime;
      notify(t('msg.changedOutside'), true);
    } else {
      await reload();
    }
  } finally {
    watching = false;
  }
}, 1000);

// ---------------------------------------------------------------------------
// Rendu de l'aperçu
// ---------------------------------------------------------------------------

function scheduleRender() {
  clearTimeout(renderTimer);
  // Gros document : on attend un peu plus la fin de la frappe avant de tout recalculer.
  const size = editor ? editor.view.state.doc.length : 0;
  renderTimer = setTimeout(renderNow, Math.min(1000, 120 + size / 5000));
}

async function renderNow() {
  clearTimeout(renderTimer);
  if (!doc) return;
  const seq = ++renderSeq;
  const text = currentText();
  let html;
  try {
    html = await invoke('render', { source: text, hardBreaks: settings.hardBreaks });
  } catch (e) {
    if (seq === renderSeq) notify(String(e), true);
    return;
  }
  if (seq !== renderSeq) return; // un rendu plus récent est en route
  const scroll = el.previewPane.scrollTop;
  el.preview.innerHTML = html;
  if (!text.trim()) {
    const hint = document.createElement('p');
    hint.className = 'empty-hint';
    hint.textContent = t('preview.empty');
    el.preview.replaceChildren(hint);
  }
  enhancePreview();
  layoutPages();
  el.previewPane.scrollTop = scroll;
  buildToc();
  updateStats(text);
  if (!el.findbar.hidden && el.findInput.value) updateFind(true);
}

/** Retouches après le rendu : images locales, coloration du code, encadrés en français… */
function enhancePreview() {
  const base = dirName(doc?.path);

  for (const img of el.preview.querySelectorAll('img[src]')) {
    const src = img.getAttribute('src');
    if (/^[a-z][a-z0-9+.-]*:/i.test(src) || src.startsWith('//')) continue;
    const decoded = safeDecode(src).replace(/\//g, '\\');
    const isAbsolute = /^[a-z]:\\|^\\\\/i.test(decoded);
    if (!isAbsolute && !base) continue;
    const abs = isAbsolute ? decoded : `${base}\\${decoded}`;
    img.src = convertFileSrc(abs);
    // En mode pages, toutes les images doivent être chargées pour connaître leur hauteur.
    img.loading = settings.pageMode ? 'eager' : 'lazy';
  }

  for (const code of el.preview.querySelectorAll('pre > code')) {
    const lang = [...code.classList].find((c) => c.startsWith('language-'))?.slice(9);
    if (lang && hljs.getLanguage(lang)) hljs.highlightElement(code);
    const pre = code.parentElement;
    const wrap = document.createElement('div');
    wrap.className = 'code-wrap';
    pre.replaceWith(wrap);
    wrap.append(pre);
    const copy = document.createElement('button');
    copy.className = 'copy';
    copy.title = t('copy');
    copy.innerHTML = '<i>&#xE8C8;</i>';
    copy.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(code.innerText);
      } catch {
        notify(t('msg.copyFailed'), true);
        return;
      }
      copy.classList.add('done');
      copy.innerHTML = '<i>&#xE73E;</i>';
      setTimeout(() => {
        copy.classList.remove('done');
        copy.innerHTML = '<i>&#xE8C8;</i>';
      }, 1500);
    });
    wrap.append(copy);
  }

  // Titres des encadrés > [!NOTE] dans la langue de l'interface (sauf titre personnalisé).
  const kinds = ['note', 'tip', 'important', 'warning', 'caution'];
  for (const alert of el.preview.querySelectorAll('.markdown-alert')) {
    const kind = [...alert.classList].find((c) => c.startsWith('markdown-alert-'))?.slice(15);
    const title = alert.querySelector('.markdown-alert-title');
    if (title && kinds.includes(kind) && title.textContent.trim().toLowerCase() === kind) title.textContent = t(`alert.${kind}`);
  }

  // Blocs avec leur ligne d'origine, pour suivre l'éditeur en mode côte à côte.
  sourceBlocks = [...el.preview.querySelectorAll('[data-sourcepos]')]
    .map((node) => ({ node, line: parseInt(node.dataset.sourcepos, 10) }))
    .filter((b) => b.line > 0)
    .sort((a, b) => a.line - b.line);
}

function safeDecode(s) {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

function updateStats(text) {
  const words = (text.match(/\S+/g) || []).length;
  const lines = text ? text.split('\n').length : 0;
  const bytes = new TextEncoder().encode(text).length;
  const size = bytes < 1024
    ? `${formatNumber(bytes)} ${t('unit.b')}`
    : bytes < 1048576 ? `${formatNumber(+(bytes / 1024).toFixed(1))} ${t('unit.kb')}` : `${formatNumber(+(bytes / 1048576).toFixed(1))} ${t('unit.mb')}`;
  $('st-stats').textContent = t('status.stats', { words: formatNumber(words), lines: formatNumber(lines), size });
}

// ---------------------------------------------------------------------------
// Sommaire
// ---------------------------------------------------------------------------

function buildToc() {
  headings = [...el.preview.querySelectorAll('h1, h2, h3, h4, h5, h6')].map((h) => ({
    node: h,
    level: Number(h.tagName[1]),
    id: h.id,
    line: parseInt(h.dataset.sourcepos ?? '1', 10),
    title: h.textContent.trim(),
  }));
  el.tocList.replaceChildren();
  if (!headings.length) {
    const empty = document.createElement('div');
    empty.className = 'toc-empty';
    empty.textContent = t('toc.empty');
    el.tocList.append(empty);
    return;
  }
  const min = Math.min(...headings.map((h) => h.level));
  for (const h of headings) {
    const item = document.createElement('button');
    const depth = h.level - min;
    item.className = `toc-item l${depth + 1}`;
    item.style.paddingLeft = `${10 + depth * 14}px`;
    item.textContent = h.title;
    item.title = h.title;
    item.addEventListener('click', () => {
      if (mode !== 'edit') h.node.scrollIntoView({ block: 'start', behavior: 'smooth' });
      if (mode !== 'read') editor?.gotoLine(h.line);
    });
    h.item = item;
    el.tocList.append(item);
  }
  updateTocActive();
}

/** Met en évidence, dans le sommaire, la section en cours de lecture. */
function updateTocActive() {
  if (!headings.length || el.previewPane.hidden || mode === 'edit') return;
  const top = el.previewPane.getBoundingClientRect().top + 90;
  let current = headings[0];
  for (const h of headings) {
    if (h.node.getBoundingClientRect().top <= top) current = h;
    else break;
  }
  markTocActive(current);
}

/** Mode édition seul : la section active est celle de la ligne affichée en haut de l'éditeur. */
function updateTocActiveFromLine(line) {
  if (!headings.length) return;
  let current = headings[0];
  for (const h of headings) {
    if (h.line <= line) current = h;
    else break;
  }
  markTocActive(current);
}

function markTocActive(current) {
  for (const h of headings) h.item?.classList.toggle('active', h === current);
}

el.previewPane.addEventListener('scroll', () => {
  if (!syncFromEditor) updateTocActive();
  if (settings.pageMode) updatePageStatus();
}, { passive: true });

// ---------------------------------------------------------------------------
// Mode pages A4
// ---------------------------------------------------------------------------

/** Découpe l'aperçu en pages A4 (ou revient à la feuille continue). */
function layoutPages() {
  const sheet = el.preview.parentElement;
  const on = settings.pageMode && !!doc;
  sheet.classList.toggle('paged', on);
  el.previewPane.classList.toggle('paged', on);
  if (!on) {
    clearPages(sheet, el.preview);
    fitSheet(el.previewPane, sheet, false);
    pageInfo = { pages: 0, breaks: [] };
  } else if (!el.previewPane.hidden) {
    pageInfo = paginate(sheet, el.preview);
    pageScale = fitSheet(el.previewPane, sheet, true);
  }
  editor?.setPageMarks(pageInfo.breaks);
  updatePageStatus();
}

let pageTimer = 0;
function schedulePages() {
  clearTimeout(pageTimer);
  pageTimer = setTimeout(() => {
    const scroll = el.previewPane.scrollTop;
    layoutPages();
    el.previewPane.scrollTop = scroll;
  }, 80);
}

function updatePageStatus() {
  const st = $('st-page');
  if (!settings.pageMode || !doc || !pageInfo.pages) {
    st.textContent = '';
    return;
  }
  const n = pageInfo.pages;
  st.textContent = mode === 'edit'
    ? t(n > 1 ? 'pages.many' : 'pages.one', { n })
    : t('pages.current', { page: currentPage(el.previewPane, el.preview.parentElement, pageScale, n), total: n });
}

function togglePages() {
  settings.pageMode = !settings.pageMode;
  saveSettings();
  setMode(mode);
  renderNow();
}

// Une image qui finit de charger change la hauteur des blocs : on redécoupe.
el.preview.addEventListener('load', (e) => {
  if (settings.pageMode && e.target.tagName === 'IMG') schedulePages();
}, true);

// La page garde sa mise en page ; on la réduit selon la largeur du volet.
new ResizeObserver(() => {
  if (!settings.pageMode || el.previewPane.hidden) return;
  pageScale = fitSheet(el.previewPane, el.preview.parentElement, true);
  updatePageStatus();
}).observe(el.previewPane);

// ---------------------------------------------------------------------------
// Export PDF et impression (toujours en thème clair, sur fond blanc)
// ---------------------------------------------------------------------------

function useLightForPrint() {
  if (!settings.dark || printLight) return;
  printLight = true;
  applyDocTheme(false);
}

function restoreAfterPrint() {
  if (!printLight) return;
  printLight = false;
  applyDocTheme(settings.dark);
}

window.addEventListener('beforeprint', useLightForPrint);
window.addEventListener('afterprint', restoreAfterPrint);

const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r()));

/** Attend que toutes les images du document soient chargées (sinon elles manqueraient dans le PDF). */
async function loadAllImages() {
  const imgs = [...el.preview.querySelectorAll('img')];
  for (const img of imgs) img.loading = 'eager';
  await Promise.all(imgs.map((img) => (img.complete ? null : new Promise((done) => {
    img.addEventListener('load', done, { once: true });
    img.addEventListener('error', done, { once: true });
    setTimeout(done, 5000);
  }))));
}

async function exportPdf() {
  closeFlyouts();
  if (!doc) return;
  const base = fileName(doc.path).replace(/\.[^.]+$/, '') || 'document';
  const dir = dirName(doc.path);
  const path = await saveDialog({
    title: t('dlg.pdf'),
    defaultPath: dir ? `${dir}\\${base}.pdf` : `${base}.pdf`,
    filters: [{ name: t('filter.pdf'), extensions: ['pdf'] }],
  });
  if (!path) return;
  await exportPdfTo(path);
}

async function exportPdfTo(path) {
  notify(t('msg.pdfProgress'));
  try {
    await renderNow();
    await loadAllImages();
    if (settings.pageMode) layoutPages();
    useLightForPrint();
    await nextFrame();
    await nextFrame();
    await invoke('export_pdf', { path });
    notify(t('msg.pdfDone', { name: fileName(path) }));
    return true;
  } catch (e) {
    notify(String(e), true);
    return false;
  } finally {
    restoreAfterPrint();
  }
}

async function printDocument() {
  closeFlyouts();
  if (!doc) return;
  await renderNow();
  await loadAllImages();
  window.print();
}


function scrollToAnchor(id) {
  const name = safeDecode(id);
  const find = (n) => el.preview.querySelector(`[id="${CSS.escape(ID_PREFIX + n)}"]`);
  // Les ancres de GitHub sont en minuscules : « #Ma-Partie » mène aussi à « ma-partie ».
  const target = find(name) ?? find(name.toLowerCase());
  if (target) target.scrollIntoView({ block: 'start', behavior: 'smooth' });
  else if (name) notify(t('msg.anchorMissing', { name }), true);
}

// ---------------------------------------------------------------------------
// Modes : lecture, édition, côte à côte
// ---------------------------------------------------------------------------

function ensureEditor() {
  if (editor) return;
  editor = createEditor($('editor'), {
    dark: settings.dark,
    onChange: () => {
      scheduleRender();
      updateDirty();
    },
    onCursor: (line, col) => {
      $('st-cursor').textContent = `Ln ${line}, Col ${col}`;
    },
    onScroll: (line) => {
      if (mode === 'split') followEditor(line);
      else if (mode === 'edit') updateTocActiveFromLine(line);
    },
    shortcuts: [
      { key: 'Mod-b', run: (v) => applyFormat(v, 'bold') },
      { key: 'Mod-i', run: (v) => applyFormat(v, 'italic') },
      { key: 'Mod-k', run: (v) => applyFormat(v, 'link') },
      { key: 'Mod-`', run: (v) => applyFormat(v, 'code') },
    ],
  });
  editor.load(doc?.text ?? '');
  editor.setPageMarks(pageInfo.breaks);
}

function setMode(next) {
  if (!doc) next = 'read';
  if (next !== 'read') {
    ensureEditor();
  } else if (editor && doc) {
    doc.text = editor.text();
  }
  const leavingEdit = mode === 'edit';
  mode = next;
  el.workspace.className = `mode-${mode}${settings.pageMode ? ' paged' : ''}`;
  for (const b of document.querySelectorAll('#modes button')) {
    b.classList.toggle('active', b.dataset.mode === mode);
    b.setAttribute('aria-selected', String(b.dataset.mode === mode));
  }
  updatePanes();
  if (settings.pageMode) layoutPages();
  else updatePageStatus();
  if (leavingEdit && mode !== 'edit') renderNow();
  if (mode !== 'read') editor.focus();
}

function updatePanes() {
  const hasDoc = !!doc;
  el.welcome.hidden = hasDoc;
  el.editorPane.hidden = !hasDoc || mode === 'read';
  // En mode pages, l'aperçu reste mis en page même en édition seule (invisible) :
  // il sert à placer les repères « Page n » dans l'éditeur.
  el.previewPane.hidden = !hasDoc || (mode === 'edit' && !settings.pageMode);
  el.formatbar.hidden = !hasDoc || mode === 'read';
  el.toc.hidden = !hasDoc || !settings.toc;
  $('btn-toc').classList.toggle('on', settings.toc);
  $('btn-pages').classList.toggle('on', settings.pageMode);
  $('btn-pages').disabled = !hasDoc;
  $('st-cursor').hidden = mode === 'read';
  for (const b of document.querySelectorAll('#modes button')) b.disabled = !hasDoc;
}

/** Côte à côte : l'aperçu suit la ligne affichée en haut de l'éditeur. */
function followEditor(line) {
  if (!sourceBlocks.length) return;
  let lo = 0;
  let hi = sourceBlocks.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (sourceBlocks[mid].line <= line) lo = mid;
    else hi = mid - 1;
  }
  const cur = sourceBlocks[lo];
  const next = sourceBlocks.slice(lo + 1).find((b) => b.line > cur.line);
  const pane = el.previewPane;
  const offset = (node) => node.getBoundingClientRect().top - pane.getBoundingClientRect().top + pane.scrollTop;
  let y = offset(cur.node);
  if (next && line > cur.line) {
    y += (offset(next.node) - y) * Math.min(1, (line - cur.line) / (next.line - cur.line));
  }
  syncFromEditor = true;
  pane.scrollTop = Math.max(0, y - 16);
  requestAnimationFrame(() => {
    syncFromEditor = false;
    updateTocActive();
  });
}

// ---------------------------------------------------------------------------
// Barres, titre, notifications
// ---------------------------------------------------------------------------

function updateChrome() {
  updatePanes();
  updateDirty();
  $('st-path').textContent = doc ? doc.path ?? t('status.new') : t('status.none');
  $('st-path').title = doc?.path ?? '';
  el.back.disabled = history.length === 0;
  if (!doc) {
    $('st-stats').textContent = '';
    $('st-cursor').textContent = '';
  }
}

let lastTitle = '';
function updateDirty() {
  const dirty = isDirty();
  $('st-dirty').hidden = !dirty;
  el.save.disabled = !doc || (!dirty && !!doc.path);
  const title = doc ? `${dirty ? '● ' : ''}${fileName(doc.path)} — ${APP}` : APP;
  if (title !== lastTitle) {
    lastTitle = title;
    document.title = title;
    appWindow.setTitle(title).catch(() => {});
  }
}

let noticeTimer = 0;
function notify(message, warn = false) {
  const n = $('st-notice');
  n.textContent = `${warn ? '⚠' : '✔'} ${message}`;
  n.classList.toggle('warn', warn);
  n.style.opacity = '1';
  clearTimeout(noticeTimer);
  noticeTimer = setTimeout(() => { n.style.opacity = '0'; }, warn ? 6000 : 2500);
}

function renderRecents() {
  const menu = $('recent-menu');
  menu.replaceChildren();
  const list = $('welcome-recent');
  list.replaceChildren();
  if (!settings.recent.length) {
    const empty = document.createElement('div');
    empty.className = 'menu-empty';
    empty.textContent = t('recent.empty');
    menu.append(empty);
    return;
  }
  const heading = document.createElement('h2');
  heading.textContent = t('recent.heading');
  list.append(heading);
  for (const path of settings.recent) {
    for (const target of [menu, list]) {
      const item = document.createElement('button');
      item.className = 'menu-item';
      item.title = path;
      item.innerHTML = '<i>&#xE8A5;</i><span><b></b><small></small></span>';
      item.querySelector('b').textContent = fileName(path);
      item.querySelector('b').style.fontWeight = '400';
      item.querySelector('small').textContent = dirName(path);
      item.addEventListener('click', () => {
        closeFlyouts();
        guard(() => openPath(path));
      });
      target.append(item);
    }
  }
  const sep = document.createElement('div');
  sep.className = 'menu-sep';
  const clear = document.createElement('button');
  clear.className = 'menu-item';
  clear.innerHTML = '<i>&#xE74D;</i><span></span>';
  clear.querySelector('span').textContent = t('recent.clear');
  clear.addEventListener('click', () => {
    settings.recent = [];
    saveSettings();
    renderRecents();
    closeFlyouts();
  });
  menu.append(sep, clear);
}

// ---------------------------------------------------------------------------
// Boîte « Enregistrer les modifications ? »
// ---------------------------------------------------------------------------

let dialogResolve = null;

function askSave() {
  $('dialog-text').textContent = t('dlg.text', { name: fileName(doc?.path) });
  $('dialog-backdrop').hidden = false;
  $('dlg-save').focus();
  return new Promise((resolve) => { dialogResolve = resolve; });
}

function closeDialog(choice) {
  $('dialog-backdrop').hidden = true;
  const resolve = dialogResolve;
  dialogResolve = null;
  resolve?.(choice);
}

$('dlg-save').addEventListener('click', () => closeDialog('save'));
$('dlg-discard').addEventListener('click', () => closeDialog('discard'));
$('dlg-cancel').addEventListener('click', () => closeDialog('cancel'));

// ---------------------------------------------------------------------------
// Recherche dans l'aperçu
// ---------------------------------------------------------------------------

function openFind() {
  if (!doc) return;
  if (mode === 'edit') setMode('split');
  el.findbar.hidden = false;
  $('btn-find').classList.add('on');
  el.findInput.focus();
  el.findInput.select();
  if (el.findInput.value) updateFind();
}

function closeFind() {
  el.findbar.hidden = true;
  $('btn-find').classList.remove('on');
  finder.clear();
}

function updateFind(keep = false) {
  const n = finder.search(el.findInput.value, keep);
  const c = el.findCount;
  c.classList.toggle('none', !!el.findInput.value && n === 0);
  c.textContent = !el.findInput.value ? '' : n === 0 ? t('find.none') : t('find.count', { i: finder.index + 1, n });
}

function stepFind(direction) {
  finder.step(direction);
  if (finder.ranges.length) el.findCount.textContent = t('find.count', { i: finder.index + 1, n: finder.ranges.length });
}

el.findInput.addEventListener('input', () => updateFind());
el.findInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    stepFind(e.shiftKey ? -1 : 1);
  } else if (e.key === 'Escape') {
    e.preventDefault();
    closeFind();
  }
});
$('find-next').addEventListener('click', () => stepFind(1));
$('find-prev').addEventListener('click', () => stepFind(-1));
$('find-close').addEventListener('click', closeFind);

// ---------------------------------------------------------------------------
// Liens dans le document
// ---------------------------------------------------------------------------

el.preview.addEventListener('click', async (e) => {
  const a = e.target.closest('a[href]');
  if (!a) return;
  // Jamais de navigation dans la fenêtre elle-même.
  e.preventDefault();
  const href = a.getAttribute('href');
  if (href.startsWith('#')) {
    scrollToAnchor(href.slice(1));
    return;
  }
  if (/^[a-z][a-z0-9+.-]*:/i.test(href) && !/^[a-z]:[\\/]/i.test(href)) {
    invoke('open_external', { target: href }).catch((err) => notify(String(err), true));
    return;
  }
  const [file, fragment] = href.split('#');
  const link = await invoke('resolve_link', { baseDir: dirName(doc?.path), href: file });
  if (!link.exists) {
    notify(t('msg.fileMissing', { file }), true);
  } else if (link.isMarkdown) {
    guard(() => openPath(link.path, fragment || null));
  } else {
    invoke('open_external', { target: link.path }).catch((err) => notify(String(err), true));
  }
});

// Les cases à cocher de l'aperçu restent en lecture seule, comme sur GitHub.
el.preview.addEventListener('click', (e) => {
  if (e.target.matches('input[type=checkbox]')) e.preventDefault();
});

// ---------------------------------------------------------------------------
// Boutons
// ---------------------------------------------------------------------------

function closeFlyouts() {
  for (const f of document.querySelectorAll('.flyout')) f.hidden = true;
}

function toggleFlyout(id) {
  const f = $(id);
  const show = f.hidden;
  closeFlyouts();
  f.hidden = !show;
}

document.addEventListener('mousedown', (e) => {
  if (!e.target.closest('.menu-wrap')) closeFlyouts();
});

$('btn-new').addEventListener('click', () => guard(newDocument));
$('btn-open').addEventListener('click', () => guard(pickAndOpen));
$('welcome-new').addEventListener('click', () => guard(newDocument));
$('welcome-open').addEventListener('click', () => guard(pickAndOpen));
$('btn-recent').addEventListener('click', () => toggleFlyout('recent-menu'));
$('btn-more').addEventListener('click', () => toggleFlyout('more-menu'));
el.save.addEventListener('click', save);
el.back.addEventListener('click', () => guard(goBack));
$('btn-toc').addEventListener('click', () => {
  settings.toc = !settings.toc;
  saveSettings();
  updatePanes();
});
$('btn-pages').addEventListener('click', togglePages);
$('btn-find').addEventListener('click', () => (el.findbar.hidden ? openFind() : closeFind()));
$('btn-theme').addEventListener('click', toggleTheme);
$('btn-zoom-in').addEventListener('click', () => setZoom(settings.zoom + 0.1));
$('btn-zoom-out').addEventListener('click', () => setZoom(settings.zoom - 0.1));
$('btn-zoom-reset').addEventListener('click', () => setZoom(1));
for (const b of document.querySelectorAll('#modes button')) {
  b.addEventListener('click', () => setMode(b.dataset.mode));
}
for (const b of document.querySelectorAll('#formatbar [data-fmt]')) {
  b.addEventListener('mousedown', (e) => e.preventDefault()); // garde le curseur dans l'éditeur
  b.addEventListener('click', () => editor && applyFormat(editor.view, b.dataset.fmt));
}

const autoReloadItem = $('opt-autoreload');
autoReloadItem.classList.toggle('on', settings.autoReload);
autoReloadItem.addEventListener('click', () => {
  settings.autoReload = !settings.autoReload;
  saveSettings();
  autoReloadItem.classList.toggle('on', settings.autoReload);
});
const hardBreaksItem = $('opt-hardbreaks');
hardBreaksItem.classList.toggle('on', settings.hardBreaks);
hardBreaksItem.addEventListener('click', () => {
  settings.hardBreaks = !settings.hardBreaks;
  saveSettings();
  hardBreaksItem.classList.toggle('on', settings.hardBreaks);
  renderNow();
});
$('opt-reload').addEventListener('click', () => {
  closeFlyouts();
  guard(() => reload());
});
$('opt-pdf').addEventListener('click', exportPdf);
$('opt-print').addEventListener('click', printDocument);
$('opt-saveas').addEventListener('click', () => {
  closeFlyouts();
  saveAs();
});

// ---------------------------------------------------------------------------
// Langue de l'interface
// ---------------------------------------------------------------------------

/** Applique la langue choisie (« auto » = celle de Windows) partout, sans redémarrer. */
function applyLanguage() {
  const lang = setLanguage(settings.lang);
  invoke('set_language', { lang }).catch(() => {});
  for (const b of document.querySelectorAll('[data-lang]')) {
    const on = b.dataset.lang === settings.lang;
    b.classList.toggle('on', on);
    b.setAttribute('aria-checked', String(on));
  }
  // Textes calculés : thème, chemin, statistiques, récents, pages, éditeur, aperçu.
  applyTheme();
  renderRecents();
  updateChrome();
  updatePageStatus();
  editor?.setLanguage();
  if (doc) renderNow();
}

for (const b of document.querySelectorAll('[data-lang]')) {
  b.addEventListener('click', () => {
    closeFlyouts();
    if (settings.lang === b.dataset.lang) return;
    settings.lang = b.dataset.lang;
    saveSettings();
    applyLanguage();
  });
}

// ---------------------------------------------------------------------------
// Clavier
// ---------------------------------------------------------------------------

window.addEventListener('keydown', (e) => {
  if (!$('dialog-backdrop').hidden) {
    if (e.key === 'Escape') closeDialog('cancel');
    else if (e.key === 'Enter' && document.activeElement?.tagName !== 'BUTTON') closeDialog('save');
    return;
  }
  const mod = e.ctrlKey || e.metaKey;
  const key = e.key.toLowerCase();
  const handled = () => e.preventDefault();

  // F5 / Ctrl+R rechargeraient la page de l'application elle-même : on les détourne.
  if (e.key === 'F5' || (mod && key === 'r')) {
    handled();
    if (doc?.path) guard(() => reload());
    return;
  }
  if (e.defaultPrevented) return; // déjà traité par l'éditeur (Ctrl+F, Ctrl+D…)

  if (mod && e.shiftKey && key === 's') { handled(); if (doc) saveAs(); }
  else if (mod && key === 's') { handled(); save(); }
  else if (mod && key === 'o') { handled(); guard(pickAndOpen); }
  else if (mod && key === 'n') { handled(); guard(newDocument); }
  else if (mod && key === 'e') { handled(); if (doc) setMode(mode === 'read' ? 'split' : 'read'); }
  else if (mod && key === 'f') { handled(); openFind(); }
  else if (mod && key === 't') { handled(); $('btn-toc').click(); }
  else if (mod && key === 'd') { handled(); toggleTheme(); }
  else if (mod && (key === '=' || key === '+')) { handled(); setZoom(settings.zoom + 0.1); }
  else if (mod && key === '-') { handled(); setZoom(settings.zoom - 0.1); }
  else if (mod && key === '0') { handled(); setZoom(1); }
  else if (mod && e.shiftKey && key === 'p') { handled(); exportPdf(); }
  else if (mod && key === 'p') { handled(); printDocument(); }
  else if (e.altKey && e.key === 'ArrowLeft') { handled(); guard(goBack); }
  else if (e.key === 'Escape') { closeFlyouts(); if (!el.findbar.hidden) closeFind(); }
});

window.addEventListener('wheel', (e) => {
  if (!e.ctrlKey) return;
  e.preventDefault();
  setZoom(settings.zoom + (e.deltaY < 0 ? 0.1 : -0.1));
}, { passive: false });

// Pas de menu « Précédent / Actualiser / Imprimer » du navigateur, sauf sur du texte.
window.addEventListener('contextmenu', (e) => {
  const editable = e.target.closest('input, textarea, .cm-editor');
  const selected = String(window.getSelection() ?? '').length > 0;
  if (!editable && !selected) e.preventDefault();
});

// ---------------------------------------------------------------------------
// Glisser-déposer et fermeture
// ---------------------------------------------------------------------------

webview.onDragDropEvent((event) => {
  const { type } = event.payload;
  $('drop-overlay').hidden = !(type === 'enter' || type === 'over');
  if (type === 'drop') {
    const path = event.payload.paths?.[0];
    if (path) guard(() => openPath(path));
  }
});

appWindow.onCloseRequested(async (event) => {
  if (!isDirty()) return;
  event.preventDefault();
  if (dialogResolve) return;
  const choice = await askSave();
  if (choice === 'cancel') return;
  if (choice === 'save' && !(await save())) return;
  await appWindow.destroy();
});

// ---------------------------------------------------------------------------
// Démarrage
// ---------------------------------------------------------------------------

async function start() {
  try {
    finder = new Finder(el.preview, el.previewPane);
    applyLanguage();
    applyTheme();
    setZoom(settings.zoom);
    renderRecents();
    setMode('read');
    updateChrome();
    await applyAccent();
    const initial = await invoke('initial_file').catch(() => null);
    if (initial) await openPath(initial, null, false);
  } catch (e) {
    notify(t('msg.startError', { e }), true);
  } finally {
    await appWindow.show().catch(() => {});
  }
}

// Toute erreur imprévue est affichée dans la barre d'état au lieu de passer inaperçue.
window.addEventListener('error', (e) => {
  // Avertissement bénin de Chromium, pas une vraie erreur.
  if (/ResizeObserver loop/.test(e.message)) return;
  notify(t('msg.unexpected', { e: e.message }), true);
});
window.addEventListener('unhandledrejection', (e) => notify(t('msg.unexpected', { e: e.reason }), true));

start();
