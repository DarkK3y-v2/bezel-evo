//! The tray icon's pictures (D-2026-10-09-studio-redesign-fidelity-11): a
//! simplified B drawn pixel by pixel at 16, 20, 24 and 32 px by
//! `scripts/build-icons.mjs`, never the app icon reduced. The one place
//! that picks the picture for a display's scale: Studio's tray uses this
//! module, and Light (`crates/bezel-cli/src/light_tray.rs`) includes this
//! same file by path.

/// The edges the tray icon is drawn at, pixels, smallest first: what the
/// system draws a small icon at for 100, 125, 150 and 200 % display scale.
pub const TRAY_EDGES: [u32; 4] = [16, 20, 24, 32];

/// The PNG of each edge of [`TRAY_EDGES`], in the same order.
const TRAY_PNGS: [&[u8]; 4] = [
    include_bytes!("../icons/tray-16.png"),
    include_bytes!("../icons/tray-20.png"),
    include_bytes!("../icons/tray-24.png"),
    include_bytes!("../icons/tray-32.png"),
];

/// The edge of the tray icon for a display at `scale` (1.0 = 100 %): the
/// smallest drawn edge at least the 16 px the system scales (a picture the
/// system reduces stays sharper than one it enlarges); the largest beyond.
/// A scale that is not a positive number counts as 1.0.
pub fn tray_edge(scale: f64) -> u32 {
    let scale = if scale.is_finite() && scale > 0.0 {
        scale
    } else {
        1.0
    };
    let wanted = 16.0 * scale;
    TRAY_EDGES
        .into_iter()
        .find(|edge| f64::from(*edge) + 0.5 >= wanted)
        .unwrap_or(TRAY_EDGES[TRAY_EDGES.len() - 1])
}

/// The PNG of the tray icon for a display at `scale` ([`tray_edge`]).
pub fn tray_png(scale: f64) -> &'static [u8] {
    let edge = tray_edge(scale);
    TRAY_EDGES
        .iter()
        .position(|e| *e == edge)
        .map_or(TRAY_PNGS[0], |i| TRAY_PNGS[i])
}

/// The tray icon for a display at `scale` as straight RGBA, with its width
/// and height; `None` when its PNG cannot be read.
pub fn tray_rgba(scale: f64) -> Option<(Vec<u8>, u32, u32)> {
    let picture = image::load_from_memory(tray_png(scale)).ok()?.into_rgba8();
    let (width, height) = picture.dimensions();
    Some((picture.into_raw(), width, height))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn each_display_scale_gets_the_edge_the_system_draws() {
        assert_eq!(tray_edge(1.0), 16);
        assert_eq!(tray_edge(1.25), 20);
        assert_eq!(tray_edge(1.5), 24);
        assert_eq!(tray_edge(1.75), 32, "reduced, not enlarged");
        assert_eq!(tray_edge(2.0), 32);
        assert_eq!(tray_edge(3.0), 32, "the largest beyond");
        assert_eq!(tray_edge(0.5), 16);
        for odd in [0.0, -1.0, f64::NAN, f64::INFINITY] {
            assert_eq!(tray_edge(odd), 16, "{odd}");
        }
    }

    #[test]
    fn every_picture_is_its_edge_square() {
        for (scale, edge) in [(1.0, 16), (1.25, 20), (1.5, 24), (2.0, 32)] {
            let (rgba, width, height) = tray_rgba(scale).unwrap();
            assert_eq!((width, height), (edge, edge));
            assert_eq!(rgba.len(), (edge * edge * 4) as usize);
            assert_eq!(rgba[3], 0, "transparent outside the rounded tile");
        }
    }
}
