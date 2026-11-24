// SPDX-License-Identifier: GPL-3.0-or-later
// Feuillet — éditeur Markdown pour Windows 11. Copyright (C) 2026 les contributeurs de Feuillet.

//! Markdown → HTML, avec les extensions de GitHub (tableaux, cases à cocher,
//! notes de bas de page, encadrés `[!NOTE]`, ancres des titres…).
//!
//! Le HTML est ensuite nettoyé : un fichier .md ne doit jamais pouvoir exécuter
//! de script dans la fenêtre (qui a accès aux fichiers de l'ordinateur).

use comrak::{markdown_to_html, Options};
use std::sync::OnceLock;

fn options() -> Options<'static> {
    let mut o = Options::default();
    let ext = &mut o.extension;
    ext.strikethrough = true;
    ext.table = true;
    ext.autolink = true;
    ext.tasklist = true;
    ext.footnotes = true;
    ext.alerts = true;
    ext.header_id_prefix = Some(String::new());
    ext.front_matter_delimiter = Some("---".into());
    // Le HTML écrit dans le fichier (<details>, <kbd>, <img>…) est conservé,
    // puis filtré par `sanitizer()`.
    o.render.r#unsafe = true;
    // Chaque bloc porte sa ligne d'origine : sert au sommaire en mode édition
    // et à la synchronisation du défilement éditeur → aperçu.
    o.render.sourcepos = true;
    o.render.tasklist_classes = true;
    o
}

fn sanitizer() -> &'static ammonia::Builder<'static> {
    static CLEANER: OnceLock<ammonia::Builder<'static>> = OnceLock::new();
    CLEANER.get_or_init(|| {
        let mut b = ammonia::Builder::default();
        b.add_tags(["input", "picture", "source", "figure", "figcaption", "mark", "ins"])
            .add_tag_attributes("input", ["type", "checked", "disabled"])
            .add_tag_attributes("source", ["srcset", "media", "type"])
            .add_tag_attributes("img", ["srcset", "loading"])
            .add_tag_attributes("ol", ["start"])
            .add_generic_attributes(["class", "id", "data-sourcepos", "aria-hidden", "aria-label", "title", "align", "dir", "lang"])
            .add_url_schemes(["file"])
            // Comme sur GitHub : les id du document sont préfixés, pour qu'un titre
            // « Editor » ou « Toc » ne prenne jamais la place d'un élément de l'interface.
            .id_prefix(Some(ID_PREFIX))
            .link_rel(None);
        b
    })
}

/// Préfixe des id du document (l'interface le retire pour suivre les liens `#ancre`).
pub const ID_PREFIX: &str = "user-content-";

/// Début d'un bloc HTML brut qui peut contenir des lignes vides sans se terminer :
/// renvoie la balise de fin attendue (commentaire, <pre>, <script>, <style>, <textarea>).
fn raw_html_end(trimmed: &str) -> Option<&'static str> {
    let lower = trimmed.to_ascii_lowercase();
    if let Some(rest) = lower.strip_prefix("<!--") {
        return (!rest.contains("-->")).then_some("-->");
    }
    for (open, close) in [("<pre", "</pre>"), ("<script", "</script>"), ("<style", "</style>"), ("<textarea", "</textarea>")] {
        if let Some(rest) = lower.strip_prefix(open) {
            if (rest.is_empty() || rest.starts_with([' ', '>', '\t'])) && !rest.contains(close) {
                return Some(close);
            }
        }
    }
    None
}

/// Marqueur canonique d'un saut de page (mode A4 / export PDF).
const PAGE_BREAK: &str = "<!-- pagebreak -->";

/// Ligne qui demande un saut de page : `<!-- pagebreak -->`, `<!-- saut de page -->`,
/// `\pagebreak` ou `\newpage` (seule sur sa ligne).
fn is_page_break(line: &str) -> bool {
    let l = line.trim().to_lowercase();
    if l == r"\pagebreak" || l == r"\newpage" {
        return true;
    }
    let Some(inner) = l.strip_prefix("<!--").and_then(|r| r.strip_suffix("-->")) else { return false };
    matches!(inner.trim(), "pagebreak" | "page-break" | "newpage" | "saut de page" | "saut-de-page")
}

/// Marqueur d'une ligne vide conservée (voir `prepare`).
const BLANK_LINE: &str = "<!-- ligne vide -->";

