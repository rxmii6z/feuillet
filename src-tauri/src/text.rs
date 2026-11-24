// SPDX-License-Identifier: GPL-3.0-or-later
// Feuillet — éditeur Markdown pour Windows 11. Copyright (C) 2026 les contributeurs de Feuillet.

//! Lecture et écriture des fichiers texte sans rien abîmer :
//! - encodage reconnu (UTF-8 avec ou sans BOM, UTF-16, ou Windows-1252 pour les
//!   vieux fichiers Windows à accents) et conservé à l'enregistrement ;
//! - fichiers binaires refusés (une image ouverte par erreur ne doit pas être réécrite) ;
//! - enregistrement « atomique » : fichier temporaire puis remplacement, pour qu'une
//!   coupure ou un disque plein ne laisse jamais un fichier à moitié écrit.

use serde::{Deserialize, Serialize};
use std::io::Write;
use std::path::Path;

/// Taille maximale ouverte : au-delà, l'aperçu deviendrait inutilisable.
pub const MAX_SIZE: u64 = 20 * 1024 * 1024;

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Encoding {
    Utf8,
    Utf16le,
    Utf16be,
    Windows1252,
}

#[derive(Debug, PartialEq)]
pub struct Decoded {
    pub text: String,
    pub encoding: Encoding,
    pub bom: bool,
}

/// Octets 0x80–0x9F de Windows-1252 (les autres valent leur code Unicode).
const CP1252_HIGH: [char; 32] = [
    '\u{20AC}', '\u{81}', '\u{201A}', '\u{0192}', '\u{201E}', '\u{2026}', '\u{2020}', '\u{2021}',
    '\u{02C6}', '\u{2030}', '\u{0160}', '\u{2039}', '\u{0152}', '\u{8D}', '\u{017D}', '\u{8F}',
    '\u{90}', '\u{2018}', '\u{2019}', '\u{201C}', '\u{201D}', '\u{2022}', '\u{2013}', '\u{2014}',
    '\u{02DC}', '\u{2122}', '\u{0161}', '\u{203A}', '\u{0153}', '\u{9D}', '\u{017E}', '\u{0178}',
];

pub fn decode(bytes: &[u8]) -> Result<Decoded, String> {
    if let Some(rest) = bytes.strip_prefix(&[0xEF, 0xBB, 0xBF]) {
        return Ok(Decoded { text: String::from_utf8_lossy(rest).into_owned(), encoding: Encoding::Utf8, bom: true });
    }
    if let Some(rest) = bytes.strip_prefix(&[0xFF, 0xFE]) {
        return Ok(Decoded { text: utf16(rest, u16::from_le_bytes), encoding: Encoding::Utf16le, bom: true });
    }
    if let Some(rest) = bytes.strip_prefix(&[0xFE, 0xFF]) {
        return Ok(Decoded { text: utf16(rest, u16::from_be_bytes), encoding: Encoding::Utf16be, bom: true });
    }
    if bytes.contains(&0) {
        return Err(tr!("ce fichier ne semble pas être un fichier texte", "this does not look like a text file"));
    }
    match std::str::from_utf8(bytes) {
        Ok(s) => Ok(Decoded { text: s.to_owned(), encoding: Encoding::Utf8, bom: false }),
        Err(_) => Ok(Decoded {
            text: bytes
                .iter()
                .map(|&b| if (0x80..0xA0).contains(&b) { CP1252_HIGH[(b - 0x80) as usize] } else { b as char })
                .collect(),
            encoding: Encoding::Windows1252,
            bom: false,
        }),
    }
}

fn utf16(bytes: &[u8], read: fn([u8; 2]) -> u16) -> String {
    let units: Vec<u16> = bytes.chunks_exact(2).map(|c| read([c[0], c[1]])).collect();
    String::from_utf16_lossy(&units)
}

