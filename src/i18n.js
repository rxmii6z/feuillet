// SPDX-License-Identifier: GPL-3.0-or-later
// Feuillet — éditeur Markdown pour Windows 11. Copyright (C) 2026 les contributeurs de Feuillet.

// Traductions de l'interface (français / anglais).
//
// - `t('clé', { variable })` renvoie le texte dans la langue en cours ;
// - dans index.html, les attributs data-i18n (texte), data-i18n-title (infobulle),
//   data-i18n-placeholder et data-i18n-aria (aria-label) sont remplis par `applyStatic()`.
//
// Pour ajouter une langue : copier le bloc `en`, le traduire, et l'ajouter à LANGUAGES.

const fr = {
  // Barre de commandes
  'new': 'Nouveau',
  'new.title': 'Nouveau document (Ctrl+N)',
  'open': 'Ouvrir',
  'open.title': 'Ouvrir un fichier (Ctrl+O)',
  'recent': 'Récents',
  'recent.title': 'Fichiers récents',
  'save': 'Enregistrer',
  'save.title': 'Enregistrer (Ctrl+S) — Enregistrer sous : Ctrl+Maj+S',
  'back.title': 'Document précédent (Alt+←)',
  'modes.aria': "Mode d'affichage",
  'mode.read': 'Lecture',
  'mode.read.title': 'Lire le document mis en forme',
  'mode.edit': 'Édition',
  'mode.edit.title': 'Modifier le texte Markdown',
  'mode.split': 'Côte à côte',
  'mode.split.title': 'Éditeur et aperçu en direct (Ctrl+E)',
  'pages.title': "Pages A4 : l'aperçu est découpé en pages, comme dans le PDF exporté",
  'toc.title': 'Sommaire (Ctrl+T)',
  'find.title': 'Rechercher dans le document (Ctrl+F)',
  'theme.toLight': 'Passer en thème clair (Ctrl+D)',
  'theme.toDark': 'Passer en thème sombre (Ctrl+D)',
  'zoomOut.title': 'Réduire (Ctrl -)',
  'zoomReset.title': 'Taille normale (Ctrl+0)',
  'zoomIn.title': 'Agrandir (Ctrl +)',
  'more.title': "Plus d'options",

  // Menu ⋯
  'menu.autoreload': 'Recharger quand le fichier change',
  'menu.hardbreaks': 'Garder les retours à la ligne',
  'menu.hardbreaks.title': 'Activé : chaque retour à la ligne du fichier est affiché. Désactivé : Markdown standard (il faut une ligne vide pour changer de paragraphe).',
  'menu.reload': 'Recharger maintenant',
  'menu.pdf': 'Exporter en PDF…',
  'menu.print': 'Imprimer…',
  'menu.saveas': 'Enregistrer sous…',
  'menu.language': 'Langue',
  'menu.lang.auto': 'Automatique (Windows)',
  'kbd.pdf': 'Ctrl+Maj+P',
  'kbd.saveas': 'Ctrl+Maj+S',
  'about': 'Feuillet — version 1.0 · licence GPL v3',

  // Barre de mise en forme
  'fmt.bold': 'Gras (Ctrl+B)',
  'fmt.italic': 'Italique (Ctrl+I)',
  'fmt.strike': 'Barré',
  'fmt.code': 'Code dans le texte (Ctrl+`)',
  'fmt.h1': 'Titre 1',
  'fmt.h2': 'Titre 2',
  'fmt.h3': 'Titre 3',
  'fmt.ul': 'Liste à puces',
  'fmt.ol': 'Liste numérotée',
  'fmt.task': 'Liste de tâches',
  'fmt.quote': 'Citation',
  'fmt.link': 'Lien (Ctrl+K)',
  'fmt.image': 'Image',
  'fmt.codeblock': 'Bloc de code',
  'fmt.table': 'Tableau',
  'fmt.hr': 'Ligne de séparation',
  // Textes insérés dans le document par la mise en forme
  'ins.bold': 'texte en gras',
  'ins.italic': 'texte en italique',
  'ins.strike': 'texte barré',
  'ins.linkText': 'texte du lien',
  'ins.imageAlt': 'description',
  'ins.column': 'Colonne',
  'ins.cell': 'Texte',

  // Recherche
  'find.placeholder': 'Rechercher dans le document',
  'find.prev': 'Précédent (Maj+Entrée)',
  'find.next': 'Suivant (Entrée)',
  'find.close': 'Fermer (Échap)',
  'find.none': 'Aucun résultat',
  'find.count': '{i} sur {n}',

  // Accueil, sommaire, barre d'état
  'toc.heading': 'Sommaire',
  'toc.empty': 'Pas de titres dans ce document',
  'welcome.subtitle': 'Éditeur Markdown · version 1.0',
  'welcome.hint': 'Glisse un fichier .md dans cette fenêtre, ou :',
  'welcome.open': 'Ouvrir un fichier…',
  'welcome.new': 'Nouveau document',
  'welcome.shortcuts': 'Ctrl+O ouvrir · Ctrl+N nouveau · Ctrl+E éditer · Ctrl+S enregistrer · Ctrl+F rechercher · Ctrl+D thème',
  'status.dirty': '● Modifié',
  'status.none': 'Aucun fichier ouvert',
  'status.new': 'Nouveau document (pas encore enregistré)',
  'status.stats': '{words} mots · {lines} lignes · {size}',
  'unit.b': 'o',
  'unit.kb': 'Ko',
  'unit.mb': 'Mo',
  'pages.one': '1 page A4',
  'pages.many': '{n} pages A4',
  'pages.current': 'Page {page} / {total}',
  'editor.placeholder': 'Écris ton Markdown ici…',
  'preview.empty': 'L’aperçu du document s’affichera ici.',
  'copy': 'Copier',
  'drop': "Dépose le fichier pour l'ouvrir",

  // Fichiers récents
  'recent.empty': 'Aucun fichier récent',
  'recent.heading': 'Fichiers récents',
  'recent.clear': 'Vider la liste',

  // Boîtes de dialogue
  'untitled': 'Sans titre.md',
  'dlg.text': 'Voulez-vous enregistrer les modifications apportées à « {name} » ?',
  'dlg.save': 'Enregistrer',
  'dlg.discard': 'Ne pas enregistrer',
  'dlg.cancel': 'Annuler',
  'dlg.open': 'Ouvrir un fichier Markdown',
  'dlg.saveas': 'Enregistrer sous',
  'dlg.pdf': 'Exporter en PDF',
  'filter.all': 'Tous les fichiers',
  'filter.pdf': 'Document PDF',

  // Notifications
  'msg.saved': 'Enregistré',
  'msg.savedUtf8': 'Enregistré en UTF-8 (certains caractères n’existaient pas dans l’encodage d’origine)',
  'msg.reloaded': 'Fichier rechargé',
  'msg.changedOutside': 'Le fichier a été modifié par un autre programme',
  'msg.copyFailed': 'Impossible de copier dans le presse-papiers',
  'msg.pdfProgress': 'Export PDF en cours…',
  'msg.pdfDone': 'PDF enregistré : {name}',
  'msg.anchorMissing': 'Section introuvable : #{name}',
  'msg.fileMissing': 'Fichier introuvable : {file}',
  'msg.startError': 'Erreur au démarrage : {e}',
  'msg.unexpected': 'Erreur inattendue : {e}',

  // Titres des encadrés > [!NOTE] (GitHub les écrit en anglais)
  'alert.note': 'Remarque',
  'alert.tip': 'Astuce',
  'alert.important': 'Important',
  'alert.warning': 'Attention',
  'alert.caution': 'Prudence',
};

