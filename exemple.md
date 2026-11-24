---
title: Découvrir Feuillet
auteur: Moi
---

# Bienvenue dans Feuillet

Ce fichier montre ce que Feuillet sait afficher. Le **gras**, l'*italique*,
le ~~barré~~ et le `code en ligne` fonctionnent, tout comme les [liens externes](https://www.rust-lang.org)
et les [liens internes vers une section](#les-tableaux).

> [!TIP]
> Appuie sur **Ctrl+E** pour éditer ce document. Le bouton **A4** découpe l'aperçu en pages,
> exactement comme dans le PDF (menu ⋯ → *Exporter en PDF*). Pour pousser la suite sur la page
> suivante, il suffit de sauter des lignes.

## Les listes

- Premier élément
- Deuxième élément
  - Sous-élément
  - Autre sous-élément
1. Un
2. Deux
3. Trois

### Liste de tâches

- [x] Installer Rust
- [x] Écrire mon premier document
- [ ] Ouvrir tous mes fichiers `.md`

## Les tableaux

| Langage | Typage   | Note |
|---------|----------|-----:|
| Rust    | Statique |   10 |
| Python  | Dynamique|    8 |
| C       | Statique |    7 |

## Le code

```rust
fn main() {
    let message = "Bonjour le monde !";
    println!("{message}");
}
```

```python
def bonjour(nom: str) -> str:
    return f"Bonjour {nom} !"
```

## Les citations

> « Le Markdown, c'est simple et lisible. »
>
> — Quelqu'un de très sage

> [!NOTE]
> Les encadrés façon GitHub sont aussi pris en charge.

> [!WARNING]
> Attention, ceci est un avertissement.

## Notes de bas de page

Voici une phrase avec une note[^1].

[^1]: Et voici la note en question.

---

Sous-titre souligné
-------------------

Fin du document. Retour en [haut de la page](#bienvenue-dans-feuillet).
