//! Studio overlay preferences; the shared diagnostics adapter owns logging.
use std::{
    io,
    path::Path,
    sync::atomic::{AtomicBool, AtomicU8, Ordering},
};
static OVERLAY: AtomicBool = AtomicBool::new(false);
static CORNER: AtomicU8 = AtomicU8::new(2);
pub fn enabled() -> bool {
    bezel_power::diagnostics::enabled()
}
pub fn overlay() -> bool {
    enabled() && OVERLAY.load(Ordering::Relaxed)
}
pub fn corner() -> crate::performance::Corner {
    crate::performance::Corner::from_index(CORNER.load(Ordering::Relaxed))
}
pub fn configure(
    path: &Path,
    on: bool,
    show: bool,
    corner: crate::performance::Corner,
) -> io::Result<()> {
    bezel_power::diagnostics::configure(path, on, false)?;
    OVERLAY.store(show, Ordering::Relaxed);
    CORNER.store(corner as u8, Ordering::Relaxed);
    tracing::info!(
        overlay = show,
        version = crate::EVO_VERSION,
        "debug enabled"
    );
    Ok(())
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn debug_logs_are_opt_in_and_exclude_network_targets() {
        let path = std::env::temp_dir().join(format!("bezel-debug-{}.log", std::process::id()));
        let _ = std::fs::remove_file(&path);
        configure(&path, false, true, crate::performance::Corner::default()).unwrap();
        assert!(!enabled());
        assert!(!overlay());
        assert!(!path.exists());
        configure(&path, true, false, crate::performance::Corner::default()).unwrap();
        tracing::debug!(target: "bezel_devices::test", bytes = 123u64, "serial diagnostic");
        tracing::warn!(target: "bezel_klipy::test", "network secret must be excluded");
        configure(&path, false, false, crate::performance::Corner::default()).unwrap();
        let text = std::fs::read_to_string(&path).unwrap();
        assert!(text.contains("serial diagnostic"));
        assert!(!text.contains("network secret"));
        std::fs::remove_file(path).unwrap();
    }
}