/** @type {typeof fr} */
const en = {
  'new': 'New',
  'new.title': 'New document (Ctrl+N)',
  'open': 'Open',
  'open.title': 'Open a file (Ctrl+O)',
  'recent': 'Recent',
  'recent.title': 'Recent files',
  'save': 'Save',
  'save.title': 'Save (Ctrl+S) — Save as: Ctrl+Shift+S',
  'back.title': 'Previous document (Alt+←)',
  'modes.aria': 'View mode',
  'mode.read': 'Read',
  'mode.read.title': 'Read the formatted document',
  'mode.edit': 'Edit',
  'mode.edit.title': 'Edit the Markdown text',
  'mode.split': 'Side by side',
  'mode.split.title': 'Editor with live preview (Ctrl+E)',
  'pages.title': 'A4 pages: the preview is split into pages, exactly like the exported PDF',
  'toc.title': 'Outline (Ctrl+T)',
  'find.title': 'Find in document (Ctrl+F)',
  'theme.toLight': 'Switch to light theme (Ctrl+D)',
  'theme.toDark': 'Switch to dark theme (Ctrl+D)',
  'zoomOut.title': 'Zoom out (Ctrl -)',
  'zoomReset.title': 'Actual size (Ctrl+0)',
  'zoomIn.title': 'Zoom in (Ctrl +)',
  'more.title': 'More options',

  'menu.autoreload': 'Reload when the file changes',
  'menu.hardbreaks': 'Keep line breaks',
  'menu.hardbreaks.title': 'On: every line break in the file is shown. Off: standard Markdown (a blank line is needed to start a new paragraph).',
  'menu.reload': 'Reload now',
  'menu.pdf': 'Export to PDF…',
  'menu.print': 'Print…',
  'menu.saveas': 'Save as…',
  'menu.language': 'Language',
  'menu.lang.auto': 'Automatic (Windows)',
  'kbd.pdf': 'Ctrl+Shift+P',
  'kbd.saveas': 'Ctrl+Shift+S',
  'about': 'Feuillet — version 1.0 · GPL v3 license',

  'fmt.bold': 'Bold (Ctrl+B)',
  'fmt.italic': 'Italic (Ctrl+I)',
  'fmt.strike': 'Strikethrough',
  'fmt.code': 'Inline code (Ctrl+`)',
  'fmt.h1': 'Heading 1',
  'fmt.h2': 'Heading 2',
  'fmt.h3': 'Heading 3',
  'fmt.ul': 'Bulleted list',
  'fmt.ol': 'Numbered list',
  'fmt.task': 'Task list',
  'fmt.quote': 'Quote',
  'fmt.link': 'Link (Ctrl+K)',
  'fmt.image': 'Image',
  'fmt.codeblock': 'Code block',
  'fmt.table': 'Table',
  'fmt.hr': 'Horizontal rule',
  'ins.bold': 'bold text',
  'ins.italic': 'italic text',
  'ins.strike': 'strikethrough text',
  'ins.linkText': 'link text',
  'ins.imageAlt': 'description',
  'ins.column': 'Column',
  'ins.cell': 'Text',

  'find.placeholder': 'Find in document',
  'find.prev': 'Previous (Shift+Enter)',
  'find.next': 'Next (Enter)',
  'find.close': 'Close (Esc)',
  'find.none': 'No results',
  'find.count': '{i} of {n}',

  'toc.heading': 'Outline',
  'toc.empty': 'No headings in this document',
  'welcome.subtitle': 'Markdown editor · version 1.0',
  'welcome.hint': 'Drop a .md file into this window, or:',
  'welcome.open': 'Open a file…',
  'welcome.new': 'New document',
  'welcome.shortcuts': 'Ctrl+O open · Ctrl+N new · Ctrl+E edit · Ctrl+S save · Ctrl+F find · Ctrl+D theme',
  'status.dirty': '● Modified',
  'status.none': 'No file open',
  'status.new': 'New document (not saved yet)',
  'status.stats': '{words} words · {lines} lines · {size}',
  'unit.b': 'B',
  'unit.kb': 'KB',
  'unit.mb': 'MB',
  'pages.one': '1 A4 page',
  'pages.many': '{n} A4 pages',
  'pages.current': 'Page {page} / {total}',
  'editor.placeholder': 'Write your Markdown here…',
  'preview.empty': 'The document preview will appear here.',
  'copy': 'Copy',
  'drop': 'Drop the file to open it',

  'recent.empty': 'No recent files',
  'recent.heading': 'Recent files',
  'recent.clear': 'Clear list',

  'untitled': 'Untitled.md',
  'dlg.text': 'Do you want to save the changes made to “{name}”?',
  'dlg.save': 'Save',
  'dlg.discard': "Don't save",
  'dlg.cancel': 'Cancel',
  'dlg.open': 'Open a Markdown file',
  'dlg.saveas': 'Save as',
  'dlg.pdf': 'Export to PDF',
  'filter.all': 'All files',
  'filter.pdf': 'PDF document',

  'msg.saved': 'Saved',
  'msg.savedUtf8': 'Saved as UTF-8 (some characters did not exist in the original encoding)',
  'msg.reloaded': 'File reloaded',
  'msg.changedOutside': 'The file was changed by another program',
  'msg.copyFailed': 'Could not copy to the clipboard',
  'msg.pdfProgress': 'Exporting PDF…',
  'msg.pdfDone': 'PDF saved: {name}',
  'msg.anchorMissing': 'Section not found: #{name}',
  'msg.fileMissing': 'File not found: {file}',
  'msg.startError': 'Startup error: {e}',
  'msg.unexpected': 'Unexpected error: {e}',

  'alert.note': 'Note',
  'alert.tip': 'Tip',
  'alert.important': 'Important',
  'alert.warning': 'Warning',
  'alert.caution': 'Caution',
};

