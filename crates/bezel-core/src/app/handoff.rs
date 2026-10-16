//! Handing a screen to another Bezel program without a visible redraw
//! ([`crate::domain::handoff`]): the program that lets go leaves the frame
//! the screen shows ([`hand_over`]); the one that takes over seeds its link
//! with it ([`take_over`]), so that its first frame is a difference.
//!
//! Both sides get the time as a value (since the Unix epoch): the core
//! reads no clock.

use std::time::Duration;

use crate::Result;
use crate::domain::discovery::DeviceAddress;
use crate::domain::geometry::Orientation;
use crate::domain::handoff::{HandedFrame, HandoffKey, Refusal};
use crate::ports::{HandoffStore, ScreenLink};

/// The key of the screen `link` reaches at `address`.
fn key_of(link: &dyn ScreenLink, address: DeviceAddress) -> HandoffKey {
    let identity = link.identity();
    HandoffKey {
        address,
        model: identity.model.id.0.to_string(),
        firmware: identity.firmware.clone(),
    }
}

/// What [`hand_over`] left.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum HandedOver {
    /// The frame the screen shows, for the next program.
    Baseline,
    /// Nothing: the link has no confirmed frame (or keeps none); the next
    /// program sends a full frame.
    Nothing,
}

/// Leaves what the screen at `address` shows, as `link` last showed it, in
/// `store`. The link must be out of any frame loop already: a frame sent
/// after this would make the baseline wrong. Sends nothing to the screen.
pub fn hand_over(
    link: &dyn ScreenLink,
    address: DeviceAddress,
    store: &dyn HandoffStore,
    now: Duration,
) -> Result<HandedOver> {
    let Some(baseline) = link.baseline() else {
        return Ok(HandedOver::Nothing);
    };
    let handed = HandedFrame {
        key: key_of(link, address),
        saved_at: now,
        baseline,
    };
    store.save(&handed)?;
    Ok(HandedOver::Baseline)
}

/// What [`take_over`] did.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TakeOver {
    /// The link took the baseline: its next frame is a difference.
    Seeded {
        /// How long ago it was left.
        age: Duration,
    },
    /// Nothing was left for this screen.
    Nothing,
    /// One was left, and refused.
    Refused(Refusal),
    /// One fitted, and the link did not take it (its adapter cannot check a
    /// baseline): the next frame is a full one.
    NotTaken,
}

/// Seeds `link`, which shows frames in `orientation` on the screen at
/// `address`, with the baseline left for that screen, when it fits
/// ([`HandedFrame::check`]). What was left is removed either way.
pub fn take_over(
    link: &mut dyn ScreenLink,
    address: &DeviceAddress,
    orientation: Orientation,
    store: &dyn HandoffStore,
    now: Duration,
) -> Result<TakeOver> {
    let Some(handed) = store.take(address)? else {
        return Ok(TakeOver::Nothing);
    };
    let key = key_of(link, address.clone());
    let size = link.identity().model.panel.in_orientation(orientation);
    if let Err(refusal) = handed.check(&key, orientation, size, now) {
        return Ok(TakeOver::Refused(refusal));
    }
    if !link.seed_baseline(&handed.baseline) {
        return Ok(TakeOver::NotTaken);
    }
    Ok(TakeOver::Seeded {
        age: now.saturating_sub(handed.saved_at),
    })
}
