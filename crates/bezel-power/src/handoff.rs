//! Cooperative ownership between the Windows light runtime and Studio.
//! OS locks release on process exit, including crashes; no PID is killed.
//!
//! [`FileHandoffStore`] keeps, next to the locks, the frame each screen
//! shows when Studio hands it to Light, so that Light's first frame is a
//! difference and not a visible redraw.
use std::fs::{File, OpenOptions, TryLockError};
use std::io::{self, Read, Write};
use std::path::{Path, PathBuf};
use std::time::{Duration, Instant};

use bezel_core::domain::discovery::DeviceAddress;
use bezel_core::domain::frame::Frame;
use bezel_core::domain::geometry::{Orientation, Size};
use bezel_core::domain::handoff::{Baseline, HandedFrame, HandoffKey};
use bezel_core::ports::HandoffStore;
use bezel_core::{BezelError, Result};

/// A writable per-user coordination folder, keyed by the installation path.
pub fn runtime_directory(executable: &Path) -> io::Result<std::path::PathBuf> {
    use std::hash::{DefaultHasher, Hasher};
    let installation = executable
        .parent()
        .ok_or_else(|| io::Error::other("no installation directory"))?
        .canonicalize()?;
    let mut hasher = DefaultHasher::new();
    hasher.write(installation.to_string_lossy().to_lowercase().as_bytes());
    let base = std::env::var_os("LOCALAPPDATA")
        .or_else(|| std::env::var_os("APPDATA"))
        .ok_or_else(|| {
            io::Error::new(
                io::ErrorKind::NotFound,
                "no user application data directory",
            )
        })?;
    let directory = std::path::PathBuf::from(base)
        .join("io.github.slipalison.bezel/runtime")
        .join(format!("{:016x}", hasher.finish()));
    std::fs::create_dir_all(&directory)?;
    Ok(directory)
}

fn claim(directory: &Path, name: &str) -> io::Result<Option<File>> {
    let file = OpenOptions::new()
        .read(true)
        .write(true)
        .create(true)
        .truncate(false)
        .open(directory.join(name))?;
    match file.try_lock() {
        Ok(()) => Ok(Some(file)),
        Err(TryLockError::WouldBlock) => Ok(None),
        Err(TryLockError::Error(error)) => Err(error),
    }
}

/// Keep this handle for the lifetime of the light tray process.
pub fn light_instance(directory: &Path) -> io::Result<Option<File>> {
    claim(directory, "bezel-light-instance.lock")
}

/// Keep this handle until every light screen connection has been dropped.
pub fn light_screen(directory: &Path) -> io::Result<Option<File>> {
    claim(directory, "bezel-screen-control.lock")
}

/// Whether Studio currently owns (or is waiting for) the display.
pub fn studio_active(directory: &Path) -> io::Result<bool> {
    Ok(claim(directory, "bezel-studio-session.lock")?.is_none())
}

/// Held by Studio until full exit, including time spent hidden in the tray.
pub struct StudioSession {
    _studio: File,
    _screen: File,
    returns_to_light: bool,
    directory: std::path::PathBuf,
}

impl StudioSession {
    /// An existing Light stays idle until this session releases the screen.
    pub fn start_light(
        &self,
        executable: &Path,
        arguments: &[std::ffi::OsString],
    ) -> io::Result<()> {
        if light_instance(&self.directory)?.is_none() {
            return Ok(());
        }
        let mut command = std::process::Command::new(executable);
        command
            .args(arguments)
            .current_dir(
                executable
                    .parent()
                    .ok_or_else(|| io::Error::other("no Light installation directory"))?,
            )
            .stdin(std::process::Stdio::null())
            .stdout(std::process::Stdio::null())
            .stderr(std::process::Stdio::null());
        #[cfg(windows)]
        {
            use std::os::windows::process::CommandExt;
            command.creation_flags(0x08000000); // CREATE_NO_WINDOW
        }
        let mut child = command.spawn()?;
        let until = Instant::now() + Duration::from_secs(5);
        loop {
            if light_instance(&self.directory)?.is_none() {
                return Ok(());
            }
            if let Some(status) = child.try_wait()? {
                return Err(io::Error::other(format!("Bezel Light exited: {status}")));
            }
            if Instant::now() >= until {
                return Err(io::Error::new(
                    io::ErrorKind::TimedOut,
                    "Bezel Light did not start",
                ));
            }
            std::thread::sleep(Duration::from_millis(50));
        }
    }

