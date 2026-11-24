// SPDX-License-Identifier: GPL-3.0-or-later
// Feuillet — éditeur Markdown pour Windows 11. Copyright (C) 2026 les contributeurs de Feuillet.

// Mise en forme Markdown dans l'éditeur : gras, titres, listes, liens, blocs…
// Chaque commande s'applique à toutes les sélections, et se retire si elle est
// déjà présente (cliquer deux fois sur « Gras » enlève le gras).

import { EditorSelection } from '@codemirror/state';
import { t } from './i18n.js';

/** Petit tableau à compléter, dans la langue de l'interface (colonnes alignées). */
function tableTemplate() {
  const cols = [`${t('ins.column')} 1`, `${t('ins.column')} 2`];
  const cell = t('ins.cell');
  const w = Math.max(...cols.map((c) => c.length), cell.length);
  const row = (cells) => `| ${cells.map((c) => c.padEnd(w)).join(' | ')} |`;
  return [row(cols), `|${'-'.repeat(w + 2)}|${'-'.repeat(w + 2)}|`, row([cell, cell])].join('\n');
}

export function applyFormat(view, fmt) {
  const run = {
    bold: () => wrap(view, '**', t('ins.bold')),
    italic: () => wrap(view, '*', t('ins.italic')),
    strike: () => wrap(view, '~~', t('ins.strike')),
    code: () => wrap(view, '`', 'code'),
    link: () => link(view, false),
    image: () => link(view, true),
    h1: () => heading(view, 1),
    h2: () => heading(view, 2),
    h3: () => heading(view, 3),
    ul: () => listLines(view, 'bullet'),
    ol: () => listLines(view, 'numbered'),
    task: () => listLines(view, 'task'),
    quote: () => listLines(view, 'quote'),
    codeblock: () => codeBlock(view),
    table: () => insertBlock(view, tableTemplate()),
    hr: () => insertBlock(view, '---'),
  }[fmt];
  if (run) {
    run();
    view.focus();
  }
  return true;
}

function wrap(view, mark, placeholder) {
  const m = mark.length;
  const { state } = view;
  // Pour l'italique « * », ne pas confondre avec le gras « ** ».
  const notBold = (s) => mark !== '*' || !s.startsWith('**') || s.startsWith('***');
  view.dispatch(state.changeByRange((range) => {
    const sel = state.sliceDoc(range.from, range.to);
    if (sel.length >= 2 * m + 1 && sel.startsWith(mark) && sel.endsWith(mark) && notBold(sel)) {
      const inner = sel.slice(m, -m);
      return { changes: { from: range.from, to: range.to, insert: inner }, range: EditorSelection.range(range.from, range.from + inner.length) };
    }
    const before = state.sliceDoc(Math.max(0, range.from - m), range.from);
    const after = state.sliceDoc(range.to, range.to + m);
    const around = state.sliceDoc(Math.max(0, range.from - m - 2), range.to + m + 2);
    if (!range.empty && before === mark && after === mark && notBold(around.slice(around.indexOf(mark)))) {
      return {
        changes: [{ from: range.from - m, to: range.from }, { from: range.to, to: range.to + m }],
        range: EditorSelection.range(range.from - m, range.to - m),
      };
    }
    if (range.empty) {
      return {
        changes: { from: range.from, insert: mark + placeholder + mark },
        range: EditorSelection.range(range.from + m, range.from + m + placeholder.length),
      };
    }
    return {
      changes: [{ from: range.from, insert: mark }, { from: range.to, insert: mark }],
      range: EditorSelection.range(range.from + m, range.to + m),
    };
  }));
}

function link(view, image) {
  const { state } = view;
  const bang = image ? '!' : '';
  const url = image ? 'image.png' : 'https://';
  view.dispatch(state.changeByRange((range) => {
    const sel = state.sliceDoc(range.from, range.to);
    if (!sel) {
      const label = t(image ? 'ins.imageAlt' : 'ins.linkText');
      const start = range.from + bang.length + 1;
      return { changes: { from: range.from, insert: `${bang}[${label}](${url})` }, range: EditorSelection.range(start, start + label.length) };
    }
    // Le texte sélectionné devient le libellé, l'adresse est sélectionnée pour être tapée.
    const start = range.from + bang.length + sel.length + 3;
    return { changes: { from: range.from, to: range.to, insert: `${bang}[${sel}](${url})` }, range: EditorSelection.range(start, start + url.length) };
  }));
}

