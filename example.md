---
title: Discover Feuillet
author: Me
---

# Welcome to Feuillet

This file shows what Feuillet can display. **Bold**, *italic*,
~~strikethrough~~ and `inline code` all work, as do [external links](https://www.rust-lang.org)
and [internal links to a section](#tables).

> [!TIP]
> Press **Ctrl+E** to edit this document. The **A4** button splits the preview into pages,
> exactly like the PDF (⋯ menu → *Export to PDF*). To push what follows onto the next page,
> just add blank lines.

## Lists

- First item
- Second item
  - Sub-item
  - Another sub-item
1. One
2. Two
3. Three

### Task list

- [x] Install Feuillet
- [x] Write my first document
- [ ] Open all my `.md` files

## Tables

| Language | Typing   | Score |
|----------|----------|------:|
| Rust     | Static   |    10 |
| Python   | Dynamic  |     8 |
| C        | Static   |     7 |

## Code

```rust
fn main() {
    let message = "Hello, world!";
    println!("{message}");
}
```

```python
def hello(name: str) -> str:
    return f"Hello {name}!"
```

## Quotes

> “Markdown is simple and readable.”
>
> — Someone very wise

> [!NOTE]
> GitHub-style alerts are supported too.

> [!WARNING]
> Careful, this is a warning.

## Footnotes

Here is a sentence with a footnote[^1].

[^1]: And here is the footnote itself.

---

Underlined heading
------------------

End of the document. Back to the [top of the page](#welcome-to-feuillet).
