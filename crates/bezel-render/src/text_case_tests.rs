//! Display formatting and natural measurement use identical Unicode transforms.
use crate::testkit;
use bezel_core::{
    domain::{
        frame::Rgba,
        text_case::TextCase,
        theme::{Background, BoxF, ElementKind, FontSpec, TextContent, TextStyle},
    },
    ports::FrameRenderer,
};

#[test]
fn casing_pixels_and_measurement_match_formatted_text_without_changing_the_source() {
    let source = "mÚSICA já TOCA";
    let mut renderer = testkit::renderer();
    let scene = testkit::Scene::empty();
    for (mode, expected) in [
        (TextCase::Upper, "MÚSICA JÁ TOCA"),
        (TextCase::Lower, "música já toca"),
        (TextCase::Sentence, "Música já toca"),
        (TextCase::Title, "Música Já Toca"),
    ] {
        let style = TextStyle {
            casing: mode,
            size: 20.,
            font: FontSpec {
                family: testkit::FAMILY.into(),
                ..Default::default()
            },
            ..Default::default()
        };
        let element = testkit::element(
            BoxF::new(0., 0., 340., 60.),
            ElementKind::Text {
                content: TextContent::Static(source.into()),
                style,
            },
        );
        let original = testkit::theme(340, 60, Background::Color(Rgba::BLACK), vec![element]);
        let actual = testkit::render(&mut renderer, &original, &scene);
        let mut formatted = original.clone();
        if let ElementKind::Text { content, style } = &mut formatted.elements[0].kind {
            *content = TextContent::Static(expected.into());
            style.casing = TextCase::Normal;
        }
        assert_eq!(actual, testkit::render(&mut renderer, &formatted, &scene));
        let quantities = bezel_core::domain::sensor::Quantities::new();
        let context = || bezel_core::ports::RenderContext {
            snapshot: &scene.snapshot,
            histories: &scene.histories,
            quantities: &quantities,
            time: scene.time,
            animation: scene.animation,
            language: bezel_core::domain::clock::Language::English,
            backdrop: bezel_core::ports::Backdrop::Poster,
            shown: &scene.shown,
        };
        let a = renderer
            .measure_element(&original, original.elements[0].id, &scene.assets, context())
            .unwrap();
        let b = renderer
            .measure_element(
                &formatted,
                formatted.elements[0].id,
                &scene.assets,
                context(),
            )
            .unwrap();
        assert_eq!(a, b);
        assert!(
            matches!(&original.elements[0].kind, ElementKind::Text { content: TextContent::Static(text), .. } if text==source)
        );
    }
}
