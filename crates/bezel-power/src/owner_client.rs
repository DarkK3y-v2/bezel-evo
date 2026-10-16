//! Studio composition adapter: Light first, lock-protected legacy recovery
//! only after the local transport is known to be unavailable.
use crate::{
    handoff::{self, StudioSession},
    owner_pipe::PipeChannel,
    owner_protocol::RemoteConnector,
};
use bezel_core::domain::discovery::Screen;
use bezel_core::ports::{ScreenConnector, ScreenLink};
use bezel_core::{BezelError, Result};
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};
use std::time::Duration;

#[derive(Default)]
struct State {
    remote: Option<RemoteConnector>,
    fallback: Option<StudioSession>,
}
/// Shared by all Studio links, including background documents and storage jobs.
#[derive(Clone)]
pub struct LightConnector {
    direct: Arc<dyn ScreenConnector + Send + Sync>,
    executable: PathBuf,
    directory: PathBuf,
    state: Arc<Mutex<State>>,
}
impl LightConnector {
    /// Does not connect, launch Light, or write to a device until a use case asks.
    pub fn new(
        executable: &Path,
        direct: Arc<dyn ScreenConnector + Send + Sync>,
    ) -> std::io::Result<Self> {
        Ok(Self {
            direct,
            executable: executable.with_file_name("bezel.exe"),
            directory: handoff::runtime_directory(executable)?,
            state: Arc::default(),
        })
    }
    /// Compatibility baseline files are used only by the legacy fallback.
    pub fn directory(&self) -> &Path {
        &self.directory
    }
    fn remote(&self) -> std::io::Result<RemoteConnector> {
        if let Ok(channel) = PipeChannel::connect(&self.directory, Duration::from_millis(100)) {
            return Ok(RemoteConnector::new(Box::new(channel)));
        }
        if handoff::light_instance(&self.directory)?.is_some() {
            let mut command = std::process::Command::new(&self.executable);
            command
                .arg("--light-owner")
                .current_dir(
                    self.executable
                        .parent()
                        .ok_or_else(|| std::io::Error::other("no Light folder"))?,
                )
                .stdin(std::process::Stdio::null())
                .stdout(std::process::Stdio::null())
                .stderr(std::process::Stdio::null());
            use std::os::windows::process::CommandExt;
            command.creation_flags(0x08000000).spawn()?;
        }
        PipeChannel::connect(&self.directory, Duration::from_secs(5))
            .map(|channel| RemoteConnector::new(Box::new(channel)))
    }
    fn with_connector<T>(&self, op: impl FnOnce(&dyn ScreenConnector) -> Result<T>) -> Result<T> {
        let mut state = self
            .state
            .lock()
            .map_err(|_| BezelError::Transport("Light session lock poisoned".into()))?;
        if state.fallback.is_some() {
            return op(self.direct.as_ref());
        }
        if state
            .remote
            .as_ref()
            .is_some_and(|remote| !remote.connected())
        {
            state.remote = None;
        }
        if state.remote.is_none() {
            match self.remote() {
                Ok(remote) => state.remote = Some(remote),
                Err(_) => {
                    // No device operation is replayed. The current connect or
                    // explicit restart has not been sent to any owner yet.
                    state.fallback = Some(
                        handoff::enter_studio(&self.directory, Duration::from_secs(10)).map_err(
                            |e| {
                                BezelError::Transport(format!(
                                    "Light unavailable; direct takeover: {e}"
                                ))
                            },
                        )?,
                    );
                    return op(self.direct.as_ref());
                }
            }
        }
        let remote = state
            .remote
            .as_ref()
            .ok_or_else(|| BezelError::Transport("no Light session".into()))?;
        op(remote)
    }
    /// Starts the old waiting Light when recovering from a failed owner.
    pub fn prepare_close(&self, arguments: &[std::ffi::OsString]) -> std::io::Result<()> {
        let state = self
            .state
            .lock()
            .map_err(|_| std::io::Error::other("Light session lock poisoned"))?;
        if let Some(session) = &state.fallback {
            session.start_light(&self.executable, arguments)?;
        }
        Ok(())
    }
    /// Explicit Quit stops Light as well. Ordinary window close does not.
    pub fn stop_light(&self) -> std::io::Result<()> {
        let state = self
            .state
            .lock()
            .map_err(|_| std::io::Error::other("Light session lock poisoned"))?;
        if let Some(session) = &state.fallback {
            return session.stop_light();
        }
        if handoff::light_instance(&self.directory)?.is_none() {
            std::fs::write(self.directory.join("bezel-light-quit"), b"")?;
        }
        Ok(())
    }
}
impl ScreenConnector for LightConnector {
    fn manages_shutdown(&self) -> bool {
        self.state
            .lock()
            .is_ok_and(|state| state.fallback.is_none())
    }
    fn connect(&self, screen: &Screen) -> Result<Box<dyn ScreenLink>> {
        let inner = self.with_connector(|c| c.connect(screen))?;
        Ok(Box::new(SessionLink {
            inner,
            _state: Arc::clone(&self.state),
        }))
    }
    fn restart(&self, screen: &Screen) -> Result<()> {
        self.with_connector(|c| c.restart(screen))
    }
}

