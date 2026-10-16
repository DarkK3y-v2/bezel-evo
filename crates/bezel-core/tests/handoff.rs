//! The handoff use cases through the adapters' fake screen
//! (`bezel_devices::FakeConnector`) and a store in memory.
#![allow(clippy::unwrap_used)] // helpers of a failing test panic

use std::cell::RefCell;
use std::collections::BTreeMap;
use std::time::Duration;

use bezel_core::app::handoff::{HandedOver, TakeOver, hand_over, take_over};
use bezel_core::app::open_screen;
use bezel_core::domain::discovery::DeviceAddress;
use bezel_core::domain::frame::{Frame, Rgba};
use bezel_core::domain::geometry::Orientation;
use bezel_core::domain::handoff::{HandedFrame, MAX_HANDOFF_AGE, Refusal};
use bezel_core::ports::{HandoffStore, ScreenLink};
use bezel_core::{BezelError, Result};
use bezel_devices::{FakeBus, FakeConnector};

/// Baselines by address, as a file per screen keeps them.
#[derive(Default)]
struct MemoryStore {
    left: RefCell<BTreeMap<DeviceAddress, HandedFrame>>,
    broken: bool,
}

impl HandoffStore for MemoryStore {
    fn save(&self, handed: &HandedFrame) -> Result<()> {
        if self.broken {
            return Err(BezelError::Transport("disk full".into()));
        }
        let address = handed.key.address.clone();
        self.left.borrow_mut().insert(address, handed.clone());
        Ok(())
    }

    fn take(&self, address: &DeviceAddress) -> Result<Option<HandedFrame>> {
        Ok(self.left.borrow_mut().remove(address))
    }
}

const NOW: Duration = Duration::from_secs(1_790_000_000);

fn com6() -> DeviceAddress {
    DeviceAddress("COM6".into())
}

fn link(connector: &FakeConnector) -> Box<dyn ScreenLink> {
    let mut link = open_screen(&FakeBus::turing_88(), connector, None).unwrap();
    link.set_orientation(Orientation::Landscape).unwrap();
    link
}

fn theme_frame(link: &dyn ScreenLink) -> Frame {
    let size = link.identity().model.panel.transposed();
    let mut frame = Frame::filled(size, Rgba::BLACK);
    frame.as_rgba_mut()[0] = 200;
    frame
}

#[test]
fn the_frame_shown_last_seeds_the_next_link() {
    let store = MemoryStore::default();
    let studio = FakeConnector::default();
    let mut shown = link(&studio);
    assert_eq!(
        hand_over(shown.as_ref(), com6(), &store, NOW),
        Ok(HandedOver::Nothing),
        "nothing shown yet: nothing left"
    );
    let frame = theme_frame(shown.as_ref());
    shown.present(&frame).unwrap();
    assert_eq!(
        hand_over(shown.as_ref(), com6(), &store, NOW),
        Ok(HandedOver::Baseline)
    );
    drop(shown);
    let left = store.left.borrow().get(&com6()).cloned().unwrap();
    assert_eq!(left.key.model, "turing-8.8");
    assert_eq!(left.key.firmware.as_deref(), Some("simulated"));
    assert_eq!(left.saved_at, NOW);

    let light = FakeConnector::default();
    let mut next = link(&light);
    let later = NOW + Duration::from_millis(1_500);
    let taken = take_over(
        next.as_mut(),
        &com6(),
        Orientation::Landscape,
        &store,
        later,
    );
    assert_eq!(
        taken,
        Ok(TakeOver::Seeded {
            age: Duration::from_millis(1_500)
        })
    );
    assert_eq!(light.log().seeds, vec![frame]);
    assert!(store.left.borrow().is_empty(), "taken over once");
    let again = take_over(
        next.as_mut(),
        &com6(),
        Orientation::Landscape,
        &store,
        later,
    );
    assert_eq!(again, Ok(TakeOver::Nothing));
}