    /// Stop the waiting Light too when the user explicitly chooses Quit.
    pub fn stop_light(&self) -> io::Result<()> {
        if light_instance(&self.directory)?.is_some() {
            return Ok(());
        }
        std::fs::write(self.directory.join("bezel-light-quit"), b"")?;
        let until = Instant::now() + Duration::from_secs(5);
        loop {
            if light_instance(&self.directory)?.is_some() {
                return Ok(());
            }
            if Instant::now() >= until {
                return Err(io::Error::new(
                    io::ErrorKind::TimedOut,
                    "Bezel Light did not quit",
                ));
            }
            std::thread::sleep(Duration::from_millis(50));
        }
    }

    /// Whether Light was already running when Studio opened.
    pub fn returns_to_light(&self) -> bool {
        self.returns_to_light
    }

    /// The coordination folder, where [`FileHandoffStore`] keeps the frames
    /// Studio leaves for Light.
    pub fn directory(&self) -> &Path {
        &self.directory
    }
}

/// Ask light to yield and wait for its normal serial cleanup before continuing.
pub fn enter_studio(directory: &Path, timeout: Duration) -> io::Result<StudioSession> {
    let returns_to_light = light_instance(directory)?.is_none();
    let studio = claim(directory, "bezel-studio-session.lock")?.ok_or_else(|| {
        io::Error::new(
            io::ErrorKind::AlreadyExists,
            "Studio already owns the screen",
        )
    })?;
    let until = Instant::now() + timeout;
    loop {
        if let Some(screen) = light_screen(directory)? {
            return Ok(StudioSession {
                _studio: studio,
                _screen: screen,
                returns_to_light,
                directory: directory.to_path_buf(),
            });
        }
        if Instant::now() >= until {
            return Err(io::Error::new(
                io::ErrorKind::TimedOut,
                "Light has not released the screen",
            ));
        }
        std::thread::sleep(Duration::from_millis(50));
    }
}

/// First bytes of a handoff file, with its format version.
const FRAME_MAGIC: &[u8; 6] = b"BZHF\x01\n";
/// Largest handoff file read: the biggest panel (1080 x 2320 RGBA) is
/// about 10 MB.
const MAX_FRAME_FILE: u64 = 64 * 1024 * 1024;

/// One file per screen in the coordination folder: the baseline Studio
/// left for it, written whole or not at all (a temporary file, flushed to
/// disk, then renamed over the old one) and removed when Light reads it.
#[derive(Debug, Clone)]
pub struct FileHandoffStore {
    directory: PathBuf,
}

impl FileHandoffStore {
    /// A store in `directory` (Light's and Studio's [`runtime_directory`]).
    pub fn new(directory: impl Into<PathBuf>) -> Self {
        Self {
            directory: directory.into(),
        }
    }

    /// The file of the screen at `address`. Port names are compared without
    /// case by Windows; the key inside the file is compared exactly.
    fn path(&self, address: &DeviceAddress) -> PathBuf {
        let mut hash: u64 = 0xcbf2_9ce4_8422_2325;
        for byte in address.0.to_lowercase().bytes() {
            hash = (hash ^ u64::from(byte)).wrapping_mul(0x0100_0000_01b3);
        }
        self.directory
            .join(format!("bezel-handoff-frame-{hash:016x}.bin"))
    }
}

fn file_error(what: &str, path: &Path, error: &io::Error) -> BezelError {
    BezelError::Transport(format!("{what} {}: {error}", path.display()))
}

impl HandoffStore for FileHandoffStore {
    fn save(&self, handed: &HandedFrame) -> Result<()> {
        let path = self.path(&handed.key.address);
        let temporary = path.with_extension(format!("tmp-{}", std::process::id()));
        let written = write_synced(&temporary, &encode(handed))
            .and_then(|()| std::fs::rename(&temporary, &path));
        if let Err(error) = written {
            // Best effort: a stray temporary file is never read.
            let _ = std::fs::remove_file(&temporary);
            return Err(file_error("cannot write the handoff file", &path, &error));
        }
        Ok(())
    }