/// Encode `text`. Si un caractère n'existe pas en Windows-1252 (emoji…), on passe en
/// UTF-8 avec BOM plutôt que de le perdre : l'encodage réellement utilisé est renvoyé.
pub fn encode(text: &str, encoding: Encoding, bom: bool) -> (Vec<u8>, Encoding, bool) {
    match encoding {
        Encoding::Utf8 => {
            let mut out = Vec::with_capacity(text.len() + 3);
            if bom {
                out.extend_from_slice(&[0xEF, 0xBB, 0xBF]);
            }
            out.extend_from_slice(text.as_bytes());
            (out, Encoding::Utf8, bom)
        }
        Encoding::Utf16le | Encoding::Utf16be => {
            let le = encoding == Encoding::Utf16le;
            let mut out = Vec::with_capacity(text.len() * 2 + 2);
            out.extend_from_slice(if le { &[0xFF, 0xFE] } else { &[0xFE, 0xFF] });
            for unit in text.encode_utf16() {
                out.extend_from_slice(&if le { unit.to_le_bytes() } else { unit.to_be_bytes() });
            }
            (out, encoding, true)
        }
        Encoding::Windows1252 => {
            let bytes: Option<Vec<u8>> = text
                .chars()
                .map(|c| match c as u32 {
                    n @ (0..=0x7F | 0xA0..=0xFF) => Some(n as u8),
                    _ => CP1252_HIGH.iter().position(|&h| h == c).map(|i| 0x80 + i as u8),
                })
                .collect();
            match bytes {
                Some(b) => (b, Encoding::Windows1252, false),
                None => encode(text, Encoding::Utf8, true),
            }
        }
    }
}

/// Écrit dans un fichier temporaire voisin, puis remplace le fichier d'un coup.
/// Si le remplacement est impossible (fichier verrouillé par un autre programme,
/// lien symbolique…), on écrit directement dans le fichier.
pub fn write_safely(path: &Path, bytes: &[u8]) -> std::io::Result<()> {
    let is_link = std::fs::symlink_metadata(path).map(|m| m.file_type().is_symlink()).unwrap_or(false);
    if !is_link {
        if let (Some(dir), Some(name)) = (path.parent(), path.file_name()) {
            let tmp = dir.join(format!(".{}.~enregistrement", name.to_string_lossy()));
            let written = (|| {
                let mut f = std::fs::File::create(&tmp)?;
                f.write_all(bytes)?;
                f.sync_all()
            })();
            if written.is_ok() && std::fs::rename(&tmp, path).is_ok() {
                return Ok(());
            }
            let _ = std::fs::remove_file(&tmp);
        }
    }
    std::fs::write(path, bytes)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn utf8_with_and_without_bom() {
        let d = decode("é".as_bytes()).unwrap();
        assert_eq!((d.text.as_str(), d.encoding, d.bom), ("é", Encoding::Utf8, false));
        let d = decode(b"\xEF\xBB\xBFabc").unwrap();
        assert_eq!((d.text.as_str(), d.bom), ("abc", true));
        assert_eq!(encode("abc", Encoding::Utf8, true).0, b"\xEF\xBB\xBFabc");
    }

    #[test]
    fn windows_1252_round_trip() {
        let bytes = b"\xC9t\xE9 \x80 \x93ok\x94 \x81";
        let d = decode(bytes).unwrap();
        assert_eq!(d.encoding, Encoding::Windows1252);
        assert_eq!(d.text, "Été € “ok” \u{81}");
        assert_eq!(encode(&d.text, d.encoding, d.bom).0, bytes);
        // Caractère impossible en Windows-1252 : passage en UTF-8 (avec BOM), rien n'est perdu.
        let (out, enc, bom) = encode("é 😀", Encoding::Windows1252, false);
        assert_eq!((enc, bom), (Encoding::Utf8, true));
        assert_eq!(out, "\u{feff}é 😀".as_bytes());
    }

    #[test]
    fn utf16_round_trip() {
        let (bytes, _, _) = encode("Aé😀", Encoding::Utf16le, true);
        let d = decode(&bytes).unwrap();
        assert_eq!((d.text.as_str(), d.encoding), ("Aé😀", Encoding::Utf16le));
        let (bytes, _, _) = encode("Aé", Encoding::Utf16be, true);
        assert_eq!(decode(&bytes).unwrap().text, "Aé");
    }

    #[test]
    fn binary_is_refused() {
        assert!(decode(b"\x89PNG\r\n\x1a\n\0\0\0\rIHDR").is_err());
    }

    #[test]
    fn safe_write_replaces_content() {
        let dir = std::env::temp_dir().join(format!("feuillet-test-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let file = dir.join("a.md");
        std::fs::write(&file, "ancien contenu plus long").unwrap();
        write_safely(&file, b"nouveau").unwrap();
        assert_eq!(std::fs::read(&file).unwrap(), b"nouveau");
        assert_eq!(std::fs::read_dir(&dir).unwrap().count(), 1, "pas de fichier temporaire oublié");
        std::fs::remove_dir_all(&dir).unwrap();
    }
}
