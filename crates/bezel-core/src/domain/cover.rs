//! Cover transitions between display profiles: an opaque panel the host
//! paints over the whole scene closes it, the new theme is swapped in under
//! it, and the panel opens again.
//!
//! Only opaque pixels are painted, so a cover hides a video the screen plays
//! on its own as well as the host's own frame: the host never needs the
//! pixels of what it covers. Every measure follows the canvas (the short side
//! sets the edge, the strips and the tiles), so the same cover fits any
//! screen, wide, tall or round.

use super::frame::{Frame, Rect, Rgba};

/// How the panel closes and opens.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum CoverEffect {
    /// Two leaves from opposite edges meet in the middle and part again.
    Curtain,
    /// One panel crosses the screen: it covers coming in and uncovers
    /// leaving on the other side.
    Wipe,
    /// Strips close one after another in a wave and open the same way.
    Blinds,
    /// Tiles light up in a scattered order until all is covered, then go
    /// out in another order.
    Mosaic,
}

/// Where the cover moves. Curtain uses the axis only; mosaic ignores it.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum CoverDirection {
    /// Towards the left edge.
    Left,
    /// Towards the right edge.
    Right,
    /// Towards the top edge.
    Up,
    /// Towards the bottom edge.
    Down,
}

impl CoverDirection {
    const fn horizontal(self) -> bool {
        matches!(self, CoverDirection::Left | CoverDirection::Right)
    }
}

/// Whether the panel is closing over the old scene or opening on the new.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum CoverStage {
    /// The panel comes in over the old scene.
    Closing,
    /// The panel goes away from the new scene.
    Opening,
}

/// One cover: its motion and its two colors (painted opaque).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Cover {
    /// The motion.
    pub effect: CoverEffect,
    /// Its direction.
    pub direction: CoverDirection,
    /// The panel.
    pub panel: Rgba,
    /// The moving edges and the mosaic's front.
    pub accent: Rgba,
}

/// Panel color of a cover nobody chose.
pub const DEFAULT_PANEL: Rgba = Rgba::opaque(0x12, 0x0b, 0x13);
/// Accent color of a cover nobody chose.
pub const DEFAULT_ACCENT: Rgba = Rgba::opaque(0xf2, 0x8c, 0x28);

/// Delay of the last strip of a blind, as a share of the closing.
const BLINDS_STAGGER: f32 = 0.7;
/// Share of the closing during which a mosaic tile shows the accent.
const MOSAIC_FRONT: f32 = 0.12;

/// Smooth start and end (cubic), for `t` in 0..=1.
pub fn ease(t: f32) -> f32 {
    let t = t.clamp(0.0, 1.0);
    if t < 0.5 {
        4.0 * t * t * t
    } else {
        1.0 - (-2.0 * t + 2.0).powi(3) / 2.0
    }
}

impl Cover {
    /// Paints the cover over `frame` with `coverage` of it drawn: 0 paints
    /// nothing, 1 covers every pixel with the panel.
    pub fn paint(&self, frame: &mut Frame, stage: CoverStage, coverage: f32) {
        let c = coverage.clamp(0.0, 1.0);
        if c <= 0.0 {
            return;
        }
        let size = frame.size();
        if c >= 1.0 {
            frame.fill_rect(Rect::of(size), opaque(self.panel));
            return;
        }
        let mut painter = Painter::new(frame, self);
        match self.effect {
            CoverEffect::Curtain => painter.curtain(self.direction, c),
            CoverEffect::Wipe => painter.wipe(self.direction, stage, c),
            CoverEffect::Blinds => painter.blinds(self.direction, c),
            CoverEffect::Mosaic => painter.mosaic(stage, c),
        }
    }
}

const fn opaque(color: Rgba) -> Rgba {
    Rgba::opaque(color.r, color.g, color.b)
}

/// `accent` over `panel` by `amount`, opaque.
fn mix(panel: Rgba, accent: Rgba, amount: f32) -> Rgba {
    let channel =
        |p: u8, a: u8| (f32::from(p) + (f32::from(a) - f32::from(p)) * amount).round() as u8;
    Rgba::opaque(
        channel(panel.r, accent.r),
        channel(panel.g, accent.g),
        channel(panel.b, accent.b),
    )
}

