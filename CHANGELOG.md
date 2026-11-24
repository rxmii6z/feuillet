# Changelog

## 1.0 — first public release

The software is now called **Feuillet** (formerly “Visionneuse Markdown”) and becomes
free software under the GPL v3 license.

**New**
- English and French interface, following the Windows display language; can be changed
  from the ⋯ menu → Language
- A4 page mode: the preview is split into pages exactly like the PDF, with “Page n”
  markers in the editor
- Blank lines in the file add space: you adjust the layout simply by adding blank lines
- Line breaks in the file are kept in the preview and the PDF (⋯ menu → “Keep line breaks”,
  on by default; turn it off for standard Markdown)
- PDF export (A4, 20 mm margins) and printing
- New logo
- Bilingual installer (English / French)

**Reliability**
- UTF-8, UTF-16 and Windows-1252 encodings detected and preserved when saving
- Safe saving: a file is never left half-written
- Binary files and files over 20 MB are refused
- A link can no longer launch a program (`.exe`, `.bat`, `.ps1`…)
- Document ids are prefixed (`user-content-`, like on GitHub): a heading can no longer
  interfere with the interface
- Damaged settings or a startup error: the window always opens
- Only one “Save changes?” prompt at a time; unexpected errors are shown in the status bar

**Note**: because of the name change, settings from the previous version (theme, zoom,
recent files) are not carried over.

## 0.2

- Moved to Tauri 2: Windows 11 interface (Mica, Fluent), CodeMirror editor,
  Read / Edit / Side-by-side modes

## 0.1

- First Markdown viewer (egui)
