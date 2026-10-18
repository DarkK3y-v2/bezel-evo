//! Audio spectrum contracts; no operating-system APIs or audio persistence.
use super::{
    playback,
    sensor::Snapshot,
    theme::{ElementId, ElementKind, TextContent, Theme},
};

/// Motion preset, expressed independently from display frame rate.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub enum Motion {
    /// Slow fall and gentle attack.
    Smooth,
    /// Responsive attack with a readable fall.
    #[default]
    Balanced,
    /// Fast attack and fall.
    Snappy,
}
/// How the bands are drawn (D-AS-11).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub enum SpectrumStyle {
    /// Bars mirrored around a horizontal centre line (D-AS-4).
    #[default]
    Mirrored,
    /// Bars rising from the bottom edge.
    Bars,
    /// Bars made of stacked blocks, lit from the bottom.
    Blocks,
    /// A smooth curve through the bands, optionally filled below.
    Line,
    /// Bars radiating from a ring around the element's centre.
    Radial,
}
/// Standalone spectrum following exactly one theme Player.
#[derive(Debug, Clone, PartialEq)]
pub struct Spectrum {
    /// Explicit Player; absent links automatically only with a single Player.
    pub player: Option<ElementId>,
    /// Logarithmic bands, 8..=64.
    pub bands: u16,
    /// Lower frequency, Hz.
    pub low: f32,
    /// Upper frequency, Hz.
    pub high: f32,
    /// Attack/fall preset.
    pub motion: Motion,
    /// Hold and decay peak caps.
    pub peaks: bool,
    /// Explicit synthetic preview; never enables capture.
    pub demo: bool,
    /// Maximum bar thickness in pixels.
    pub thickness: f32,
    /// Space between bars in pixels.
    pub gap: f32,
    /// Shared corner ordering: top-left, top-right, bottom-right, bottom-left.
    pub corners: [f32; 4],
    /// Draw the base line: centre line, bottom edge, or inner ring when radial.
    pub centre: bool,
    /// How the bands are drawn.
    pub style: SpectrumStyle,
    /// Block height in pixels, for `Blocks`.
    pub block: f32,
    /// Line width in pixels, for `Line`.
    pub stroke: f32,
    /// Fill the area below the curve, for `Line`.
    pub fill: bool,
    /// Inner ring radius as a percentage of the outer radius, for `Radial`.
    pub inner: f32,
    /// Multiplies every band's height, 0.1..=4 (D-AS-12).
    pub gain: f32,
}
impl Default for Spectrum {
    fn default() -> Self {
        Self {
            player: None,
            bands: 32,
            low: 60.,
            high: 16000.,
            motion: Motion::Balanced,
            peaks: true,
            demo: false,
            thickness: 12.,
            gap: 3.,
            corners: [2.; 4],
            centre: true,
            style: SpectrumStyle::Mirrored,
            block: 6.,
            stroke: 2.,
            fill: true,
            inner: 40.,
            gain: 1.,
        }
    }
}
impl Spectrum {
    /// Bounded even for theme documents coming from another computer.
    pub fn valid(&self) -> bool {
        (8..=64).contains(&self.bands)
            && self.low.is_finite()
            && self.high.is_finite()
            && self.low >= 20.
            && self.high <= 24000.
            && self.low < self.high
            && self.thickness.is_finite()
            && (1. ..=256.).contains(&self.thickness)
            && self.gap.is_finite()
            && (0. ..=128.).contains(&self.gap)
            && self
                .corners
                .iter()
                .all(|v| v.is_finite() && (0. ..=256.).contains(v))
            && (1. ..=64.).contains(&self.block)
            && (1. ..=32.).contains(&self.stroke)
            && (0. ..=90.).contains(&self.inner)
            && (0.1..=4.).contains(&self.gain)
    }
    /// The followed session, selected by the Player's own selection function.
    pub fn session<'a>(
        &self,
        theme: &Theme,
        snapshot: &'a Snapshot,
    ) -> std::result::Result<Option<&'a playback::MediaSession>, AudioState> {
        let players: Vec<_> = theme
            .elements
            .iter()
            .filter_map(|e| match &e.kind {
                ElementKind::Text {
                    content: TextContent::Player(p),
                    ..
                } => Some((e.id, p)),
                _ => None,
            })
            .collect();
        let player = match self.player {
            Some(id) => players.iter().find(|(key, _)| *key == id).map(|(_, p)| *p),
            None if players.len() == 1 => Some(players[0].1),
            _ => None,
        }
        .ok_or(AudioState::PlayerMissing)?;
        Ok(playback::session(snapshot, &player.source))
    }
}
/// Fixed, non-sensitive states suitable for localization and diagnostics.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub enum AudioState {
    /// Capturing; silence is represented by zero bars.
    Live,
    /// User has not enabled local capture.
    #[default]
    Disabled,
    /// Player reference is absent, ambiguous or deleted.
    PlayerMissing,
    /// Session cannot be safely associated with one process tree.
    Unavailable,
    /// Process loopback requires Windows build 20348 or newer.
    Unsupported,
    /// Explicit synthetic preview.
    Demo,
}
/// Latest bounded display result. No PCM leaves the capture worker.
#[derive(Debug, Clone, Default, PartialEq)]
pub struct SpectrumFrame {
    /// Capture or preview state.
    pub state: AudioState,
    /// Normalized -72..0 dB levels, 0..=1.
    pub levels: Vec<f32>,
    /// Normalized peak caps, 0..=1.
    pub peaks: Vec<f32>,
}
/// Ephemeral PCM packet; owned and dropped on the analysis thread.
pub struct AudioBlock {
    /// Interleaved finite normalized samples.
    pub samples: Vec<f32>,
    /// Sample rate in Hz.
    pub rate: u32,
    /// Interleaved channel count.
    pub channels: u16,
}