/** Remplace les lignes couvertes par chaque sélection par `edit(lignes)`. */
function editLines(view, edit) {
  const { state } = view;
  view.dispatch(state.changeByRange((range) => {
    const first = state.doc.lineAt(range.from);
    // Une sélection qui s'arrête au tout début d'une ligne n'englobe pas cette ligne.
    let last = state.doc.lineAt(range.to);
    if (!range.empty && range.to === last.from && last.number > first.number) last = state.doc.line(last.number - 1);
    const old = state.sliceDoc(first.from, last.to);
    const oldLines = old.split('\n');
    const next = edit(oldLines).join('\n');
    if (range.empty) {
      const firstNew = next.split('\n')[0];
      const pos = Math.max(first.from, range.from + firstNew.length - oldLines[0].length);
      return { changes: { from: first.from, to: last.to, insert: next }, range: EditorSelection.cursor(pos) };
    }
    return { changes: { from: first.from, to: last.to, insert: next }, range: EditorSelection.range(first.from, first.from + next.length) };
  }));
}

function heading(view, level) {
  const hashes = '#'.repeat(level);
  editLines(view, (lines) => lines.map((line) => {
    const m = /^(#{1,6})\s+/.exec(line);
    const rest = m ? line.slice(m[0].length) : line;
    if (m && m[1].length === level) return rest; // déjà à ce niveau : on retire le titre
    return `${hashes} ${rest}`;
  }));
}

const MARKERS = {
  task: /^(\s*)[-*+] \[[ xX]\] /,
  bullet: /^(\s*)[-*+] (?!\[[ xX]\] )/,
  numbered: /^(\s*)\d+[.)] /,
  quote: /^> ?/,
};

function listLines(view, kind) {
  editLines(view, (lines) => {
    const filled = lines.filter((l) => l.trim());
    const allMarked = filled.length > 0 && filled.every((l) => MARKERS[kind].test(l));
    let n = 0;
    return lines.map((line) => {
      if (allMarked) {
        const m = MARKERS[kind].exec(line);
        return m ? (m[1] || '') + line.slice(m[0].length) : line;
      }
      if (!line.trim() && lines.length > 1) return line;
      let indent = '';
      let body = line;
      if (kind !== 'quote') {
        // Remplace un autre type de liste au lieu d'empiler les marqueurs.
        for (const k of ['task', 'bullet', 'numbered']) {
          const m = MARKERS[k].exec(line);
          if (m) {
            indent = m[1] || '';
            body = line.slice(m[0].length);
            break;
          }
        }
        if (body === line) {
          indent = /^\s*/.exec(line)[0];
          body = line.slice(indent.length);
        }
      }
      n += 1;
      const marker = { bullet: '- ', numbered: `${n}. `, task: '- [ ] ', quote: '> ' }[kind];
      return indent + marker + body;
    });
  });
}

/** Ce qu'il faut ajouter avant / après `pos` pour qu'un bloc soit isolé par des lignes vides. */
function padding(doc, pos) {
  const before = doc.sliceString(Math.max(0, pos - 2), pos);
  const after = doc.sliceString(pos, pos + 2);
  const pre = pos === 0 || before === '\n\n' ? '' : before.endsWith('\n') ? '\n' : '\n\n';
  const post = after === '\n\n' ? '' : after.startsWith('\n') || pos === doc.length ? '\n' : '\n\n';
  return { pre, post };
}

function codeBlock(view) {
  const { state } = view;
  view.dispatch(state.changeByRange((range) => {
    const sel = state.sliceDoc(range.from, range.to).replace(/\n+$/, '');
    const { pre } = padding(state.doc, range.from);
    const { post } = padding(state.doc, range.to);
    const body = sel || 'code';
    const start = range.from + pre.length + 4;
    return {
      changes: { from: range.from, to: range.to, insert: `${pre}\`\`\`\n${body}\n\`\`\`${post}` },
      range: EditorSelection.range(start, start + body.length),
    };
  }));
}

function insertBlock(view, block) {
  const { state } = view;
  // On insère après la ligne en cours, pas au milieu du texte.
  const at = state.doc.lineAt(state.selection.main.head).to;
  const { pre, post } = padding(state.doc, at);
  const end = at + pre.length + block.length;
  view.dispatch({ changes: { from: at, insert: pre + block + post }, selection: { anchor: end }, scrollIntoView: true });
}