/// The side of an edge the panel lies on.
#[derive(Clone, Copy)]
enum Inside {
    Before,
    After,
}

struct Painter<'a> {
    frame: &'a mut Frame,
    width: f32,
    height: f32,
    short: f32,
    panel: Rgba,
    accent: Rgba,
    edge: u32,
}

impl<'a> Painter<'a> {
    fn new(frame: &'a mut Frame, cover: &Cover) -> Self {
        let size = frame.size();
        let short = size.width.min(size.height).max(1) as f32;
        Self {
            frame,
            width: size.width as f32,
            height: size.height as f32,
            short,
            panel: opaque(cover.panel),
            accent: opaque(cover.accent),
            edge: (short / 160.0).round().max(2.0) as u32,
        }
    }

    fn length(&self, horizontal: bool) -> f32 {
        if horizontal { self.width } else { self.height }
    }

    /// Fills `start..end` along the axis (columns when `horizontal`).
    fn band(&mut self, horizontal: bool, start: f32, end: f32, color: Rgba) {
        let a = start.round().max(0.0) as u32;
        let b = end.round().max(0.0) as u32;
        if b <= a {
            return;
        }
        let rect = if horizontal {
            Rect::new(a, 0, b - a, self.height as u32)
        } else {
            Rect::new(0, a, self.width as u32, b - a)
        };
        self.frame.fill_rect(rect, color);
    }

    /// The lit edge at `at` along the axis, with its glow inside the panel.
    fn edge(&mut self, horizontal: bool, at: f32, inside: Inside) {
        let line = self.edge as f32;
        let glow = (self.short / 48.0).max(2.0);
        let (line_start, glow_sign) = match inside {
            Inside::Before => (at - line, -1.0),
            Inside::After => (at, 1.0),
        };
        let glow_from = match inside {
            Inside::Before => line_start,
            Inside::After => line_start + line,
        };
        for (step, amount) in [0.55, 0.3, 0.12].into_iter().enumerate() {
            let near = glow_from + glow_sign * glow * step as f32 / 3.0;
            let far = glow_from + glow_sign * glow * (step + 1) as f32 / 3.0;
            let color = mix(self.panel, self.accent, amount);
            self.band(horizontal, near.min(far), near.max(far), color);
        }
        self.band(horizontal, line_start, line_start + line, self.accent);
    }

    fn curtain(&mut self, direction: CoverDirection, c: f32) {
        let horizontal = direction.horizontal();
        let length = self.length(horizontal);
        let half = length / 2.0 * c;
        self.band(horizontal, 0.0, half, self.panel);
        self.band(horizontal, length - half, length, self.panel);
        self.edge(horizontal, half, Inside::Before);
        self.edge(horizontal, length - half, Inside::After);
    }

    fn wipe(&mut self, direction: CoverDirection, stage: CoverStage, c: f32) {
        let horizontal = direction.horizontal();
        let length = self.length(horizontal);
        let reach = length * c;
        // Towards the start (left, up): it enters at the end and leaves at the start.
        let toward_start = matches!(direction, CoverDirection::Left | CoverDirection::Up);
        match (toward_start, stage) {
            (true, CoverStage::Closing) | (false, CoverStage::Opening) => {
                self.band(horizontal, length - reach, length, self.panel);
                self.edge(horizontal, length - reach, Inside::After);
            }
            (true, CoverStage::Opening) | (false, CoverStage::Closing) => {
                self.band(horizontal, 0.0, reach, self.panel);
                self.edge(horizontal, reach, Inside::Before);
            }
        }
    }

