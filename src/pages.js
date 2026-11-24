// SPDX-License-Identifier: GPL-3.0-or-later
// Feuillet — éditeur Markdown pour Windows 11. Copyright (C) 2026 les contributeurs de Feuillet.

// Mode « pages A4 » : l'aperçu est découpé en pages comme à l'impression.
//
// Le texte garde une largeur de 170 mm (A4 moins 2 × 20 mm de marges), comme dans le PDF :
// les retours à la ligne sont donc les mêmes. On repousse à la page suivante chaque bloc
// (paragraphe, tableau, code…) qui dépasserait du bas de la page, en insérant une cale
// `.page-gap` ; ce bloc reçoit `.page-first`, qui force aussi le saut à l'impression.

const MM = 96 / 25.4;
export const PAGE = { width: 210 * MM, height: 297 * MM, margin: 20 * MM, gap: 28 };
const STRIDE = PAGE.height + PAGE.gap;

const pageStart = (k) => k * STRIDE + PAGE.margin;
const pageEnd = (k) => k * STRIDE + PAGE.height - PAGE.margin;
const isHeading = (n) => /^H[1-6]$/.test(n.tagName);

export function clearPages(sheet, article) {
  for (const n of sheet.querySelectorAll(':scope > .page-bg')) n.remove();
  for (const n of article.querySelectorAll(':scope > .page-gap')) n.remove();
  for (const n of article.querySelectorAll(':scope > .page-first')) n.classList.remove('page-first');
  for (const n of article.querySelectorAll(':scope > .page-squeezed')) n.classList.remove('page-squeezed');
  article.style.minHeight = '';
}

/**
 * Découpe `article` en pages et dessine les feuilles derrière lui.
 * Renvoie le nombre de pages et, pour chaque début de page (à partir de la 2ᵉ),
 * la ligne du fichier source où il commence.
 */
export function paginate(sheet, article) {
  clearPages(sheet, article);
  let page = 0;
  let forced = false;
  let prev = null;
  const breaks = [];

  for (const block of [...article.children]) {
    if (block.classList.contains('page-break')) {
      forced = true;
      continue;
    }
    let top = block.offsetTop;
    let bottom = top + block.offsetHeight;
    const atStart = top <= pageStart(page) + 1;

    // Ligne vide (sautée dans le fichier) : elle pousse la suite vers le bas.
    // Si elle ne tient plus en bas de la page, elle disparaît : la page suivante
    // ne commence jamais par du vide, et le bloc d'après y passe tout seul.
    if (block.classList.contains('blank-line')) {
      if (forced || bottom > pageEnd(page) || atStart) block.classList.add('page-squeezed');
      continue;
    }

    if ((forced || bottom > pageEnd(page)) && !atStart) {
      // Un titre ne reste jamais seul en bas de page : il part avec le bloc qui le suit.
      const keepHeading = !forced && prev && isHeading(prev) && prev.offsetTop > pageStart(page) + 1;
      const node = keepHeading ? prev : block;
      page += 1;
      const spacer = document.createElement('div');
      spacer.className = 'page-gap';
      spacer.setAttribute('aria-hidden', 'true');
      node.before(spacer);
      node.classList.add('page-first');
      spacer.style.height = `${Math.max(0, pageStart(page) - node.offsetTop)}px`;
      breaks.push({ page: page + 1, line: sourceLine(node) });
      top = block.offsetTop;
      bottom = top + block.offsetHeight;
    }
    forced = false;
    // Bloc plus haut qu'une page (long tableau, gros bloc de code) : il continue sur la suivante.
    while (bottom > pageEnd(page) + 1) page += 1;
    prev = block;
  }

  const pages = page + 1;
  article.style.minHeight = `${pages * STRIDE - PAGE.gap}px`;
  const frag = document.createDocumentFragment();
  for (let k = 0; k < pages; k++) {
    const bg = document.createElement('div');
    bg.className = 'page-bg';
    bg.style.top = `${k * STRIDE}px`;
    bg.dataset.label = `${k + 1} / ${pages}`;
    frag.append(bg);
  }
  sheet.prepend(frag);
  return { pages, breaks: breaks.filter((b) => b.line > 0) };
}

function sourceLine(node) {
  const pos = node.dataset.sourcepos ?? node.querySelector('[data-sourcepos]')?.dataset.sourcepos;
  return pos ? parseInt(pos, 10) : 0;
}

/** Réduit la page (sans changer sa mise en page) pour qu'elle tienne dans la largeur du volet. */
export function fitSheet(pane, sheet, on) {
  if (!on) {
    sheet.style.transform = sheet.style.marginLeft = sheet.style.marginBottom = '';
    return 1;
  }
  const cs = getComputedStyle(pane);
  const avail = pane.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
  const scale = Math.min(1, avail / PAGE.width);
  sheet.style.transform = scale < 1 ? `scale(${scale})` : '';
  sheet.style.marginLeft = `${Math.max(0, (avail - PAGE.width * scale) / 2)}px`;
  sheet.style.marginBottom = `${-(1 - scale) * sheet.offsetHeight}px`;
  return scale;
}

/** Numéro de la page affichée en haut du volet. */
export function currentPage(pane, sheet, scale, pages) {
  const offset = pane.scrollTop + pane.clientHeight / 3 - sheet.offsetTop;
  return Math.max(1, Math.min(pages, Math.floor(offset / (STRIDE * scale)) + 1));
}
