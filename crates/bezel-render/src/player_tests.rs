//! Media player drawing: the parts it shows, its progress bar and its natural
//! size. Themes saved before the optional parts existed must draw exactly as
//! they did, so their frames are pinned by hash.

use bezel_core::domain::frame::{Frame, Rgba};
use bezel_core::domain::playback::{MediaSession, Player};
use bezel_core::domain::theme::{
    Background, BoxF, ElementId, ElementKind, FontSpec, HAlign, Paint, TextContent, TextStyle,
    Theme, VAlign,
};
use bezel_core::ports::{Backdrop, FrameRenderer, RenderContext};

use crate::SkiaRenderer;
use crate::testkit::{self, FAMILY, Scene, element, png};

const RED: Rgba = Rgba::opaque(255, 0, 0);

/// FNV-1a over the frame bytes.
fn hash(frame: &Frame) -> u64 {
    frame.as_rgba().iter().fold(0xcbf2_9ce4_8422_2325, |h, b| {
        (h ^ u64::from(*b)).wrapping_mul(0x0000_0100_0000_01b3)
    })
}

fn style(align: HAlign, valign: VAlign) -> TextStyle {
    TextStyle {
        font: FontSpec {
            family: FAMILY.into(),
            weight: 400,
            italic: false,
            asset: None,
        },
        size: 14.,
        paint: Paint::solid(Rgba::WHITE),
        align,
        valign,
        letter_spacing: 0.,
    }
}

/// A player with only the fields themes had before the optional parts.
fn legacy(cover: bool, progress: bool, source: bool) -> Player {
    Player {
        source: String::new(),
        show_cover: cover,
        cover_radius: 0.,
        cover_corners: None,
        cover_gap: None,
        show_progress: progress,
        show_source: source,
        hide_when_stopped: false,
        empty_text: "No media".into(),
    }
}

fn player_theme(player: Player, style: TextStyle) -> Theme {
    testkit::theme(
        240,
        120,
        Background::Color(Rgba::BLACK),
        vec![element(
            BoxF::new(10., 8., 220., 104.),
            ElementKind::Text {
                content: TextContent::Player(player),
                style,
            },
        )],
    )
}

fn playing() -> Scene {
    let mut scene = Scene::empty();
    scene.snapshot.media.push(MediaSession {
        source: "Spotify.exe".into(),
        title: "Track".into(),
        artist: "Artist".into(),
        playing: true,
        position: 84.,
        duration: 210.,
        cover: png(20, 20, |_, _| RED),
    });
    scene
}

fn measure(r: &mut SkiaRenderer, theme: &Theme, scene: &Scene) -> Option<BoxF> {
    let context = RenderContext {
        snapshot: &scene.snapshot,
        histories: &scene.histories,
        quantities: &bezel_core::domain::sensor::Quantities::new(),
        time: scene.time,
        animation: scene.animation,
        language: bezel_core::domain::clock::Language::English,
        backdrop: Backdrop::Poster,
        shown: &scene.shown,
    };
    r.measure_element(theme, ElementId(1), &scene.assets, context)
        .expect("measure")
}

/// The legacy configurations, each with the hash of its frame and its fit.
fn legacy_cases() -> Vec<(&'static str, Theme, Scene)> {
    let top = style(HAlign::Left, VAlign::Top);
    let mut corners = legacy(true, false, false);
    corners.cover_corners = Some([0., 6., 12., 18.]);
    corners.cover_gap = Some(16.);
    let mut radius = legacy(false, true, true);
    radius.cover_radius = 9.;
    let mut empty = Scene::empty();
    empty.snapshot.media.clear();
    let mut stopped = playing();
    stopped.snapshot.media[0].playing = false;
    stopped.snapshot.media[0].duration = 0.;
    vec![
        (
            "cover+progress",
            player_theme(legacy(true, true, false), top.clone()),
            playing(),
        ),
        (
            "progress centred",
            player_theme(
                legacy(false, true, false),
                style(HAlign::Center, VAlign::Middle),
            ),
            playing(),
        ),
        (
            "source+progress",
            player_theme(radius, top.clone()),
            playing(),
        ),
        (
            "cover corners",
            player_theme(corners, style(HAlign::Right, VAlign::Bottom)),
            playing(),
        ),
        (
            "no session",
            player_theme(legacy(true, true, false), top.clone()),
            empty,
        ),
        (
            "stopped",
            player_theme(legacy(true, true, true), top),
            stopped,
        ),
    ]
}

/// Frame hashes and fits recorded before the optional parts existed.
const LEGACY: [(u64, (f32, f32, f32, f32)); 6] = [
    (0x58f9_f8c3_eb45_c748, (10., 8., 157., 59.)),
    (0xff7b_d224_a8d6_001d, (73.5, 30.5, 93., 59.)),
    (0x49d8_f425_2473_251a, (10., 8., 93., 76.)),
    (0x1b38_c185_9eff_9543, (129., 78., 101., 34.)),
    (0x124b_9a37_8e92_76a7, (10., 8., 68., 17.)),
    (0x00e0_bb17_4da3_93c1, (10., 8., 149., 51.)),
];

#[test]
fn legacy_players_draw_and_fit_exactly_as_before() {
    let mut r = testkit::renderer();
    for ((name, theme, scene), (expected, (x, y, w, h))) in legacy_cases().into_iter().zip(LEGACY) {
        let frame = testkit::render(&mut r, &theme, &scene);
        assert_eq!(hash(&frame), expected, "{name} pixels");
        assert_eq!(
            measure(&mut r, &theme, &scene),
            Some(BoxF::new(x, y, w, h)),
            "{name} fit"
        );
    }
}
