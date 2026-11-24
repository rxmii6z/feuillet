// SPDX-License-Identifier: GPL-3.0-or-later
// Feuillet — éditeur Markdown pour Windows 11. Copyright (C) 2026 les contributeurs de Feuillet.

//! Outil de test : `cargo run --example render < fichier.md` affiche le HTML produit.
#[path = "../src/markdown.rs"]
mod markdown;

fn main() {
    let mut src = String::new();
    std::io::Read::read_to_string(&mut std::io::stdin(), &mut src).unwrap();
    print!("{}", markdown::to_html(&src, false));
}