/// Prépare le texte avant le rendu, hors blocs de code :
/// - les sauts de page explicites deviennent le marqueur canonique ;
/// - les lignes vides en plus de la première sont gardées comme de l'espace
///   (en Markdown pur, plusieurs lignes vides n'en font qu'une) : sauter des lignes
///   dans le fichier descend la suite, jusqu'à la page suivante en mode A4 / PDF.
///
/// Le nombre de lignes ne change pas : les numéros de ligne (sourcepos) restent justes.
fn prepare(source: &str) -> String {
    let lines: Vec<&str> = source.split_inclusive('\n').collect();
    let is_blank = |l: &str| l.trim().is_empty();
    let mut out = String::with_capacity(source.len() + 64);
    let mut fence: Option<(char, usize)> = None;
    let mut raw: Option<&str> = None;
    for (i, &line) in lines.iter().enumerate() {
        let body = line.trim_end_matches(['\n', '\r']);
        // Dans un commentaire HTML ou un <pre> sur plusieurs lignes, on ne touche à rien.
        if let Some(end) = raw {
            if body.to_ascii_lowercase().contains(end) {
                raw = None;
            }
            out.push_str(line);
            continue;
        }
        if fence.is_none() && body.len() - body.trim_start().len() < 4 {
            if let Some(end) = raw_html_end(body.trim_start()) {
                raw = Some(end);
                out.push_str(line);
                continue;
            }
        }
        if fence.is_none() && is_blank(body) && i > 0 && is_blank(lines[i - 1]) {
            // Ligne vide supplémentaire : on la garde si la suite n'est pas un
            // contenu en retrait (suite d'un élément de liste, code indenté), ni la fin du fichier.
            let next = lines[i + 1..].iter().find(|l| !is_blank(l));
            if next.is_some_and(|n| !n.starts_with([' ', '\t'])) {
                out.push_str(BLANK_LINE);
                out.push_str(&line[body.len()..]);
                continue;
            }
        }
        let trimmed = body.trim_start();
        let indent = body.len() - trimmed.len();
        let run = |c: char| trimmed.chars().take_while(|&x| x == c).count();
        match fence {
            Some((c, n)) => {
                if indent < 4 && run(c) >= n && trimmed.trim_start_matches(c).trim().is_empty() {
                    fence = None;
                }
            }
            None if indent < 4 && (run('`') >= 3 || run('~') >= 3) => {
                let c = if run('`') >= 3 { '`' } else { '~' };
                fence = Some((c, run(c)));
            }
            None if is_page_break(body) => {
                out.push_str(PAGE_BREAK);
                out.push_str(&line[body.len()..]);
                continue;
            }
            None => {}
        }
        out.push_str(line);
    }
    out
}

/// `hard_breaks` : un simple retour à la ligne dans le fichier est conservé à l'affichage
/// (en Markdown pur, il ne fait qu'un espace : il faut une ligne vide ou deux espaces).
pub fn to_html(source: &str, hard_breaks: bool) -> String {
    let mut options = options();
    options.render.hardbreaks = hard_breaks;
    let html = markdown_to_html(&prepare(source), &options);
    let html = html
        .replace(PAGE_BREAK, "<div class=\"page-break\" aria-hidden=\"true\"></div>")
        .replace(BLANK_LINE, "<div class=\"blank-line\" aria-hidden=\"true\"></div>");
    sanitizer().clean(&html).to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn html_of(source: &str) -> String {
        to_html(source, false)
    }

    #[test]
    fn hard_breaks_keep_single_line_breaks() {
        let src = "Adhésion\nFamille\n\nAutre";
        assert!(to_html(src, true).contains("Adhésion<br"), "{}", to_html(src, true));
        assert!(!html_of(src).contains("<br"), "{}", html_of(src));
    }

    #[test]
    fn github_features() {
        let html = html_of("# Titre\n\n- [x] fait\n\n| a | b |\n|---|---|\n| 1 | 2 |\n\n> [!TIP]\n> astuce\n");
        assert!(html.contains("id=\"user-content-titre\""), "{html}");
        assert!(html.contains("type=\"checkbox\""), "{html}");
        assert!(html.contains("<table"), "{html}");
        assert!(html.contains("markdown-alert-tip"), "{html}");
        assert!(html.contains("data-sourcepos=\"1:1-1:7\""), "{html}");
    }

    #[test]
    fn scripts_are_removed() {
        let html = html_of("<script>alert(1)</script>\n\n<img src=x onerror=\"alert(1)\">\n\n[x](javascript:alert(1))\n");
        assert!(!html.contains("<script"), "{html}");
        assert!(!html.contains("onerror"), "{html}");
        assert!(!html.contains("javascript:"), "{html}");
    }

    #[test]
    fn page_breaks() {
        let html = html_of("Un\n\n<!-- saut de page -->\n\nDeux\n\\newpage\n## Trois\n\n```\n\\pagebreak\n```\n");
        assert_eq!(html.matches("class=\"page-break\"").count(), 2, "{html}");
        assert!(html.contains("\\pagebreak"), "{html}");
        assert!(html.contains("data-sourcepos=\"7:1-7:8\""), "{html}");
    }

    #[test]
    fn extra_blank_lines_are_kept() {
        // 1 ligne vide : rien ; 3 lignes vides : 2 lignes d'espace ; dans le code : intact.
        let html = html_of("Un\n\nDeux\n\n\n\n## Trois\n\n```\n\n\n```\n- a\n\n\n  suite\n\n\n");
        assert_eq!(html.matches("class=\"blank-line\"").count(), 2, "{html}");
        assert!(html.contains("data-sourcepos=\"7:1-7:8\""), "{html}");
        assert!(html.contains("<p data-sourcepos=\"16:3-16:7\">suite</p>"), "{html}");
    }

    #[test]
    fn blank_lines_inside_comments_and_pre_are_untouched() {
        let html = html_of("Avant\n\n<!-- note\n\n\n\nfin de note -->\n\n<pre>\na\n\n\n\nb\n</pre>\n\nAprès\n");
        assert!(!html.contains("blank-line"), "{html}");
        assert!(!html.contains("fin de note"), "{html}");
    }

    #[test]
    fn ids_are_prefixed() {
        let html = html_of("# Editor\n\n<span id=\"btn-save\">x</span>\n");
        assert!(html.contains("id=\"user-content-editor\""), "{html}");
        assert!(html.contains("id=\"user-content-btn-save\""), "{html}");
    }

    #[test]
    fn keeps_harmless_html_and_relative_links() {
        let html = html_of("<details><summary>Plus</summary>texte</details>\n\n[doc](autre.md#partie) ![i](img/a.png)\n");
        assert!(html.contains("<details>"), "{html}");
        assert!(html.contains("href=\"autre.md#partie\""), "{html}");
        assert!(html.contains("src=\"img/a.png\""), "{html}");
    }
}
