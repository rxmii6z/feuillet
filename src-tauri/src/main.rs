// SPDX-License-Identifier: GPL-3.0-or-later
// Feuillet — éditeur Markdown pour Windows 11. Copyright (C) 2026 les contributeurs de Feuillet.

// En version release, pas de fenêtre console noire derrière l'application.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::sync::atomic::{AtomicBool, Ordering};

/// Langue des messages renvoyés à l'interface (choisie par l'interface, voir `set_language`).
static ENGLISH: AtomicBool = AtomicBool::new(false);

fn english() -> bool {
    ENGLISH.load(Ordering::Relaxed)
}

/// Message en français ou en anglais : `tr!("texte {x}", "text {x}", x = …)`.
macro_rules! tr {
    ($fr:literal, $en:literal $(, $($arg:tt)*)?) => {
        if $crate::english() { format!($en $(, $($arg)*)?) } else { format!($fr $(, $($arg)*)?) }
    };
}

mod markdown;
mod text;

use serde::Serialize;
use std::path::{Path, PathBuf};
use std::time::UNIX_EPOCH;
use tauri_plugin_opener::OpenerExt;
use text::Encoding;

const MD_EXTENSIONS: &[&str] = &["md", "markdown", "mdown", "mkd", "mkdn", "mdx", "txt"];

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct FileData {
    path: String,
    /// Texte avec des fins de ligne `\n` et sans BOM : c'est ce qu'on affiche et édite.
    content: String,
    /// Fins de ligne Windows, encodage et BOM d'origine : on les remet à l'enregistrement.
    crlf: bool,
    encoding: Encoding,
    bom: bool,
    mtime: Option<u64>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct Saved {
    path: String,
    mtime: Option<u64>,
    /// Encodage réellement utilisé (peut passer de Windows-1252 à UTF-8, voir `text::encode`).
    encoding: Encoding,
    bom: bool,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct Link {
    path: String,
    exists: bool,
    is_markdown: bool,
}

/// Chemin absolu, sans le préfixe `\\?\` que Windows ajoute avec `canonicalize`.
fn canonical(path: &Path) -> PathBuf {
    let Ok(abs) = std::fs::canonicalize(path) else { return path.to_path_buf() };
    let s = abs.to_string_lossy();
    if let Some(rest) = s.strip_prefix(r"\\?\UNC\") {
        PathBuf::from(format!(r"\\{rest}"))
    } else if let Some(rest) = s.strip_prefix(r"\\?\") {
        PathBuf::from(rest)
    } else {
        abs
    }
}

fn mtime(path: &Path) -> Option<u64> {
    let modified = std::fs::metadata(path).ok()?.modified().ok()?;
    Some(modified.duration_since(UNIX_EPOCH).ok()?.as_millis() as u64)
}

fn is_markdown(path: &Path) -> bool {
    path.extension()
        .and_then(|e| e.to_str())
        .is_some_and(|e| MD_EXTENSIONS.contains(&e.to_ascii_lowercase().as_str()))
}

/// Fichier passé en argument (double-clic sur un .md dans l'Explorateur).
#[tauri::command]
fn initial_file() -> Option<String> {
    std::env::args_os()
        .skip(1)
        .map(PathBuf::from)
        .find(|p| p.is_file())
        .map(|p| canonical(&p).display().to_string())
}

#[tauri::command]
async fn read_file(path: String) -> Result<FileData, String> {
    let path = canonical(Path::new(&path));
    let shown = path.display();
    let fail = |e: String| tr!("Impossible d'ouvrir « {shown} » : {e}", "Cannot open “{shown}”: {e}");
    let meta = std::fs::metadata(&path).map_err(|e| fail(e.to_string()))?;
    if meta.is_dir() {
        return Err(fail(tr!("c'est un dossier", "it is a folder")));
    }
    if meta.len() > text::MAX_SIZE {
        return Err(fail(tr!("fichier trop volumineux ({} Mo, maximum {} Mo)", "file too large ({} MB, maximum {} MB)", meta.len() >> 20, text::MAX_SIZE >> 20)));
    }
    let bytes = std::fs::read(&path).map_err(|e| fail(e.to_string()))?;
    let decoded = text::decode(&bytes).map_err(fail)?;
    // CodeMirror et l'aperçu travaillent avec des \n ; un \r isolé (vieux Mac) devient aussi \n.
    let crlf = decoded.text.contains("\r\n");
    let content = decoded.text.replace("\r\n", "\n").replace('\r', "\n");
    Ok(FileData {
        crlf,
        encoding: decoded.encoding,
        bom: decoded.bom,
        mtime: mtime(&path),
        path: path.display().to_string(),
        content,
    })
}

#[tauri::command]
async fn save_file(path: String, content: String, crlf: bool, encoding: Option<Encoding>, bom: bool) -> Result<Saved, String> {
    let path = PathBuf::from(path);
    let out = if crlf { content.replace('\n', "\r\n") } else { content };
    let (bytes, encoding, bom) = text::encode(&out, encoding.unwrap_or(Encoding::Utf8), bom);
    text::write_safely(&path, &bytes).map_err(|e| tr!("Impossible d'enregistrer « {} » : {e}", "Cannot save “{}”: {e}", path.display()))?;
    let path = canonical(&path);
    Ok(Saved { mtime: mtime(&path), path: path.display().to_string(), encoding, bom })
}

#[tauri::command]
fn file_mtime(path: String) -> Option<u64> {
    mtime(Path::new(&path))
}

#[tauri::command]
async fn render(source: String, hard_breaks: Option<bool>) -> Result<String, String> {
    // Un document piégé ne doit jamais faire tomber l'application.
    std::panic::catch_unwind(|| markdown::to_html(&source, hard_breaks.unwrap_or(true)))
        .map_err(|_| tr!("Ce document n'a pas pu être affiché (contenu non pris en charge).", "This document could not be displayed (unsupported content)."))
}

/// Fichiers qui lanceraient un programme : un lien dans un .md ne doit pas pouvoir les ouvrir.
const RISKY_EXTENSIONS: &[&str] = &[
    "exe", "com", "bat", "cmd", "msi", "msix", "msp", "ps1", "psm1", "vbs", "vbe", "js", "jse", "wsf", "wsh",
    "scr", "pif", "lnk", "url", "hta", "cpl", "reg", "jar", "appref-ms", "application", "msc", "scf", "inf",
    "gadget", "settingcontent-ms", "library-ms", "chm", "dll", "sys", "appx", "appxbundle",
];

/// Lien relatif cliqué dans le document : chemin complet et nature de la cible.
#[tauri::command]
fn resolve_link(base_dir: Option<String>, href: String) -> Link {
    let href = percent_decode(&href).replace('/', "\\");
    let target = Path::new(&href);
    let path = if target.is_absolute() {
        target.to_path_buf()
    } else {
        let base = base_dir.map(PathBuf::from).or_else(|| std::env::current_dir().ok()).unwrap_or_default();
        base.join(target)
    };
    let path = canonical(&path);
    Link {
        exists: path.exists(),
        is_markdown: path.is_file() && is_markdown(&path),
        path: path.display().to_string(),
    }
}

/// Ouvre une adresse web dans le navigateur, ou un fichier avec son application.
#[tauri::command]
fn open_external(app: tauri::AppHandle, target: String) -> Result<(), String> {
    let scheme = target
        .split_once(':')
        .map(|(s, _)| s)
        .filter(|s| s.len() > 1 && s.chars().all(|c| c.is_ascii_alphanumeric() || "+.-".contains(c)));
    match scheme {
        Some(s) if ["http", "https", "mailto"].contains(&s.to_ascii_lowercase().as_str()) => {
            app.opener().open_url(target, None::<&str>).map_err(|e| e.to_string())
        }
        Some(s) => Err(tr!("Type de lien non pris en charge : {s}:", "Unsupported link type: {s}:")),
        None => {
            let ext = Path::new(&target).extension().and_then(|e| e.to_str()).unwrap_or("").to_ascii_lowercase();
            if RISKY_EXTENSIONS.contains(&ext.as_str()) {
                return Err(tr!("Par sécurité, les fichiers .{ext} ne sont pas ouverts depuis un document.", "For security, .{ext} files are not opened from a document."));
            }
            app.opener().open_path(target, None::<&str>).map_err(|e| e.to_string())
        }
    }
}

/// Langue de l'interface : « fr » ou « en » (les messages d'erreur suivent).
#[tauri::command]
fn set_language(lang: String) {
    ENGLISH.store(lang != "fr", Ordering::Relaxed);
}

/// Couleur d'accentuation choisie dans les paramètres de Windows (« #rrggbb »).
#[tauri::command]
fn accent_color() -> Option<String> {
    #[cfg(windows)]
    {
        use winreg::enums::HKEY_CURRENT_USER;
        let key = winreg::RegKey::predef(HKEY_CURRENT_USER).open_subkey(r"Software\Microsoft\Windows\DWM").ok()?;
        let abgr: u32 = key.get_value("AccentColor").ok()?;
        let (r, g, b) = (abgr & 0xff, (abgr >> 8) & 0xff, (abgr >> 16) & 0xff);
        Some(format!("#{r:02x}{g:02x}{b:02x}"))
    }
    #[cfg(not(windows))]
    None
}

/// Exporte la page affichée en PDF au format A4, avec le moteur d'impression de WebView2
/// (styles `@media print` de l'interface : seul le document est imprimé).
#[tauri::command]
async fn export_pdf(window: tauri::WebviewWindow, path: String) -> Result<(), String> {
    #[cfg(windows)]
    {
        use std::sync::mpsc;
        use webview2_com::Microsoft::Web::WebView2::Win32::*;
        use webview2_com::PrintToPdfCompletedHandler;
        use windows::core::{Interface, HSTRING};

        let (tx, rx) = mpsc::channel::<Result<bool, String>>();
        let tx_err = tx.clone();
        window
            .with_webview(move |pw| {
                let run = || -> windows::core::Result<()> {
                    unsafe {
                        let core = pw.controller().CoreWebView2()?;
                        let core7: ICoreWebView2_7 = core.cast()?;
                        let env6: ICoreWebView2Environment6 = pw.environment().cast()?;
                        let settings = env6.CreatePrintSettings()?;
                        // A4, marges de 20 mm (en pouces) : les mêmes que le mode pages de l'aperçu
                        // et que la règle CSS @page.
                        let margin = 20.0 / 25.4;
                        settings.SetOrientation(COREWEBVIEW2_PRINT_ORIENTATION_PORTRAIT)?;
                        settings.SetPageWidth(210.0 / 25.4)?;
                        settings.SetPageHeight(297.0 / 25.4)?;
                        settings.SetMarginTop(margin)?;
                        settings.SetMarginBottom(margin)?;
                        settings.SetMarginLeft(margin)?;
                        settings.SetMarginRight(margin)?;
                        settings.SetShouldPrintBackgrounds(true)?;
                        settings.SetShouldPrintHeaderAndFooter(false)?;
                        let handler = PrintToPdfCompletedHandler::create(Box::new(move |hr, ok| {
                            let _ = tx.send(hr.map(|_| ok).map_err(|e| e.message()));
                            Ok(())
                        }));
                        core7.PrintToPdf(&HSTRING::from(path.as_str()), &settings, &handler)
                    }
                };
                if let Err(e) = run() {
                    let _ = tx_err.send(Err(e.message()));
                }
            })
            .map_err(|e| e.to_string())?;

        let result = tauri::async_runtime::spawn_blocking(move || rx.recv_timeout(std::time::Duration::from_secs(120)))
            .await
            .map_err(|e| e.to_string())?
            .map_err(|_| tr!("L'export PDF n'a pas répondu.", "The PDF export did not respond."))?;
        match result {
            Ok(true) => Ok(()),
            Ok(false) => Err(tr!("Impossible d'écrire le fichier PDF (fichier ouvert ailleurs ?).", "Cannot write the PDF file (is it open in another program?).")),
            Err(e) => Err(tr!("Export PDF impossible : {e}", "PDF export failed: {e}")),
        }
    }
    #[cfg(not(windows))]
    {
        let _ = (window, path);
        Err(tr!("Export PDF disponible uniquement sous Windows.", "PDF export is only available on Windows."))
    }
}

fn percent_decode(s: &str) -> String {
    let bytes = s.as_bytes();
    let mut out = Vec::with_capacity(bytes.len());
    let mut i = 0;
    while i < bytes.len() {
        if bytes[i] == b'%' && i + 2 < bytes.len() {
            let hex = |b: u8| (b as char).to_digit(16);
            if let (Some(h), Some(l)) = (hex(bytes[i + 1]), hex(bytes[i + 2])) {
                out.push((h * 16 + l) as u8);
                i += 3;
                continue;
            }
        }
        out.push(bytes[i]);
        i += 1;
    }
    String::from_utf8_lossy(&out).into_owned()
}

fn main() {
    use tauri_plugin_window_state::StateFlags;
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        // Taille et position de la fenêtre mémorisées, mais pas sa visibilité :
        // elle reste cachée jusqu'au premier affichage pour éviter un flash blanc.
        .plugin(
            tauri_plugin_window_state::Builder::default()
                .with_state_flags(StateFlags::all() - StateFlags::VISIBLE)
                .build(),
        )
        .invoke_handler(tauri::generate_handler![
            initial_file,
            read_file,
            save_file,
            file_mtime,
            render,
            resolve_link,
            open_external,
            accent_color,
            set_language,
            export_pdf
        ])
        .run(tauri::generate_context!())
        .expect("impossible de démarrer l'application");
}
