//! The media player's progress block: the bar (continuous, blocks or dots),
//! its knob and the times beside or above it. Drawing and natural sizing
//! share [`BlockMetrics`], so a fitted frame holds exactly what is drawn.

use std::collections::BTreeMap;

use bezel_core::domain::playback::{
    MediaSession, Player, PlayerText, ProgressPattern, ProgressStyle, TimePlacement,
};
use bezel_core::domain::theme::{
    AssetRef, BoxF, Direction, HAlign, Paint, ShapeKind, TextStyle, VAlign,
};

use crate::diagnostics::Diagnostics;
use crate::gauges::{self, BarStyle};
use crate::layer::Layer;
use crate::shape;
use crate::text::{TextEngine, TextJob};

/// Space between a time and the bar beside it, in text sizes.
const TIME_GAP_EM: f32 = 0.4;
/// Space between the times and the bar under them, pixels.
const ABOVE_GAP: f32 = 2.;
/// Shortest bar between two times, in text sizes.
const MIN_BAR_EM: f32 = 3.;

/// Sizes of a player's progress block.
#[derive(Debug, Default, Clone, Copy, PartialEq)]
pub(crate) struct BlockMetrics {
    /// Height of the block.
    pub height: f32,
    /// Width kept for the left time (0 without one).
    pub left: f32,
    /// Width kept for the right time (0 without one).
    pub right: f32,
    /// Line height of the times.
    pub line: f32,
    /// Space between a time and the bar.
    pub gap: f32,
    /// Narrowest the block can be with its times.
    pub min_width: f32,
}

/// Text engine, fonts and problem log, to measure and draw the times.
pub(crate) struct Fonts<'a> {
    /// Shaping and glyphs.
    pub engine: &'a mut TextEngine,
    /// Theme assets (fonts).
    pub assets: &'a BTreeMap<AssetRef, Vec<u8>>,
    /// Problems met.
    pub diagnostics: &'a mut Diagnostics,
}

impl Fonts<'_> {
    fn measure(&mut self, text: Option<&str>, style: &TextStyle) -> (f32, f32) {
        let Some(text) = text else {
            return (0., 0.);
        };
        let job = TextJob {
            text,
            style,
            area: BoxF::default(),
        };
        self.engine
            .measure(&job, self.assets, self.diagnostics)
            .unwrap_or((0., 0.))
    }

    fn draw(&mut self, layer: &mut Layer<'_>, text: &str, style: &TextStyle, area: BoxF) {
        let job = TextJob { text, style, area };
        self.engine.draw(layer, &job, self.assets, self.diagnostics);
    }
}

/// The block of `shown`, or `None` when no bar is shown.
pub(crate) fn metrics(
    fonts: &mut Fonts<'_>,
    player: &Player,
    media: &MediaSession,
    shown: &PlayerText,
    style: &TextStyle,
) -> Option<BlockMetrics> {
    shown.progress?;
    let s = &player.progress;
    let bar = s.bar_height();
    let plain = BlockMetrics {
        height: bar,
        ..BlockMetrics::default()
    };
    if shown.times.is_none() {
        return Some(plain);
    }
    let (left, right) = player.widest_times(media);
    let (lw, lh) = fonts.measure(left.as_deref(), style);
    let (rw, rh) = fonts.measure(right.as_deref(), style);
    let line = lh.max(rh);
    let gap = (style.size * TIME_GAP_EM).max(0.);
    let labels = f32::from(u8::from(lw > 0.) + u8::from(rw > 0.));
    let (height, min_width) = match s.times {
        TimePlacement::Text => return Some(plain),
        TimePlacement::Sides => (
            bar.max(line),
            lw + rw + gap * labels + style.size * MIN_BAR_EM,
        ),
        TimePlacement::Above => (
            line + ABOVE_GAP + bar,
            lw + rw + if labels > 1. { gap } else { 0. },
        ),
    };
    Some(BlockMetrics {
        height,
        left: lw,
        right: rw,
        line,
        gap,
        min_width,
    })
}

