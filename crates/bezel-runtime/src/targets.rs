//! Remember a display's wake endpoint across owner restarts. A disappearing
//! SoC address must never fall back to an unrelated connected screen.
use bezel_core::{Result, app::choose_screen, domain::discovery::Screen};
use serde::{Deserialize, Serialize};
use std::{
    collections::BTreeMap,
    path::PathBuf,
    sync::{Arc, Mutex},
};

#[derive(Clone, PartialEq, Eq, Serialize, Deserialize)]
struct Anchor {
    address: String,
    vid: u16,
    pid: u16,
    serial: Option<String>,
}
pub(crate) struct Targets {
    path: PathBuf,
    anchors: Mutex<BTreeMap<String, Anchor>>,
}
impl Targets {
    pub fn load(path: PathBuf) -> Self {
        let anchors = std::fs::metadata(&path)
            .ok()
            .filter(|m| m.len() <= 65536)
            .and_then(|_| std::fs::read(&path).ok())
            .and_then(|bytes| serde_json::from_slice(&bytes).ok())
            .unwrap_or_default();
        Self {
            path,
            anchors: Mutex::new(anchors),
        }
    }
    pub fn remember(&self, screens: &[Screen]) {
        let Ok(mut anchors) = self.anchors.lock() else {
            return;
        };
        let mut changed = false;
        for screen in screens {
            let (Some(display), Some(wake)) = (&screen.display, &screen.wake) else {
                continue;
            };
            let anchor = Anchor {
                address: wake.address.0.clone(),
                vid: wake.usb.vid,
                pid: wake.usb.pid,
                serial: wake.serial_number.clone(),
            };
            if anchors.get(&display.address.0) != Some(&anchor) {
                anchors.insert(display.address.0.clone(), anchor);
                changed = true;
            }
        }
        if !changed || self.path.as_os_str().is_empty() {
            return;
        }
        // This is a recovery cache, never a reason to refuse a working screen.
        let _ = (|| -> std::io::Result<()> {
            if let Some(parent) = self.path.parent() {
                std::fs::create_dir_all(parent)?;
            }
            let bytes = serde_json::to_vec(&*anchors)?;
            let temporary = self.path.with_extension("tmp");
            std::fs::write(&temporary, bytes)?;
            std::fs::rename(temporary, &self.path)
        })();
    }
    fn resolve(&self, screens: Vec<Screen>, key: &str) -> Result<Screen> {
        self.remember(&screens);
        if screens.iter().any(|s| s.answers_to(key)) {
            return choose_screen(screens, Some(key));
        }
        let anchor = self.anchors.lock().ok().and_then(|a| a.get(key).cloned());
        if let Some(anchor) = anchor
            && let Some(screen) = screens.iter().find(|s| {
                s.wake.as_ref().is_some_and(|w| {
                    w.address.0 == anchor.address
                        && w.usb.vid == anchor.vid
                        && w.usb.pid == anchor.pid
                        && w.serial_number == anchor.serial
                })
            })
        {
            return Ok(screen.clone());
        }
        choose_screen(screens, Some(key))
    }
}
pub(crate) struct Target {
    pub key: String,
    pub remembered: Arc<Targets>,
}
impl Target {
    pub fn resolve(&self, screens: Vec<Screen>) -> Result<Screen> {
        self.remembered.resolve(screens, &self.key)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use bezel_core::{app::discover_screens, ports::DeviceBus};
    use bezel_devices::FakeBus;
    #[test]
    fn sleeping_display_is_recovered_by_its_remembered_wake_chip_after_restart() {
        let path = std::env::temp_dir().join(format!("bezel-targets-{}.json", std::process::id()));
        let _ = std::fs::remove_file(&path);
        let bus = FakeBus::turing_88();
        let awake = discover_screens(&bus).unwrap();
        let display = awake[0].display.as_ref().unwrap().address.0.clone();
        let wake = awake[0].wake.clone().unwrap();
        Targets::load(path.clone()).remember(&awake);
        let sleeping = discover_screens(&FakeBus::new(vec![wake.clone()])).unwrap();
        let restored = Targets::load(path.clone());
        assert!(choose_screen(sleeping.clone(), Some(&display)).is_err());
        assert_eq!(
            restored.resolve(sleeping.clone(), &display).unwrap().wake,
            Some(wake.clone())
        );
        let mut renumbered = bus.endpoints().unwrap();
        renumbered[1].address.0 = "COM77".into();
        let back = restored
            .resolve(
                discover_screens(&FakeBus::new(renumbered)).unwrap(),
                &display,
            )
            .unwrap();
        assert_eq!(back.display.unwrap().address.0, "COM77");
        assert_eq!(
            Targets::load(path.clone())
                .resolve(sleeping.clone(), "COM77")
                .unwrap()
                .wake,
            Some(wake.clone())
        );
        assert!(restored.resolve(sleeping, "unrelated-screen").is_err());
        let mut other = wake;
        other.address.0 = "COM99".into();
        assert!(
            restored
                .resolve(
                    discover_screens(&FakeBus::new(vec![other])).unwrap(),
                    &display
                )
                .is_err()
        );
        let endpoints = bus.endpoints().unwrap();
        let mut swapped = endpoints[0].clone();
        swapped.serial_number = Some("different-unit".into());
        assert!(
            restored
                .resolve(
                    discover_screens(&FakeBus::new(vec![swapped])).unwrap(),
                    &display
                )
                .is_err()
        );
        std::fs::remove_file(path).unwrap();
    }
}
