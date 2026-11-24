// SPDX-License-Identifier: GPL-3.0-or-later
// Feuillet — éditeur Markdown pour Windows 11. Copyright (C) 2026 les contributeurs de Feuillet.

// Éditeur Markdown (CodeMirror 6) : coloration, historique, recherche/remplacement,
// thèmes clair/sombre assortis à Windows 11.

import { EditorState, Compartment, Prec, StateEffect, StateField } from '@codemirror/state';
import {
  EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter,
  drawSelection, dropCursor, rectangularSelection, crosshairCursor, highlightSpecialChars,
  placeholder, Decoration, WidgetType,
} from '@codemirror/view';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { languages } from '@codemirror/language-data';
import { syntaxHighlighting, HighlightStyle, indentOnInput, bracketMatching } from '@codemirror/language';
import { searchKeymap, highlightSelectionMatches, search } from '@codemirror/search';
import { closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete';
import { tags as t } from '@lezer/highlight';
import { t as tr, getLanguage } from './i18n.js';

// ---- Repères de début de page (mode pages A4) ----

class PageWidget extends WidgetType {
  constructor(page) {
    super();
    this.page = page;
  }
  eq(other) {
    return other.page === this.page;
  }
  toDOM() {
    const div = document.createElement('div');
    div.className = 'cm-page-mark';
    div.innerHTML = '<span></span>';
    div.firstChild.textContent = `Page ${this.page}`;
    return div;
  }
  ignoreEvent() {
    return true;
  }
}

const setPageMarks = StateEffect.define();
const pageMarks = StateField.define({
  create: () => Decoration.none,
  update(deco, tr) {
    deco = deco.map(tr.changes);
    for (const e of tr.effects) {
      if (!e.is(setPageMarks)) continue;
      const doc = tr.state.doc;
      const seen = new Set();
      const ranges = [];
      for (const { line, page } of e.value) {
        if (line < 1 || line > doc.lines || seen.has(line)) continue;
        seen.add(line);
        ranges.push(Decoration.widget({ widget: new PageWidget(page), block: true, side: -1 }).range(doc.line(line).from));
      }
      deco = Decoration.set(ranges, true);
    }
    return deco;
  },
  provide: (f) => EditorView.decorations.from(f),
});

/** Textes de CodeMirror (en anglais d'origine) traduits en français. */
const phrasesFr = {
  'Find': 'Rechercher',
  'Replace': 'Remplacer',
  'next': 'suivant',
  'previous': 'précédent',
  'all': 'tout',
  'match case': 'respecter la casse',
  'regexp': 'expression régulière',
  'by word': 'mot entier',
  'replace': 'remplacer',
  'replace all': 'tout remplacer',
  'close': 'fermer',
  'current match': 'résultat actuel',
  'on line': 'à la ligne',
  'Go to line': 'Aller à la ligne',
  'go': 'OK',
};

function palette(dark) {
  return dark
    ? { text: '#e6e6e6', dim: 'rgba(255,255,255,0.42)', heading: '#79c0ff', strong: '#ffffff', link: '#7ee787',
        url: '#a5d6ff', code: '#ffa657', quote: '#8b949e', mark: '#ff7b72', keyword: '#ff7b72', string: '#a5d6ff',
        comment: '#8b949e', number: '#79c0ff', fn: '#d2a8ff', type: '#ffa657', active: 'rgba(255,255,255,0.045)',
        selection: 'rgba(76,194,255,0.30)', cursor: '#ffffff', gutter: 'rgba(255,255,255,0.32)' }
    : { text: '#1f2328', dim: 'rgba(0,0,0,0.38)', heading: '#0550ae', strong: '#1f2328', link: '#116329',
        url: '#0a3069', code: '#953800', quote: '#57606a', mark: '#cf222e', keyword: '#cf222e', string: '#0a3069',
        comment: '#6e7781', number: '#0550ae', fn: '#8250df', type: '#953800', active: 'rgba(0,0,0,0.035)',
        selection: 'rgba(0,103,192,0.20)', cursor: '#1b1b1b', gutter: 'rgba(0,0,0,0.32)' };
}

function themeFor(dark) {
  const p = palette(dark);
  const theme = EditorView.theme({
    '&': { height: '100%', color: p.text, backgroundColor: 'transparent', fontSize: '14.5px' },
    '&.cm-focused': { outline: 'none' },
    '.cm-scroller': { fontFamily: 'var(--font-mono)', lineHeight: '1.65' },
    '.cm-content': { padding: '20px 0 40vh', caretColor: p.cursor },
    '.cm-line': { padding: '0 28px 0 8px' },
    '.cm-gutters': { backgroundColor: 'transparent', border: 'none', color: p.gutter, paddingLeft: '10px' },
    '.cm-activeLine, .cm-activeLineGutter': { backgroundColor: p.active },
    '.cm-activeLineGutter': { color: p.text },
    '.cm-cursor, .cm-dropCursor': { borderLeftColor: p.cursor, borderLeftWidth: '2px' },
    '&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, .cm-selectionBackground, ::selection':
      { backgroundColor: p.selection },
    '.cm-selectionMatch': { backgroundColor: dark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.07)' },
    '.cm-searchMatch': { backgroundColor: 'var(--find)' },
    '.cm-searchMatch.cm-searchMatch-selected': { backgroundColor: 'var(--find-active)' },
    '.cm-placeholder': { color: p.dim, fontStyle: 'italic' },
    '.cm-panels': { backgroundColor: 'var(--flyout)', color: 'var(--text)', fontFamily: 'var(--font-ui)' },
    '.cm-panels.cm-panels-top': { borderBottom: '1px solid var(--divider)' },
    '.cm-panel.cm-search': { padding: '8px 12px', fontSize: '13px' },
    '.cm-panel.cm-search input.cm-textfield': {
      font: 'inherit', color: 'var(--text)', background: 'var(--control)', border: '1px solid var(--control-stroke)',
      borderRadius: '4px', padding: '4px 8px', outline: 'none',
    },
    '.cm-panel.cm-search button': {
      font: 'inherit', color: 'var(--text)', backgroundImage: 'none', background: 'var(--control)',
      border: '1px solid var(--control-stroke)', borderRadius: '4px', padding: '3px 10px',
    },
    '.cm-panel.cm-search button[name=close]': { border: 'none', background: 'none', fontSize: '18px' },
    '.cm-panel.cm-search label': { fontSize: '13px' },
    '.cm-page-mark': {
      display: 'flex', alignItems: 'center', gap: '10px', margin: '6px 0', color: p.dim,
      fontFamily: 'var(--font-ui)', fontSize: '11.5px', userSelect: 'none',
    },
    '.cm-page-mark::before, .cm-page-mark::after': { content: '""', flex: '1', borderTop: `1px dashed ${p.dim}` },
    '.cm-tooltip': { backgroundColor: 'var(--flyout)', border: '1px solid var(--flyout-stroke)', borderRadius: '6px' },
  }, { dark });

  const highlight = HighlightStyle.define([
    { tag: [t.heading1, t.heading2], color: p.heading, fontWeight: '700' },
    { tag: [t.heading3, t.heading4, t.heading5, t.heading6, t.heading], color: p.heading, fontWeight: '600' },
    { tag: t.strong, color: p.strong, fontWeight: '700' },
    { tag: t.emphasis, fontStyle: 'italic' },
    { tag: t.strikethrough, textDecoration: 'line-through' },
    { tag: t.link, color: p.link },
    { tag: t.url, color: p.url, textDecoration: 'underline' },
    { tag: t.monospace, color: p.code },
    { tag: t.quote, color: p.quote, fontStyle: 'italic' },
    // Marqueurs Markdown (#, **, -, 1., >, ```) : discrets, le texte reste lisible.
    { tag: [t.processingInstruction, t.contentSeparator, t.labelName], color: p.mark },
    { tag: [t.keyword, t.operatorKeyword, t.modifier, t.controlKeyword], color: p.keyword },
    { tag: [t.string, t.special(t.string), t.regexp], color: p.string },
    { tag: [t.comment, t.lineComment, t.blockComment], color: p.comment, fontStyle: 'italic' },
    { tag: [t.number, t.bool, t.null, t.atom], color: p.number },
    { tag: [t.function(t.variableName), t.function(t.propertyName)], color: p.fn },
    { tag: [t.typeName, t.className, t.namespace], color: p.type },
    { tag: [t.tagName, t.angleBracket], color: p.keyword },
    { tag: t.attributeName, color: p.fn },
    { tag: t.meta, color: p.dim },
  ]);
  return [theme, syntaxHighlighting(highlight)];
}

/**
 * Crée l'éditeur dans `parent`.
 * `opts` : { dark, onChange(), onCursor(line, col), onScroll(topLine), shortcuts: [{key, run}] }
 */
export function createEditor(parent, opts) {
  const themeSlot = new Compartment();
  const langSlot = new Compartment();
  // Textes de l'éditeur dans la langue de l'interface (barre de recherche, texte d'attente).
  const langExt = () => [
    EditorState.phrases.of(getLanguage() === 'fr' ? phrasesFr : {}),
    placeholder(tr('editor.placeholder')),
  ];
  let dark = opts.dark;

  const extensions = () => [
    langSlot.of(langExt()),
    lineNumbers(),
    highlightActiveLineGutter(),
    highlightSpecialChars(),
    history(),
    drawSelection(),
    dropCursor(),
    EditorState.allowMultipleSelections.of(true),
    indentOnInput(),
    bracketMatching(),
    closeBrackets(),
    rectangularSelection(),
    crosshairCursor(),
    highlightActiveLine(),
    highlightSelectionMatches(),
    search({ top: true }),
    EditorView.lineWrapping,
    markdown({ base: markdownLanguage, codeLanguages: languages }),
    themeSlot.of(themeFor(dark)),
    pageMarks,
    // Raccourcis de mise en forme : prioritaires sur ceux de CodeMirror (Ctrl+I…).
    Prec.highest(keymap.of(opts.shortcuts || [])),
    keymap.of([...closeBracketsKeymap, ...defaultKeymap, ...searchKeymap, ...historyKeymap, indentWithTab]),
    EditorView.updateListener.of((u) => {
      if (u.docChanged) opts.onChange?.();
      if (u.selectionSet || u.docChanged) {
        const head = u.state.selection.main.head;
        const line = u.state.doc.lineAt(head);
        opts.onCursor?.(line.number, head - line.from + 1);
      }
    }),
  ];

  const view = new EditorView({ parent, state: EditorState.create({ doc: '', extensions: extensions() }) });

  view.scrollDOM.addEventListener('scroll', () => {
    if (!opts.onScroll) return;
    const block = view.lineBlockAtHeight(view.scrollDOM.scrollTop + 4);
    const line = view.state.doc.lineAt(block.from).number;
    const fraction = block.height ? (view.scrollDOM.scrollTop + 4 - block.top) / block.height : 0;
    opts.onScroll(line + Math.max(0, Math.min(1, fraction)));
  }, { passive: true });

  return {
    view,
    /** Nouveau contenu, avec un historique d'annulation vierge (autre fichier). */
    load(text) {
      view.setState(EditorState.create({ doc: text, extensions: extensions() }));
    },
    /** Remplace le texte en gardant l'historique (rechargement depuis le disque). */
    replace(text) {
      view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: text } });
    },
    text: () => view.state.doc.toString(),
    setDark(value) {
      dark = value;
      view.dispatch({ effects: themeSlot.reconfigure(themeFor(dark)) });
    },
    focus: () => view.focus(),
    /** À appeler après un changement de langue de l'interface. */
    setLanguage() {
      view.dispatch({ effects: langSlot.reconfigure(langExt()) });
    },
    /** Affiche « Page n » avant les lignes où commence une nouvelle page ([] pour effacer). */
    setPageMarks(list) {
      view.dispatch({ effects: setPageMarks.of(list) });
    },
    /** Place le curseur au début de la ligne `n` (1 = première) et l'affiche en haut. */
    gotoLine(n) {
      const line = view.state.doc.line(Math.max(1, Math.min(n, view.state.doc.lines)));
      const scroll = () => view.dispatch({ effects: EditorView.scrollIntoView(line.from, { y: 'start', yMargin: 24 }) });
      view.dispatch({ selection: { anchor: line.from } });
      scroll();
      // La hauteur des lignes pas encore affichées n'est qu'estimée : on recale
      // une fois que CodeMirror les a mesurées.
      requestAnimationFrame(() => requestAnimationFrame(scroll));
      view.focus();
    },
  };
}