// The legacy screen lock outlives every direct link, including a link
// temporarily lent to a delivery/storage job when Tauri state is dropping.
struct SessionLink {
    inner: Box<dyn ScreenLink>,
    _state: Arc<Mutex<State>>,
}
impl ScreenLink for SessionLink {
    fn manages_shutdown(&self) -> bool {
        self.inner.manages_shutdown()
    }
    fn identity(&self) -> &bezel_core::domain::screen::ScreenIdentity {
        self.inner.identity()
    }
    fn presentation_paused(&self) -> bool {
        self.inner.presentation_paused()
    }
    fn last_transfer(&self) -> Option<bezel_core::ports::TransferStats> {
        self.inner.last_transfer()
    }
    fn set_brightness(&mut self, value: bezel_core::domain::screen::Brightness) -> Result<()> {
        self.inner.set_brightness(value)
    }
    fn set_orientation(&mut self, value: bezel_core::domain::geometry::Orientation) -> Result<()> {
        self.inner.set_orientation(value)
    }
    fn present(&mut self, frame: &bezel_core::domain::frame::Frame) -> Result<()> {
        self.inner.present(frame)
    }
    fn screen_off(&mut self) -> Result<()> {
        self.inner.screen_off()
    }
    fn turn_off_now(&mut self) -> Result<()> {
        self.inner.turn_off_now()
    }
    fn release(&mut self) -> Result<()> {
        self.inner.release()
    }
    fn baseline(&self) -> Option<bezel_core::domain::handoff::Baseline> {
        self.inner.baseline()
    }
    fn seed_baseline(&mut self, baseline: &bezel_core::domain::handoff::Baseline) -> bool {
        self.inner.seed_baseline(baseline)
    }
    fn storage(&mut self) -> Option<&mut dyn bezel_core::ports::ScreenStorage> {
        self.inner.storage()
    }
}

#[cfg(test)]
#[allow(clippy::unwrap_used)]
mod tests {
    use super::*;
    use bezel_core::{app::discover_screens, domain::screen::Brightness};
    use bezel_devices::{FakeBus, FakeConnector};
    #[test]
    fn missing_light_falls_back_under_legacy_lock_without_losing_studio() {
        let directory = Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("../../target")
            .join(format!("fallback-test-{}", std::process::id()));
        std::fs::create_dir_all(&directory).unwrap();
        let direct = FakeConnector::default();
        let client = LightConnector {
            direct: Arc::new(direct.clone()),
            executable: directory.join("missing-light.exe"),
            directory: directory.clone(),
            state: Arc::default(),
        };
        let screen = discover_screens(&FakeBus::turing_88()).unwrap().remove(0);
        let mut link = client.connect(&screen).unwrap();
        link.set_brightness(Brightness::MAX).unwrap();
        assert!(handoff::studio_active(&directory).unwrap());
        assert!(handoff::light_screen(&directory).unwrap().is_none());
        assert_eq!(direct.log().brightness, [Brightness::MAX]);
        drop(client);
        assert!(
            handoff::studio_active(&directory).unwrap(),
            "a borrowed link retains the legacy lock"
        );
        drop(link);
        assert!(!handoff::studio_active(&directory).unwrap());
        assert!(handoff::light_screen(&directory).unwrap().is_some());
        std::fs::remove_dir_all(directory).unwrap();
    }
}