    fn take(&self, address: &DeviceAddress) -> Result<Option<HandedFrame>> {
        let path = self.path(address);
        let bytes = match read_bounded(&path) {
            Ok(bytes) => bytes,
            Err(error) if error.kind() == io::ErrorKind::NotFound => return Ok(None),
            Err(error) => return Err(file_error("cannot read the handoff file", &path, &error)),
        };
        match std::fs::remove_file(&path) {
            Ok(()) => {}
            Err(error) if error.kind() == io::ErrorKind::NotFound => {}
            Err(error) => {
                return Err(file_error("cannot remove the handoff file", &path, &error));
            }
        }
        Ok(bytes.and_then(|b| decode(&b)))
    }
}

/// Writes `bytes` to a new `path` and flushes them to the disk.
fn write_synced(path: &Path, bytes: &[u8]) -> io::Result<()> {
    let mut file = File::create(path)?;
    file.write_all(bytes)?;
    file.sync_all()
}

/// The file's bytes; `None` when it is larger than any handoff file.
fn read_bounded(path: &Path) -> io::Result<Option<Vec<u8>>> {
    let file = File::open(path)?;
    let mut bytes = Vec::new();
    file.take(MAX_FRAME_FILE + 1).read_to_end(&mut bytes)?;
    Ok((bytes.len() as u64 <= MAX_FRAME_FILE).then_some(bytes))
}

fn put_text(out: &mut Vec<u8>, text: &str) {
    let bytes = text.as_bytes();
    let len = u16::try_from(bytes.len()).unwrap_or(u16::MAX);
    out.extend_from_slice(&len.to_le_bytes());
    out.extend_from_slice(&bytes[..usize::from(len)]);
}

/// The file format: magic, saved-at milliseconds (u64), orientation (u8),
/// width and height (u32), address, model, firmware flag and firmware
/// (u16-prefixed UTF-8), then the RGBA pixels. Little-endian throughout.
fn encode(handed: &HandedFrame) -> Vec<u8> {
    let frame = &handed.baseline.frame;
    let mut out = Vec::with_capacity(64 + frame.as_rgba().len());
    out.extend_from_slice(FRAME_MAGIC);
    let millis = u64::try_from(handed.saved_at.as_millis()).unwrap_or(u64::MAX);
    out.extend_from_slice(&millis.to_le_bytes());
    let orientation = Orientation::ALL
        .iter()
        .position(|o| *o == handed.baseline.orientation)
        .unwrap_or(0);
    out.push(orientation as u8);
    out.extend_from_slice(&frame.size().width.to_le_bytes());
    out.extend_from_slice(&frame.size().height.to_le_bytes());
    put_text(&mut out, &handed.key.address.0);
    put_text(&mut out, &handed.key.model);
    out.push(u8::from(handed.key.firmware.is_some()));
    put_text(&mut out, handed.key.firmware.as_deref().unwrap_or_default());
    out.extend_from_slice(frame.as_rgba());
    out
}

/// Reads the fields of a handoff file in order.
struct Fields<'a>(&'a [u8]);

impl<'a> Fields<'a> {
    fn bytes(&mut self, n: usize) -> Option<&'a [u8]> {
        let (head, rest) = self.0.split_at_checked(n)?;
        self.0 = rest;
        Some(head)
    }
    fn array<const N: usize>(&mut self) -> Option<[u8; N]> {
        self.bytes(N)?.try_into().ok()
    }
    fn text(&mut self) -> Option<String> {
        let len = u16::from_le_bytes(self.array()?);
        let bytes = self.bytes(usize::from(len))?;
        String::from_utf8(bytes.to_vec()).ok()
    }
}

