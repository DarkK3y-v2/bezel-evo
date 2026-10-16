//! Font files shipped next to the themes (`themes/fonts/`), read once so a
//! renderer can be built with them ([`crate::SkiaRenderer::with_fonts`]),
//! and the families Bezel ships embedded in the binary ([`SHIPPED_FONTS`]),
//! so they never depend on where the themes folder is.

use std::fs;
use std::io::Read;
use std::path::Path;
use std::path::PathBuf;

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
pub const MAX_FONT_FILE: u64 = 32 * 1024 * 1024;

/// File extensions of the font formats the renderer reads.
const EXTENSIONS: [&str; 3] = ["ttf", "otf", "ttc"];

fn is_font(path: &Path) -> bool {
    path.extension()
        .and_then(|e| e.to_str())
        .is_some_and(|e| EXTENSIONS.iter().any(|x| x.eq_ignore_ascii_case(e)))
}

pub(crate) fn read_font(path: &Path) -> Option<Vec<u8>> {
    let meta = fs::symlink_metadata(path).ok()?;
    if !meta.is_file() || meta.len() > MAX_FONT_FILE {
        tracing::warn!(target: "bezel_render", "{} skipped: not a font file of at most 32 MiB", path.display());
        return None;
    }
    match fs::File::open(path).and_then(|f| {
        let mut bytes = Vec::new();
        f.take(MAX_FONT_FILE + 1).read_to_end(&mut bytes)?;
        Ok(bytes)
    }) {
        Ok(bytes) if valid_font(&bytes) => Some(bytes),
        Ok(_) => {
            tracing::warn!(target: "bezel_render", "{} skipped: invalid or oversized font", path.display());
            None
        }
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
    if paths.len() > 128 {
        tracing::warn!(target: "bezel_render", "{}: only the first 128 font files are loaded", dir.display());
    }
    let mut total = 0;
    paths.iter().take(128).filter_map(|p| {
        let bytes = read_font(p)?;
        total += bytes.len();
        if total > 256 * 1024 * 1024 {
            tracing::warn!(target: "bezel_render", "font folder exceeds 256 MiB: {}", dir.display());
            return None;
        }
        Some(bytes)
    }).collect()
}

/// The shared per-user font folder used by Studio and Light. No executable is opened.
pub fn user_fonts_directory() -> Option<PathBuf> {
    std::env::var_os("APPDATA")
        .filter(|p| !p.is_empty())
        .map(|p| PathBuf::from(p).join("Bezel Evo").join("fonts"))
}

/// Validate the container and every face before handing data to fontdb/WebView.
pub fn valid_font(bytes: &[u8]) -> bool {
    if bytes.len() as u64 > MAX_FONT_FILE {
        return false;
    }
    let count = ttf_parser::fonts_in_collection(bytes).unwrap_or(1);
    (1..=256).contains(&count) && (0..count).all(|i| ttf_parser::Face::parse(bytes, i).is_ok())
}

/// Metadata signature; sorted, bounded and without following symlinks.
pub(crate) fn folder_stamp(dir: &Path) -> Vec<(PathBuf, u64, Option<std::time::SystemTime>)> {
    let Ok(entries) = fs::read_dir(dir) else {
        return Vec::new();
    };
    let mut paths: Vec<_> = entries
        .filter_map(Result::ok)
        .map(|e| e.path())
        .filter(|p| is_font(p))
        .collect();
    paths.sort();
    paths
        .into_iter()
        .take(128)
        .filter_map(|p| {
            let m = fs::symlink_metadata(&p).ok()?;
            Some((p, m.len(), m.modified().ok()))
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::testkit::FONT;

    #[test]
    fn invalid_and_oversized_files_are_rejected_before_loading() {
        assert!(!valid_font(b"not a font"));
        assert!(!valid_font(b"ttcf"));
        assert!(valid_font(FONT));
        let dir = std::env::temp_dir().join(format!("bezel-font-limit-{}", std::process::id()));
        fs::create_dir_all(&dir).unwrap();
        let path = dir.join("large.ttf");
        fs::File::create(&path)
            .unwrap()
            .set_len(MAX_FONT_FILE + 1)
            .unwrap();
        assert!(font_files(&dir).is_empty());
        fs::remove_dir_all(dir).unwrap();
    }

    #[test]
    fn reads_the_font_files_of_a_folder() {
        let dir = std::env::temp_dir().join(format!("bezel-fonts-{}", std::process::id()));
        fs::create_dir_all(dir.join("nested.ttf")).unwrap();
        fs::write(dir.join("b.TTF"), FONT).unwrap();
        fs::write(dir.join("a.otf"), b"a").unwrap();
        fs::write(dir.join("notes.txt"), b"not a font").unwrap();
        let fonts = font_files(&dir);
        assert_eq!(fonts, vec![FONT.to_vec()]);
        assert!(font_files(&dir.join("missing")).is_empty());
        let _ = fs::remove_dir_all(dir);
    }
}
