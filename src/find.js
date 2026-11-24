// SPDX-License-Identifier: GPL-3.0-or-later
// Feuillet — éditeur Markdown pour Windows 11. Copyright (C) 2026 les contributeurs de Feuillet.

// Recherche dans l'aperçu, avec surlignage (API « CSS Custom Highlight » de Chromium :
// le document n'est pas modifié, seuls des intervalles de texte sont colorés).

export class Finder {
  constructor(root, scroller) {
    this.root = root;
    this.scroller = scroller;
    this.ranges = [];
    this.index = -1;
    this.query = '';
  }

  /** Cherche `query` (sans tenir compte des majuscules ni des accents). Renvoie le nombre de résultats. */
  search(query, keepPosition = false) {
    const previous = this.index;
    this.query = query;
    this.ranges = [];
    this.index = -1;
    const needle = fold(query);
    if (needle) {
      const walker = document.createTreeWalker(this.root, NodeFilter.SHOW_TEXT);
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        const hay = fold(node.data);
        let at = hay.indexOf(needle);
        while (at !== -1) {
          const range = new Range();
          range.setStart(node, at);
          range.setEnd(node, at + needle.length);
          this.ranges.push(range);
          at = hay.indexOf(needle, at + needle.length);
        }
      }
    }
    CSS.highlights.set('find', new Highlight(...this.ranges));
    if (this.ranges.length) {
      this.index = keepPosition ? Math.min(Math.max(previous, 0), this.ranges.length - 1) : this.firstVisible();
      this.show(!keepPosition);
    } else {
      CSS.highlights.delete('find-active');
    }
    return this.ranges.length;
  }

  /** Premier résultat à partir de la position de lecture actuelle. */
  firstVisible() {
    const top = this.scroller.getBoundingClientRect().top;
    const i = this.ranges.findIndex((r) => r.getBoundingClientRect().top >= top);
    return i === -1 ? 0 : i;
  }

  step(direction) {
    if (!this.ranges.length) return;
    this.index = (this.index + direction + this.ranges.length) % this.ranges.length;
    this.show(true);
  }

  show(scroll) {
    const range = this.ranges[this.index];
    if (!range) return;
    CSS.highlights.set('find-active', new Highlight(range));
    if (!scroll) return;
    const box = range.getBoundingClientRect();
    const view = this.scroller.getBoundingClientRect();
    if (box.top < view.top + 60 || box.bottom > view.bottom - 60) {
      this.scroller.scrollBy({ top: box.top - view.top - view.height / 3, behavior: 'smooth' });
    }
  }

  clear() {
    this.ranges = [];
    this.index = -1;
    CSS.highlights.delete('find');
    CSS.highlights.delete('find-active');
  }
}

/** Minuscules sans accents, en gardant la même longueur (positions identiques). */
function fold(s) {
  let out = '';
  for (const ch of s) {
    const lower = ch.toLowerCase();
    out += ch.length === 1 && lower.length === 1 ? lower.normalize('NFD')[0] : ch;
  }
  return out;
}