/// A handoff file's content; `None` when it is not one, or is cut short.
fn decode(bytes: &[u8]) -> Option<HandedFrame> {
    let mut fields = Fields(bytes);
    if fields.bytes(FRAME_MAGIC.len())? != FRAME_MAGIC {
        return None;
    }
    let saved_at = Duration::from_millis(u64::from_le_bytes(fields.array()?));
    let orientation = *Orientation::ALL.get(usize::from(fields.array::<1>()?[0]))?;
    let width = u32::from_le_bytes(fields.array()?);
    let height = u32::from_le_bytes(fields.array()?);
    let address = DeviceAddress(fields.text()?);
    let model = fields.text()?;
    let has_firmware = fields.array::<1>()?[0] == 1;
    let firmware = fields.text()?;
    let frame = Frame::from_rgba(Size::new(width, height), fields.0.to_vec())?;
    Some(HandedFrame {
        key: HandoffKey {
            address,
            model,
            firmware: has_firmware.then_some(firmware),
        },
        saved_at,
        baseline: Baseline { orientation, frame },
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::atomic::{AtomicU64, Ordering};
    use std::sync::mpsc;
    use std::time::SystemTime;

    fn directory() -> std::path::PathBuf {
        static NEXT: AtomicU64 = AtomicU64::new(0);
        let unique = SystemTime::now()
            .duration_since(SystemTime::UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let sequence = NEXT.fetch_add(1, Ordering::Relaxed);
        let path = std::env::temp_dir().join(format!(
            "bezel-handoff-{}-{unique}-{sequence}",
            std::process::id()
        ));
        std::fs::create_dir(&path).unwrap();
        path
    }

    fn handed(address: &str, firmware: Option<&str>) -> HandedFrame {
        let mut frame = Frame::filled(Size::new(3, 2), bezel_core::domain::frame::Rgba::BLACK);
        frame.as_rgba_mut()[5] = 77;
        HandedFrame {
            key: HandoffKey {
                address: DeviceAddress(address.into()),
                model: "turing-8.8".into(),
                firmware: firmware.map(Into::into),
            },
            saved_at: Duration::from_millis(1_790_000_000_123),
            baseline: Baseline {
                orientation: Orientation::ReverseLandscape,
                frame,
            },
        }
    }

    fn files(directory: &Path) -> Vec<String> {
        let mut names: Vec<String> = std::fs::read_dir(directory)
            .unwrap()
            .map(|e| e.unwrap().file_name().to_string_lossy().into_owned())
            .collect();
        names.sort();
        names
    }

    #[test]
    fn a_saved_frame_is_taken_back_once() {
        let directory = directory();
        let store = FileHandoffStore::new(&directory);
        let com6 = DeviceAddress("COM6".into());
        assert_eq!(store.take(&com6), Ok(None), "nothing left yet");
        let left = handed("COM6", Some("chs_88inch.dev1_rom1.90"));
        store.save(&left).unwrap();
        let other = handed("COM7", None);
        store.save(&other).unwrap();
        assert_eq!(
            files(&directory).len(),
            2,
            "one file per screen, no temporary"
        );
        // A newer save replaces the older one whole.
        let mut newer = left.clone();
        newer.saved_at += Duration::from_secs(1);
        store.save(&newer).unwrap();
        assert_eq!(store.take(&com6), Ok(Some(newer)));
        assert_eq!(store.take(&com6), Ok(None), "removed when taken");
        let com7 = DeviceAddress("COM7".into());
        assert_eq!(store.take(&com7), Ok(Some(other)));
        assert!(files(&directory).is_empty());
        std::fs::remove_dir_all(directory).unwrap();
    }

    #[test]
    fn a_damaged_file_is_ignored_and_removed() {
        let directory = directory();
        let store = FileHandoffStore::new(&directory);
        let com6 = DeviceAddress("COM6".into());
        let whole = encode(&handed("COM6", None));
        let damaged: Vec<Vec<u8>> = vec![
            Vec::new(),
            b"not a handoff file".to_vec(),
            whole[..whole.len() - 1].to_vec(),
            whole[..20].to_vec(),
            [whole.clone(), vec![0]].concat(),
            {
                let mut bad = whole.clone();
                bad[FRAME_MAGIC.len() + 8] = 9; // no such orientation
                bad
            },
        ];
        for bytes in damaged {
            std::fs::write(store.path(&com6), &bytes).unwrap();
            assert_eq!(store.take(&com6), Ok(None), "{} bytes", bytes.len());
            assert!(files(&directory).is_empty(), "removed");
        }
        assert!(decode(&whole).is_some());
        std::fs::remove_dir_all(directory).unwrap();
    }

    #[test]
    fn a_file_too_large_is_not_read() {
        let directory = directory();
        let store = FileHandoffStore::new(&directory);
        let com6 = DeviceAddress("COM6".into());
        let file = File::create(store.path(&com6)).unwrap();
        file.set_len(MAX_FRAME_FILE + 1).unwrap();
        drop(file);
        assert_eq!(store.take(&com6), Ok(None));
        assert!(files(&directory).is_empty());
        std::fs::remove_dir_all(directory).unwrap();
    }

    #[test]
    fn a_folder_that_cannot_be_written_says_so() {
        let directory = directory();
        let missing = FileHandoffStore::new(directory.join("missing"));
        let error = missing.save(&handed("COM6", None)).unwrap_err();
        assert!(matches!(error, BezelError::Transport(_)), "{error}");
        // A folder where the file should be cannot be read as one.
        let store = FileHandoffStore::new(&directory);
        let com6 = DeviceAddress("COM6".into());
        std::fs::create_dir(store.path(&com6)).unwrap();
        assert!(store.take(&com6).is_err());
        assert!(files(&directory).len() == 1);
        std::fs::remove_dir_all(directory).unwrap();
    }

    #[test]
    fn long_texts_are_cut_at_the_format_limit() {
        let mut out = Vec::new();
        put_text(&mut out, &"a".repeat(70_000));
        assert_eq!(out.len(), 2 + usize::from(u16::MAX));
        assert_eq!(&out[..2], &u16::MAX.to_le_bytes());
    }

    #[test]
    fn studio_waits_for_light_then_light_can_resume_after_full_exit() {
        let directory = directory();
        let light = light_screen(&directory).unwrap().unwrap();
        let (tx, rx) = mpsc::channel();
        let worker_directory = directory.clone();
        let worker = std::thread::spawn(move || {
            let studio = enter_studio(&worker_directory, Duration::from_secs(3)).unwrap();
            tx.send(()).unwrap();
            std::thread::sleep(Duration::from_millis(100));
            drop(studio);
        });
        let until = Instant::now() + Duration::from_secs(2);
        while !studio_active(&directory).unwrap() {
            assert!(Instant::now() < until);
            std::thread::sleep(Duration::from_millis(5));
        }
        assert!(rx.try_recv().is_err(), "Studio must not open a busy screen");
        drop(light);
        rx.recv_timeout(Duration::from_secs(2)).unwrap();
        assert!(light_screen(&directory).unwrap().is_none());
        worker.join().unwrap();
        assert!(!studio_active(&directory).unwrap());
        assert!(light_screen(&directory).unwrap().is_some());
        std::fs::remove_dir_all(directory).unwrap();
    }

    #[test]
    fn closing_studio_reuses_light_and_launch_failure_keeps_ownership() {
        let directory = directory();
        let session = enter_studio(&directory, Duration::ZERO).unwrap();
        let missing = directory.join("missing-light.exe");
        assert!(session.start_light(&missing, &[]).is_err());
        assert!(studio_active(&directory).unwrap());
        assert!(light_screen(&directory).unwrap().is_none());
        let light = light_instance(&directory).unwrap().unwrap();
        session.start_light(&missing, &[]).unwrap();
        drop(light);
        drop(session);
        std::fs::remove_dir_all(directory).unwrap();
    }

    #[test]
    fn explicit_quit_stops_waiting_light_before_releasing_studio() {
        let directory = directory();
        let light = light_instance(&directory).unwrap().unwrap();
        let session = enter_studio(&directory, Duration::ZERO).unwrap();
        let folder = directory.clone();
        let worker = std::thread::spawn(move || {
            let until = Instant::now() + Duration::from_secs(3);
            while !folder.join("bezel-light-quit").exists() {
                assert!(Instant::now() < until);
                std::thread::sleep(Duration::from_millis(10));
            }
            assert!(studio_active(&folder).unwrap());
            drop(light);
        });
        session.stop_light().unwrap();
        worker.join().unwrap();
        assert!(studio_active(&directory).unwrap());
        drop(session);
        std::fs::remove_dir_all(directory).unwrap();
    }

    #[test]
    fn timeout_clears_studio_request_and_duplicate_light_is_rejected() {
        let directory = directory();
        let instance = light_instance(&directory).unwrap().unwrap();
        assert!(light_instance(&directory).unwrap().is_none());
        let screen = light_screen(&directory).unwrap().unwrap();
        assert!(enter_studio(&directory, Duration::ZERO).is_err());
        assert!(!studio_active(&directory).unwrap());
        drop(screen);
        drop(instance);
        assert!(light_instance(&directory).unwrap().is_some());
        std::fs::remove_dir_all(directory).unwrap();
    }
}