/** Langues proposées, avec leur nom dans leur propre langue. */
export const LANGUAGES = { fr: 'Français', en: 'English' };
const DICTS = { fr, en };

let lang = 'fr';

/** Langue d'affichage de Windows (WebView2 la reprend) : français, sinon anglais. */
export function systemLanguage() {
  const list = navigator.languages?.length ? navigator.languages : [navigator.language || 'en'];
  for (const l of list) {
    const code = String(l).slice(0, 2).toLowerCase();
    if (DICTS[code]) return code;
  }
  return 'en';
}

/** `choice` : « auto », « fr » ou « en ». Renvoie la langue réellement utilisée. */
export function setLanguage(choice) {
  lang = DICTS[choice] ? choice : systemLanguage();
  document.documentElement.lang = lang;
  applyStatic();
  return lang;
}

export const getLanguage = () => lang;

/** Texte traduit ; `{nom}` est remplacé par `vars.nom`. */
export function t(key, vars) {
  const s = DICTS[lang][key] ?? fr[key] ?? key;
  return vars ? s.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m)) : s;
}

/** Nombre au format de la langue (espaces ou virgules entre les milliers). */
export const formatNumber = (n) => n.toLocaleString(lang === 'fr' ? 'fr-FR' : 'en-US');

/** Remplit les textes fixes de la page (attributs data-i18n*). */
export function applyStatic(root = document) {
  for (const n of root.querySelectorAll('[data-i18n]')) n.textContent = t(n.dataset.i18n);
  for (const n of root.querySelectorAll('[data-i18n-title]')) n.title = t(n.dataset.i18nTitle);
  for (const n of root.querySelectorAll('[data-i18n-placeholder]')) n.placeholder = t(n.dataset.i18nPlaceholder);
  for (const n of root.querySelectorAll('[data-i18n-aria]')) n.setAttribute('aria-label', t(n.dataset.i18nAria));
}