    fn blinds(&mut self, direction: CoverDirection, c: f32) {
        let horizontal = direction.horizontal();
        let length = self.length(horizontal);
        let count = ((length / (self.short / 2.0)).round() as usize).max(4);
        let line = self.edge as f32;
        for i in 0..count {
            let mut order = i as f32 / (count - 1) as f32;
            if matches!(direction, CoverDirection::Left | CoverDirection::Up) {
                order = 1.0 - order;
            }
            let closed = (c * (1.0 + BLINDS_STAGGER) - BLINDS_STAGGER * order).clamp(0.0, 1.0);
            if closed <= 0.0 {
                continue;
            }
            let start = (i as f32 * length / count as f32).round();
            let end = ((i + 1) as f32 * length / count as f32).round();
            let span = (end - start) * closed;
            let from = start + (end - start - span) / 2.0;
            self.band(horizontal, from, from + span, self.panel);
            if closed < 1.0 {
                let border = line.min(span / 2.0);
                self.band(horizontal, from, from + border, self.accent);
                self.band(horizontal, from + span - border, from + span, self.accent);
            }
        }
    }

    fn mosaic(&mut self, stage: CoverStage, c: f32) {
        let tile = self.short / 4.0;
        let columns = ((self.width / tile).round() as usize).max(4);
        let rows = ((self.height / tile).round() as usize).max(4);
        let count = columns * rows;
        let rank = scattered(
            count,
            match stage {
                CoverStage::Closing => 0x2026,
                CoverStage::Opening => 0x0911,
            },
        );
        for (cell, &order) in rank.iter().enumerate() {
            let threshold = order as f32 / count as f32;
            if c <= threshold {
                continue;
            }
            let color = if c - threshold < MOSAIC_FRONT {
                self.accent
            } else {
                self.panel
            };
            let (column, row) = (cell % columns, cell / columns);
            let x0 = (column as f32 * self.width / columns as f32).round() as u32;
            let x1 = ((column + 1) as f32 * self.width / columns as f32).round() as u32;
            let y0 = (row as f32 * self.height / rows as f32).round() as u32;
            let y1 = ((row + 1) as f32 * self.height / rows as f32).round() as u32;
            self.frame.fill_rect(
                Rect::new(x0, y0, x1.saturating_sub(x0), y1.saturating_sub(y0)),
                color,
            );
        }
    }
}