#[cfg(test)]
#[allow(clippy::unwrap_used, clippy::panic)]
mod tests {
    use super::*;
    use crate::domain::{
        geometry::{Orientation, Size},
        playback::{MediaSession, Player},
        theme::{BoxF, Element, TextStyle},
    };
    fn player(id: u32, source: &str) -> Element {
        Element {
            id: ElementId(id),
            name: "Player".into(),
            frame: BoxF::default(),
            kind: ElementKind::Text {
                content: TextContent::Player(Player {
                    source: source.into(),
                    ..Default::default()
                }),
                style: TextStyle::default(),
            },
            opacity: 1.,
            visible: true,
            locked: false,
            card: None,
            is_group: false,
            group_parent: None,
            card_member: None,
            value_transition: None,
            color_by_value: None,
        }
    }
    #[test]
    fn automatic_link_uses_the_players_exact_session_and_never_guesses_among_players() {
        let mut theme = Theme::blank("s", Size::new(100, 100), Orientation::Portrait);
        theme.elements.push(player(1, "Spotify"));
        let mut snapshot = Snapshot::default();
        snapshot.media = vec![
            MediaSession {
                source: "Chrome.exe".into(),
                playing: true,
                ..Default::default()
            },
            MediaSession {
                source: "Spotify.exe".into(),
                playing: false,
                ..Default::default()
            },
        ];
        let mut s = Spectrum::default();
        assert_eq!(
            s.session(&theme, &snapshot).unwrap().unwrap().source,
            "Spotify.exe"
        );
        theme.elements.push(player(2, "Chrome"));
        assert_eq!(s.session(&theme, &snapshot), Err(AudioState::PlayerMissing));
        s.player = Some(ElementId(2));
        assert_eq!(
            s.session(&theme, &snapshot).unwrap().unwrap().source,
            "Chrome.exe"
        );
        theme.elements.pop();
        assert_eq!(s.session(&theme, &snapshot), Err(AudioState::PlayerMissing));
    }
    #[test]
    fn imported_settings_are_bounded() {
        let mut s = Spectrum::default();
        assert!(s.valid());
        s.high = f32::NAN;
        assert!(!s.valid());
        s.high = 16000.;
        s.low = 20000.;
        assert!(!s.valid());
        s.low = 60.;
        s.bands = u16::MAX;
        assert!(!s.valid());
        s.bands = 32;
        s.corners[0] = f32::INFINITY;
        assert!(!s.valid());
    }
}
