//! Mirrored bars drawn within the element's clipped layer.
use crate::{layer::Layer, shape};
use bezel_core::domain::{
    clock::Language,
    spectrum::{AudioState, Spectrum, SpectrumFrame},
    theme::{BoxF, Paint, ShapeKind},
    value_color::ColorByValue,
};
pub(crate) fn draw(
    layer: &mut Layer<'_>,
    area: BoxF,
    s: &Spectrum,
    frame: &SpectrumFrame,
    paint: &Paint,
    colors: Option<&ColorByValue>,
) {
    if !s.valid() {
        return;
    }
    let count = usize::from(s.bands);
    let cell = area.width / count as f32;
    let width = (cell - s.gap).min(s.thickness).max(0.);
    let mid = area.y + area.height / 2.;
    if s.centre {
        shape::draw(
            layer,
            BoxF::new(area.x, mid - 0.5, area.width, 1.),
            ShapeKind::Rect { radius: 0. },
            Some(paint),
            None,
        );
    }
    for i in 0..count {
        let value = frame.levels.get(i).copied().unwrap_or(0.).clamp(0., 1.);
        let peak = frame.peaks.get(i).copied().unwrap_or(0.).clamp(0., 1.);
        let color = colors.map(|c| Paint::solid(c.color(Some(f64::from(value) * 100.))));
        let paint = color.as_ref().unwrap_or(paint);
        let x = area.x + i as f32 * cell + (cell - width) / 2.;
        let height = value * (area.height / 2. - 2.).max(0.);
        if height > 0. {
            shape::draw(
                layer,
                BoxF::new(x, mid - height, width, height * 2.),
                ShapeKind::Corners(s.corners),
                Some(paint),
                None,
            );
        }
        if s.peaks && peak > 0. {
            let y = peak * (area.height / 2. - 2.).max(0.);
            for top in [mid - y - 1., mid + y] {
                shape::draw(
                    layer,
                    BoxF::new(x, top, width, 1.),
                    ShapeKind::Rect { radius: 0. },
                    Some(paint),
                    None,
                );
            }
        }
    }
}
pub(crate) fn label(state: AudioState, language: Language) -> &'static str {
    use AudioState::*;
    use Language::*;
    match (state, language) {
        (Live, _) => "",
        (Demo, Italian) => "Demo",
        (Demo, PortugueseBr) => "Demonstra??o",
        (Demo, English) => "Demo",
        (Disabled, Italian) => "Cattura audio disabilitata",
        (Disabled, PortugueseBr) => "Captura de ?udio desativada",
        (Disabled, English) => "Audio capture disabled",
        (PlayerMissing, Italian) => "Player mancante",
        (PlayerMissing, PortugueseBr) => "Player ausente",
        (PlayerMissing, English) => "Player missing",
        (Unavailable, Italian) => "Sorgente non disponibile",
        (Unavailable, PortugueseBr) => "Fonte indispon?vel",
        (Unavailable, English) => "Source unavailable",
        (Unsupported, Italian) => "Non supportato su questa versione di Windows",
        (Unsupported, PortugueseBr) => "N?o compat?vel com esta vers?o do Windows",
        (Unsupported, English) => "Unsupported on this version of Windows",
    }
}

#[cfg(test)]
#[allow(clippy::unwrap_used)]
mod tests {
    use super::*;
    use crate::testkit::{self, Scene};
    use bezel_core::domain::{
        frame::Rgba,
        theme::{Background, ElementId, ElementKind, TextContent, TextStyle},
        value_color::ColorThreshold,
    };
    #[test]
    fn mirrored_bands_use_existing_thresholds_and_change_only_inside_the_widget() {
        let config = Spectrum {
            bands: 8,
            peaks: false,
            centre: false,
            corners: [0.; 4],
            ..Default::default()
        };
        let mut element = testkit::element(
            BoxF::new(40., 20., 80., 60.),
            ElementKind::Text {
                content: TextContent::Spectrum(config),
                style: TextStyle::default(),
            },
        );
        let green = Rgba::opaque(0, 255, 0);
        let red = Rgba::opaque(255, 0, 0);
        element.color_by_value = Some(ColorByValue {
            sensor: None,
            base: green,
            thresholds: vec![ColorThreshold {
                value: 50.,
                color: red,
            }],
        });
        let theme = testkit::theme(160, 100, Background::Color(Rgba::BLACK), vec![element]);
        let mut scene = Scene::empty();
        let mut levels = vec![0.2; 8];
        levels[1] = 0.8;
        scene.snapshot.spectra.insert(
            ElementId(1),
            SpectrumFrame {
                state: AudioState::Live,
                levels,
                peaks: vec![],
            },
        );
        let mut renderer = testkit::renderer();
        let before = testkit::render(&mut renderer, &theme, &scene);
        assert_eq!(before.pixel(45, 49), Some(green));
        assert_eq!(before.pixel(55, 39), Some(red));
        assert_eq!(before.pixel(55, 60), Some(red));
        scene
            .snapshot
            .spectra
            .get_mut(&ElementId(1))
            .unwrap()
            .levels
            .fill(0.);
        let after = testkit::render(&mut renderer, &theme, &scene);
        for y in 0..100 {
            for x in 0..160 {
                if before.pixel(x, y) != after.pixel(x, y) {
                    assert!((40..120).contains(&x) && (20..80).contains(&y));
                }
            }
        }
        assert_eq!(after.pixel(55, 39), Some(Rgba::BLACK));
    }
}