/// The position of each of `count` cells in a fixed scattered order.
fn scattered(count: usize, seed: u32) -> Vec<usize> {
    let mut state = seed.max(1);
    let mut next = move || {
        state ^= state << 13;
        state ^= state >> 17;
        state ^= state << 5;
        state
    };
    let mut cells: Vec<usize> = (0..count).collect();
    for i in (1..count).rev() {
        let j = next() as usize % (i + 1);
        cells.swap(i, j);
    }
    let mut rank = vec![0; count];
    for (position, cell) in cells.into_iter().enumerate() {
        rank[cell] = position;
    }
    rank
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::domain::geometry::Size;

    const SCENE: Rgba = Rgba::opaque(10, 200, 30);
    const SIZES: [(u32, u32); 5] = [(1920, 480), (320, 480), (480, 480), (800, 480), (7, 5)];
    const EFFECTS: [CoverEffect; 4] = [
        CoverEffect::Curtain,
        CoverEffect::Wipe,
        CoverEffect::Blinds,
        CoverEffect::Mosaic,
    ];
    const DIRECTIONS: [CoverDirection; 4] = [
        CoverDirection::Left,
        CoverDirection::Right,
        CoverDirection::Up,
        CoverDirection::Down,
    ];

    fn cover(effect: CoverEffect, direction: CoverDirection) -> Cover {
        Cover {
            effect,
            direction,
            panel: Rgba {
                a: 40,
                ..DEFAULT_PANEL
            },
            accent: DEFAULT_ACCENT,
        }
    }

    fn painted(size: Size, cover: &Cover, stage: CoverStage, c: f32) -> Frame {
        let mut frame = Frame::filled(size, Rgba { a: 0, ..SCENE });
        cover.paint(&mut frame, stage, c);
        frame
    }

    fn covered(frame: &Frame) -> usize {
        frame
            .as_rgba()
            .as_chunks::<4>()
            .0
            .iter()
            .filter(|p| p[3] == 255)
            .count()
    }

    #[test]
    fn every_cover_spans_nothing_then_everything_on_any_canvas() {
        for (w, h) in SIZES {
            let size = Size::new(w, h);
            for effect in EFFECTS {
                for direction in DIRECTIONS {
                    let c = cover(effect, direction);
                    for stage in [CoverStage::Closing, CoverStage::Opening] {
                        let empty = painted(size, &c, stage, 0.0);
                        assert_eq!(covered(&empty), 0, "{effect:?} {w}x{h}");
                        let full = painted(size, &c, stage, 1.0);
                        assert!(
                            full.as_rgba()
                                .as_chunks::<4>()
                                .0
                                .iter()
                                .all(|p| *p == [0x12, 0x0b, 0x13, 255]),
                            "{effect:?} {direction:?} {w}x{h} leaves a gap"
                        );
                    }
                }
            }
        }
    }

    #[test]
    fn covers_grow_with_coverage_and_paint_only_opaque_pixels() {
        for (w, h) in SIZES.into_iter().take(4) {
            let size = Size::new(w, h);
            for effect in EFFECTS {
                for direction in DIRECTIONS {
                    let c = cover(effect, direction);
                    let mut last = 0;
                    for step in [0.2, 0.45, 0.7, 0.95] {
                        let frame = painted(size, &c, CoverStage::Closing, step);
                        let now = covered(&frame);
                        assert!(now > last, "{effect:?} {direction:?} {w}x{h} at {step}");
                        last = now;
                        for p in frame.as_rgba().as_chunks::<4>().0 {
                            assert!(p[3] == 0 || p[3] == 255);
                            assert!(p[3] == 255 || p[..3] == [SCENE.r, SCENE.g, SCENE.b]);
                        }
                    }
                }
            }
        }
    }

    #[test]
    fn a_wipe_enters_on_one_side_and_leaves_on_the_other() {
        let size = Size::new(1920, 480);
        let c = cover(CoverEffect::Wipe, CoverDirection::Left);
        let closing = painted(size, &c, CoverStage::Closing, 0.3);
        assert_eq!(closing.pixel(1919, 240).unwrap().a, 255);
        assert_eq!(closing.pixel(0, 240).unwrap().a, 0);
        let opening = painted(size, &c, CoverStage::Opening, 0.3);
        assert_eq!(opening.pixel(0, 240).unwrap().a, 255);
        assert_eq!(opening.pixel(1919, 240).unwrap().a, 0);
    }

    #[test]
    fn a_curtain_meets_in_the_middle_with_a_lit_edge() {
        let size = Size::new(1920, 480);
        let frame = painted(
            size,
            &cover(CoverEffect::Curtain, CoverDirection::Right),
            CoverStage::Closing,
            0.5,
        );
        assert_eq!(frame.pixel(0, 0).unwrap().a, 255);
        assert_eq!(frame.pixel(1919, 0).unwrap().a, 255);
        assert_eq!(frame.pixel(960, 240).unwrap().a, 0);
        assert_eq!(frame.pixel(479, 240), Some(DEFAULT_ACCENT));
    }

    #[test]
    fn mosaic_tiles_follow_the_short_side() {
        // 1920 x 480: tiles of 120 px, 16 x 4; the order covers each tile once.
        let rank = scattered(64, 0x2026);
        let mut seen = rank.clone();
        seen.sort_unstable();
        assert_eq!(seen, (0..64).collect::<Vec<_>>());
        let frame = painted(
            Size::new(1920, 480),
            &cover(CoverEffect::Mosaic, CoverDirection::Left),
            CoverStage::Closing,
            0.5,
        );
        for x in (0..1920).step_by(120) {
            for y in (0..480).step_by(120) {
                let corner = frame.pixel(x, y).unwrap();
                let opposite = frame.pixel(x + 119, y + 119).unwrap();
                assert_eq!(corner, opposite);
            }
        }
    }

    #[test]
    fn ease_is_bounded_and_symmetric() {
        assert_eq!(ease(-1.0), 0.0);
        assert_eq!(ease(2.0), 1.0);
        assert!((ease(0.5) - 0.5).abs() < 1e-6);
        assert!((ease(0.25) + ease(0.75) - 1.0).abs() < 1e-6);
    }
}
