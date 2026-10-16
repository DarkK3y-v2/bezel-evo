//! Handing a screen from one Bezel program to another without a visible
//! redraw: the program that lets go leaves the frame the screen shows (the
//! *baseline*), and the one that takes over diffs its first frame against
//! it instead of sending a full one.
//!
//! A baseline is trusted only when it is certainly what the screen shows:
//! the same screen (display address, model, firmware), the same orientation
//! and size, and recent ([`MAX_HANDOFF_AGE`]). Anything else is refused and
//! the first frame is a full one, as without a baseline.

use std::fmt;
use std::time::Duration;

use super::discovery::DeviceAddress;
use super::frame::Frame;
use super::geometry::{Orientation, Size};

/// Oldest baseline a program takes over. A screen keeps its last frame
/// while nothing is sent, but its own sleep timer (one minute at the
/// shortest) may turn it off, and another program may write to it
/// meanwhile; a handoff takes about a second.
pub const MAX_HANDOFF_AGE: Duration = Duration::from_secs(20);

/// The frame a link last showed and the screen confirmed, in the
/// orientation the frames were sent in (the theme's).
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Baseline {
    /// Orientation of `frame`.
    pub orientation: Orientation,
    /// What the screen shows, as the theme draws it.
    pub frame: Frame,
}

/// Which screen a baseline belongs to.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct HandoffKey {
    /// The screen's display address (its frames' port).
    pub address: DeviceAddress,
    /// The catalog model id.
    pub model: String,
    /// What the screen answered at the handshake, when it answers.
    pub firmware: Option<String>,
}

/// A baseline left for the next program, with the screen it shows on.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct HandedFrame {
    /// The screen.
    pub key: HandoffKey,
    /// When it was left, since the Unix epoch (a value: the core reads no
    /// clock).
    pub saved_at: Duration,
    /// What the screen shows.
    pub baseline: Baseline,
}

/// Why a baseline is not taken over.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Refusal {
    /// It was left for another screen (address or model).
    OtherScreen,
    /// The screen answers with another firmware now.
    OtherFirmware,
    /// The theme is shown in another orientation.
    OtherOrientation,
    /// Its size is not the panel's in that orientation.
    OtherSize,
    /// Older than [`MAX_HANDOFF_AGE`].
    TooOld,
    /// Dated after now: the clock moved, so its age is unknown.
    FromTheFuture,
}

impl fmt::Display for Refusal {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(match self {
            Refusal::OtherScreen => "it was left for another screen",
            Refusal::OtherFirmware => "the screen answers with another firmware",
            Refusal::OtherOrientation => "the theme is shown in another orientation",
            Refusal::OtherSize => "its size is not the panel's",
            Refusal::TooOld => "it is too old",
            Refusal::FromTheFuture => "it is dated in the future",
        })
    }
}

impl HandedFrame {
    /// Whether this baseline may seed the link of `key`, showing frames of
    /// `size` in `orientation`, at `now` (since the Unix epoch).
    pub fn check(
        &self,
        key: &HandoffKey,
        orientation: Orientation,
        size: Size,
        now: Duration,
    ) -> Result<(), Refusal> {
        if self.key.address != key.address || self.key.model != key.model {
            return Err(Refusal::OtherScreen);
        }
        if self.key.firmware != key.firmware {
            return Err(Refusal::OtherFirmware);
        }
        if self.baseline.orientation != orientation {
            return Err(Refusal::OtherOrientation);
        }
        if self.baseline.frame.size() != size {
            return Err(Refusal::OtherSize);
        }
        let Some(age) = now.checked_sub(self.saved_at) else {
            return Err(Refusal::FromTheFuture);
        };
        if age > MAX_HANDOFF_AGE {
            return Err(Refusal::TooOld);
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::domain::frame::Rgba;

    fn key() -> HandoffKey {
        HandoffKey {
            address: DeviceAddress("COM6".into()),
            model: "turing-8.8".into(),
            firmware: Some("chs_88inch.dev1_rom1.90".into()),
        }
    }

    const SIZE: Size = Size::new(4, 2);
    const AT: Duration = Duration::from_secs(1_000);

    fn handed() -> HandedFrame {
        HandedFrame {
            key: key(),
            saved_at: AT,
            baseline: Baseline {
                orientation: Orientation::Landscape,
                frame: Frame::filled(SIZE, Rgba::BLACK),
            },
        }
    }

    fn check(
        h: &HandedFrame,
        k: &HandoffKey,
        o: Orientation,
        now: Duration,
    ) -> Result<(), Refusal> {
        h.check(k, o, SIZE, now)
    }

    #[test]
    fn a_fresh_baseline_of_the_same_screen_fits() {
        let land = Orientation::Landscape;
        assert_eq!(check(&handed(), &key(), land, AT), Ok(()));
        let edge = AT + MAX_HANDOFF_AGE;
        assert_eq!(check(&handed(), &key(), land, edge), Ok(()));
    }

    #[test]
    fn anything_else_is_refused() {
        let land = Orientation::Landscape;
        let mut other = key();
        other.address = DeviceAddress("COM7".into());
        assert_eq!(
            check(&handed(), &other, land, AT),
            Err(Refusal::OtherScreen)
        );
        let mut other = key();
        other.model = "turing-5".into();
        assert_eq!(
            check(&handed(), &other, land, AT),
            Err(Refusal::OtherScreen)
        );
        let mut other = key();
        other.firmware = None;
        assert_eq!(
            check(&handed(), &other, land, AT),
            Err(Refusal::OtherFirmware)
        );
        let portrait = Orientation::Portrait;
        assert_eq!(
            check(&handed(), &key(), portrait, AT),
            Err(Refusal::OtherOrientation)
        );
        assert_eq!(
            handed().check(&key(), land, Size::new(2, 4), AT),
            Err(Refusal::OtherSize)
        );
        let late = AT + MAX_HANDOFF_AGE + Duration::from_millis(1);
        assert_eq!(check(&handed(), &key(), land, late), Err(Refusal::TooOld));
        let early = AT - Duration::from_millis(1);
        assert_eq!(
            check(&handed(), &key(), land, early),
            Err(Refusal::FromTheFuture)
        );
    }

    #[test]
    fn refusals_say_why() {
        let all = [
            Refusal::OtherScreen,
            Refusal::OtherFirmware,
            Refusal::OtherOrientation,
            Refusal::OtherSize,
            Refusal::TooOld,
            Refusal::FromTheFuture,
        ];
        let texts: std::collections::BTreeSet<String> = all.iter().map(|r| r.to_string()).collect();
        assert_eq!(texts.len(), all.len());
    }
}
