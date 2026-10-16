//! Font files shipped next to the themes (`themes/fonts/`), read once so a
//! renderer can be built with them ([`crate::SkiaRenderer::with_fonts`]),
//! and the families Bezel ships embedded in the binary ([`SHIPPED_FONTS`]),
//! so they never depend on where the themes folder is.

use std::fs;
use std::path::Path;

/// The font files Bezel ships (`themes/fonts/`, SIL OFL 1.1, licences in
/// that folder): Inter (400, 500, 600, 700) and JetBrains Mono (400, 500,
/// 700). A renderer that loads the installed fonts loads these first.
pub const SHIPPED_FONTS: [&[u8]; 7] = [
    include_bytes!("../../../themes/fonts/Inter-Regular.ttf"),
    include_bytes!("../../../themes/fonts/Inter-Medium.ttf"),
    include_bytes!("../../../themes/fonts/Inter-SemiBold.ttf"),
    include_bytes!("../../../themes/fonts/Inter-Bold.ttf"),
    include_bytes!("../../../themes/fonts/JetBrainsMono-Regular.otf"),
    include_bytes!("../../../themes/fonts/JetBrainsMono-Medium.otf"),
    include_bytes!("../../../themes/fonts/JetBrainsMono-Bold.otf"),
];

/// Whether `bytes` is one of [`SHIPPED_FONTS`] (a copy read from a folder).
pub(crate) fn is_shipped(bytes: &[u8]) -> bool {
    SHIPPED_FONTS.contains(&bytes)
}

/// Largest font file read, bytes.
const MAX_FONT_FILE: u64 = 32 * 1024 * 1024;

/// File extensions of the font formats the renderer reads.
const EXTENSIONS: [&str; 3] = ["ttf", "otf", "ttc"];

fn is_font(path: &Path) -> bool {
    path.extension()
        .and_then(|e| e.to_str())
        .is_some_and(|e| EXTENSIONS.iter().any(|x| x.eq_ignore_ascii_case(e)))
}

fn read_font(path: &Path) -> Option<Vec<u8>> {
    let meta = fs::metadata(path).ok()?;
    if !meta.is_file() || meta.len() > MAX_FONT_FILE {
        tracing::warn!(target: "bezel_render", "{} skipped: not a font file of at most 32 MiB", path.display());
        return None;
    }
    match fs::read(path) {
        Ok(bytes) => Some(bytes),
        Err(e) => {
            tracing::warn!(target: "bezel_render", "{}: {e}", path.display());
            None
        }
    }
}

/// The bytes of every TTF, OTF and TTC file directly inside `dir`, in file
/// name order. A missing folder gives none; unreadable files are skipped
/// with a warning.
pub fn font_files(dir: &Path) -> Vec<Vec<u8>> {
    let Ok(entries) = fs::read_dir(dir) else {
        return Vec::new();
    };
    let mut paths: Vec<_> = entries
        .filter_map(|e| e.ok().map(|e| e.path()))
        .filter(|p| is_font(p))
        .collect();
    paths.sort();
    paths.iter().filter_map(|p| read_font(p)).collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::testkit::FONT;

    #[test]
    fn reads_the_font_files_of_a_folder() {
        let dir = std::env::temp_dir().join(format!("bezel-fonts-{}", std::process::id()));
        fs::create_dir_all(dir.join("nested.ttf")).unwrap();
        fs::write(dir.join("b.TTF"), FONT).unwrap();
        fs::write(dir.join("a.otf"), b"a").unwrap();
        fs::write(dir.join("notes.txt"), b"not a font").unwrap();
        let fonts = font_files(&dir);
        assert_eq!(fonts, vec![b"a".to_vec(), FONT.to_vec()]);
        assert!(font_files(&dir.join("missing")).is_empty());
        let _ = fs::remove_dir_all(dir);
    }
}