/// Draws the block in `block`: the bar, its knob and the times of `shown`.
pub(crate) fn draw(
    layer: &mut Layer<'_>,
    fonts: &mut Fonts<'_>,
    block: BoxF,
    m: &BlockMetrics,
    shown: &PlayerText,
    player: &Player,
    style: &TextStyle,
) {
    let Some(fraction) = shown.progress else {
        return;
    };
    let s = &player.progress;
    let bar = s.bar_height();
    let label = |align, valign| TextStyle {
        align,
        valign,
        ..style.clone()
    };
    let right_edge = block.x + block.width;
    let row = match (&shown.times, s.times) {
        (Some((left, right)), TimePlacement::Sides) => {
            let row_style = |align| label(align, VAlign::Middle);
            if let Some(text) = left {
                let area = BoxF::new(block.x, block.y, m.left, block.height);
                fonts.draw(layer, text, &row_style(HAlign::Left), area);
            }
            if let Some(text) = right {
                let area = BoxF::new(right_edge - m.right, block.y, m.right, block.height);
                fonts.draw(layer, text, &row_style(HAlign::Right), area);
            }
            let start = block.x + if left.is_some() { m.left + m.gap } else { 0. };
            let end = right_edge - if right.is_some() { m.right + m.gap } else { 0. };
            let y = block.y + (block.height - bar) / 2.;
            BoxF::new(start, y, (end - start).max(0.), bar)
        }
        (Some((left, right)), TimePlacement::Above) => {
            let line = BoxF::new(block.x, block.y, block.width, m.line);
            if let Some(text) = left {
                fonts.draw(layer, text, &label(HAlign::Left, VAlign::Top), line);
            }
            if let Some(text) = right {
                fonts.draw(layer, text, &label(HAlign::Right, VAlign::Top), line);
            }
            BoxF::new(block.x, block.y + m.line + ABOVE_GAP, block.width, bar)
        }
        _ => block,
    };
    let fill = s
        .fill
        .map(Paint::solid)
        .unwrap_or_else(|| style.paint.clone());
    draw_bar(layer, row, fraction, s, &fill);
}

/// The bar centred in `row`, then its knob.
fn draw_bar(layer: &mut Layer<'_>, row: BoxF, fraction: f32, s: &ProgressStyle, fill: &Paint) {
    let track = Paint::solid(s.track);
    let radius = s.radius();
    let bar = if row.height == s.thickness {
        row
    } else {
        BoxF::new(
            row.x,
            row.y + (row.height - s.thickness) / 2.,
            row.width,
            s.thickness,
        )
    };
    match s.pattern {
        ProgressPattern::Continuous => {
            shape::draw(layer, bar, ShapeKind::Rect { radius }, Some(&track), None);
            let filled = BoxF::new(bar.x, bar.y, bar.width * fraction, bar.height);
            shape::draw(layer, filled, ShapeKind::Rect { radius }, Some(fill), None);
        }
        ProgressPattern::Segments | ProgressPattern::Dots => {
            let style = BarStyle {
                direction: Direction::LeftToRight,
                fill,
                track: Some(&track),
                radius,
                segments: None,
            };
            let spans = s.blocks(bar.width);
            gauges::draw_blocks(layer, bar, Some(f64::from(fraction)), &style, &spans);
        }
    }
    let d = s.knob_diameter();
    if d > 0. && bar.width > 0. {
        let half = d / 2.;
        let at = bar.x + bar.width * fraction;
        let cx = at.clamp(bar.x + half, (bar.x + bar.width - half).max(bar.x + half));
        let cy = row.y + row.height / 2.;
        let knob = BoxF::new(cx - half, cy - half, d, d);
        shape::draw(layer, knob, ShapeKind::Ellipse, Some(fill), None);
    }
}

/// Where the block sits in `area`: under the text, or alone by the
/// text's vertical alignment.
pub(crate) fn place(area: BoxF, height: f32, alone: bool, valign: VAlign) -> BoxF {
    let y = if !alone {
        area.y + area.height - height
    } else {
        match valign {
            VAlign::Top => area.y,
            VAlign::Middle => area.y + (area.height - height) / 2.,
            VAlign::Bottom => area.y + area.height - height,
        }
    };
    BoxF::new(area.x, y, area.width, height)
}
