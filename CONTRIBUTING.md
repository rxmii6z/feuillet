# Contributing to Feuillet

Thank you for your interest! All contributions are welcome.

## Reporting a bug

Open an [issue](../../issues) with:
- your Feuillet version (bottom of the ⋯ menu) and Windows version;
- what you did, what happened, and what you expected;
- if possible, a small `.md` file that reproduces the problem.

## Suggesting an idea

Open an issue to discuss it before coding a large feature: this avoids working on
something that won't be merged. Feuillet aims to stay simple, fast, and true to the
spirit of Windows 11.

## Translations

The interface is available in English and French. To add a language, follow
“Adding a language” in the [README](README.md#adding-a-language). Fixes to existing
translations are just as welcome.

## Submitting code

1. Fork the repository and create a branch (`git checkout -b my-fix`).
2. Build and test (see “Building from source” in the [README](README.md)):
   ```powershell
   cd src-tauri
   cargo test
   ```
3. Check your change in the app (`npx tauri dev`), in both light and dark themes, in both
   languages, and in A4 mode if you touch the preview.
4. Open a pull request explaining what you change and why.

### Conventions

- **Interface text**: never hard-code a user-visible string. Add a key to both the `fr`
  and `en` dictionaries in `src/i18n.js` and use `t('key')` (or a `data-i18n*` attribute
  in `index.html`). In Rust, use the `tr!("français", "English")` macro.
- **Code comments** are mostly in French (the project's original language); comments in
  English are fine for new code.
- **Rust**: run `cargo fmt` before submitting; no `unwrap()` on data that comes from a
  file or from the user.
- **JavaScript**: ES modules, no framework; one file per topic in `src/`.
- **Security**: all HTML coming from a document goes through the sanitizer in
  `markdown.rs`. Never insert document content into the page without it.
- **User files**: never damage them. Encoding, line endings and BOM must be preserved,
  and saving goes through `text::write_safely`.
- Add a test in `markdown.rs` or `text.rs` when you fix a rendering or file-reading bug.

## License

By submitting a contribution, you agree that it will be distributed under the project's
license, the [GPL v3 or later](LICENSE). Each source file starts with:

```
// SPDX-License-Identifier: GPL-3.0-or-later
```