#[test]
fn a_baseline_that_does_not_fit_is_refused_and_removed() {
    let cases = [
        (
            com6(),
            Orientation::Landscape,
            NOW + MAX_HANDOFF_AGE + Duration::from_secs(1),
            Refusal::TooOld,
        ),
        (
            com6(),
            Orientation::Portrait,
            NOW,
            Refusal::OtherOrientation,
        ),
        (
            com6(),
            Orientation::Landscape,
            NOW - Duration::from_secs(1),
            Refusal::FromTheFuture,
        ),
    ];
    for (address, orientation, now, refusal) in cases {
        let store = MemoryStore::default();
        let mut shown = link(&FakeConnector::default());
        shown.present(&theme_frame(shown.as_ref())).unwrap();
        hand_over(shown.as_ref(), address.clone(), &store, NOW).unwrap();
        let light = FakeConnector::default();
        let mut next = link(&light);
        next.set_orientation(orientation).unwrap();
        let taken = take_over(next.as_mut(), &address, orientation, &store, now);
        assert_eq!(taken, Ok(TakeOver::Refused(refusal)));
        assert!(light.log().seeds.is_empty(), "{refusal}: nothing seeded");
        assert!(store.left.borrow().is_empty(), "{refusal}: removed");
    }
}

#[test]
fn a_baseline_left_for_another_screen_stays_for_it() {
    let store = MemoryStore::default();
    let mut shown = link(&FakeConnector::default());
    shown.present(&theme_frame(shown.as_ref())).unwrap();
    hand_over(shown.as_ref(), DeviceAddress("COM7".into()), &store, NOW).unwrap();
    let light = FakeConnector::default();
    let mut next = link(&light);
    let taken = take_over(next.as_mut(), &com6(), Orientation::Landscape, &store, NOW);
    assert_eq!(taken, Ok(TakeOver::Nothing));
    assert_eq!(store.left.borrow().len(), 1);
}

/// A link that keeps no baseline (the port's defaults).
struct Plain(Box<dyn ScreenLink>);

impl ScreenLink for Plain {
    fn identity(&self) -> &bezel_core::domain::screen::ScreenIdentity {
        self.0.identity()
    }
    fn set_brightness(&mut self, b: bezel_core::domain::screen::Brightness) -> Result<()> {
        self.0.set_brightness(b)
    }
    fn set_orientation(&mut self, o: Orientation) -> Result<()> {
        self.0.set_orientation(o)
    }
    fn present(&mut self, frame: &Frame) -> Result<()> {
        self.0.present(frame)
    }
    fn screen_off(&mut self) -> Result<()> {
        self.0.screen_off()
    }
    fn release(&mut self) -> Result<()> {
        self.0.release()
    }
}

#[test]
fn a_link_without_baselines_leaves_and_takes_none() {
    let store = MemoryStore::default();
    let mut plain = Plain(link(&FakeConnector::default()));
    let frame = theme_frame(&plain);
    plain.present(&frame).unwrap();
    assert_eq!(plain.baseline(), None);
    assert_eq!(
        hand_over(&plain, com6(), &store, NOW),
        Ok(HandedOver::Nothing)
    );
    let mut shown = link(&FakeConnector::default());
    shown.present(&frame).unwrap();
    hand_over(shown.as_ref(), com6(), &store, NOW).unwrap();
    let taken = take_over(&mut plain, &com6(), Orientation::Landscape, &store, NOW);
    assert_eq!(taken, Ok(TakeOver::NotTaken));
}

#[test]
fn a_store_that_fails_says_so() {
    let store = MemoryStore {
        broken: true,
        ..MemoryStore::default()
    };
    let mut shown = link(&FakeConnector::default());
    shown.present(&theme_frame(shown.as_ref())).unwrap();
    let left = hand_over(shown.as_ref(), com6(), &store, NOW);
    assert!(matches!(left, Err(BezelError::Transport(_))));
}
