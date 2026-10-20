//! Optional native visualization refinements; absent preserves existing themes.
use super::{frame::Rgba, theme::Binding};

/// The additional geometry used by a bar, ring or history graph.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum VisualStyle {
    /// A row-major grid filled from the bottom left.
    Matrix,
    /// Square pixels positioned along an arc.
    Pixel,
    /// An arc with scale ticks and an endpoint marker.
    Dial,
    /// Rounded history bars.
    Rounded,
    /// Two independent histories above and below a shared baseline.
    Mirrored,
}

/// Settings shared by the optional visualization presets.
#[derive(Debug, Clone, PartialEq)]
pub struct Visualization {
    /// Active preset; only applicable to its corresponding widget kind.
    pub style: VisualStyle,
    /// Matrix columns, 1..=64.
    pub columns: u16,
    /// Matrix rows, 1..=32.
    pub rows: u16,
    /// Matrix/bar spacing in pixels, 0..=32.
    pub gap: f32,
    /// Corner radius or marker radius, 0..=32 pixels.
    pub radius: f32,
    /// Number of dial scale ticks, 2..=120.
    pub ticks: u16,
    /// Show the dial endpoint marker.
    pub marker: bool,
    /// Optional lower graph source; never synthesized from the upper series.
    pub secondary: Option<Binding>,
    /// Lower graph color.
    pub secondary_color: Rgba,
}

impl Visualization {
    /// Bounded defaults for a preset.
    pub fn new(style: VisualStyle) -> Self {
        Self {
            style,
            columns: 16,
            rows: 6,
            gap: 3.,
            radius: 2.,
            ticks: 31,
            marker: true,
            secondary: None,
            secondary_color: Rgba::opaque(232, 121, 164),
        }
    }

    /// Reject malformed theme data before it reaches renderers.
    pub fn valid(&self) -> bool {
        (1..=64).contains(&self.columns)
            && (1..=32).contains(&self.rows)
            && self.gap.is_finite()
            && (0. ..=32.).contains(&self.gap)
            && self.radius.is_finite()
            && (0. ..=32.).contains(&self.radius)
            && (2..=120).contains(&self.ticks)
            && self
                .secondary
                .as_ref()
                .is_none_or(|b| b.min.is_finite() && b.max.is_finite() && b.max > b.min)
    }
}
