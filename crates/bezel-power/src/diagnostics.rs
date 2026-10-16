//! Explicitly enabled, bounded diagnostics. Network targets are never recorded.
use std::fs::{File, OpenOptions};
use std::io::{self, Seek, SeekFrom, Write};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::{Mutex, OnceLock};
use tracing::span::{Attributes, Id, Record};
use tracing::{Event, Metadata, Subscriber};

static ENABLED: AtomicBool = AtomicBool::new(false);
static OUTPUT: Mutex<Option<Output>> = Mutex::new(None);
static CONFIGURED_PATH: Mutex<Option<PathBuf>> = Mutex::new(None);
static INSTALLED: OnceLock<()> = OnceLock::new();
const LIMIT: u64 = 2 * 1024 * 1024;
static IMPORTANT: AtomicBool = AtomicBool::new(false);
struct Output {
    file: File,
    path: PathBuf,
    bytes: u64,
}

impl Output {
    fn open(path: &Path) -> io::Result<Self> {
        // Append-only handles on Windows cannot be truncated for rotation.
        let mut file = OpenOptions::new()
            .create(true)
            .write(true)
            .truncate(false)
            .open(path)?;
        let bytes = file.seek(SeekFrom::End(0))?;
        Ok(Self {
            file,
            path: path.to_owned(),
            bytes,
        })
    }
    fn write_record(&mut self, bytes: &[u8]) -> io::Result<()> {
        if bytes.len() as u64 > LIMIT {
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "diagnostic record exceeds limit",
            ));
        }
        if self.bytes + bytes.len() as u64 > LIMIT {
            let previous = self.path.with_extension("1.log");
            let oldest = self.path.with_extension("2.log");
            if previous.exists() {
                std::fs::copy(&previous, &oldest)?;
            }
            std::fs::copy(&self.path, &previous)?;
            self.file.set_len(0)?;
            self.file.seek(SeekFrom::Start(0))?;
            self.bytes = 0;
        }
        self.file.write_all(bytes)?;
        self.bytes += bytes.len() as u64;
        Ok(())
    }
}

pub fn enabled() -> bool {
    ENABLED.load(Ordering::Relaxed)
}

fn install() {
    INSTALLED.get_or_init(|| {
        let _ = tracing::subscriber::set_global_default(DebugSubscriber);
    });
}

/// Configure the common bounded log sink. Light keeps important events when debug is off.
pub fn configure(path: &Path, on: bool, important: bool) -> io::Result<()> {
    install();
    *CONFIGURED_PATH
        .lock()
        .unwrap_or_else(std::sync::PoisonError::into_inner) = Some(path.to_owned());
    let mut output = OUTPUT
        .lock()
        .unwrap_or_else(std::sync::PoisonError::into_inner);
    if (on || important) && output.as_ref().is_none_or(|o| o.path != path) {
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent)?;
        }
        *output = Some(Output::open(path)?);
    }
    if !on && !important {
        *output = None;
    }
    ENABLED.store(on, Ordering::Relaxed);
    IMPORTANT.store(important, Ordering::Relaxed);
    Ok(())
}
/// Windows per-user diagnostics folder, shared by Studio and Light.
pub fn logs_directory() -> PathBuf {
    std::env::var_os("LOCALAPPDATA")
        .or_else(|| std::env::var_os("XDG_STATE_HOME"))
        .map(PathBuf::from)
        .unwrap_or_else(std::env::temp_dir)
        .join("io.github.slipalison.bezel/logs")
}

fn allowed(metadata: &Metadata<'_>) -> bool {
    if IMPORTANT.load(Ordering::Relaxed) && metadata.target() != "bezel_light" {
        return false;
    }
    (enabled()
        || (IMPORTANT.load(Ordering::Relaxed)
            && metadata.target() == "bezel_light"
            && metadata.level() <= &tracing::Level::INFO))
        && metadata.level() <= &tracing::Level::DEBUG
        && metadata.target().starts_with("bezel")
        && !metadata.target().starts_with("bezel_klipy")
}

struct Fields(serde_json::Map<String, serde_json::Value>);
impl tracing::field::Visit for Fields {
    fn record_str(&mut self, field: &tracing::field::Field, value: &str) {
        self.0.insert(field.name().into(), value.into());
    }
    fn record_i64(&mut self, field: &tracing::field::Field, value: i64) {
        self.0.insert(field.name().into(), value.into());
    }
    fn record_debug(&mut self, field: &tracing::field::Field, value: &dyn std::fmt::Debug) {
        self.0
            .insert(field.name().into(), format!("{value:?}").into());
    }
    fn record_f64(&mut self, field: &tracing::field::Field, value: f64) {
        self.0.insert(field.name().into(), serde_json::json!(value));
    }
    fn record_u64(&mut self, field: &tracing::field::Field, value: u64) {
        self.0.insert(field.name().into(), value.into());
    }
    fn record_bool(&mut self, field: &tracing::field::Field, value: bool) {
        self.0.insert(field.name().into(), value.into());
    }
}

struct DebugSubscriber;
impl Subscriber for DebugSubscriber {
    fn enabled(&self, metadata: &Metadata<'_>) -> bool {
        allowed(metadata)
    }
    fn register_callsite(&self, _: &'static Metadata<'static>) -> tracing::subscriber::Interest {
        tracing::subscriber::Interest::sometimes()
    }
    fn new_span(&self, _: &Attributes<'_>) -> Id {
        static IDS: AtomicU64 = AtomicU64::new(1);
        Id::from_u64(IDS.fetch_add(1, Ordering::Relaxed))
    }
    fn record(&self, _: &Id, _: &Record<'_>) {}
    fn record_follows_from(&self, _: &Id, _: &Id) {}
    fn enter(&self, _: &Id) {}
    fn exit(&self, _: &Id) {}
    fn event(&self, event: &Event<'_>) {
        if !allowed(event.metadata()) {
            return;
        }
        let mut fields = Fields(serde_json::Map::new());
        event.record(&mut fields);
        let record = serde_json::json!({
            "time": chrono::Utc::now().to_rfc3339(),
            "level": event.metadata().level().as_str(),
            "target": event.metadata().target(), "fields": fields.0
        });
        let Ok(mut bytes) = serde_json::to_vec(&record) else {
            return;
        };
        bytes.push(b'\n');
        let mut guard = OUTPUT
            .lock()
            .unwrap_or_else(std::sync::PoisonError::into_inner);
        let Some(output) = guard.as_mut() else {
            return;
        };
        let _ = output.write_record(&bytes);
    }
}

/// Fixed Light events; no arbitrary error text, document data or file paths.
#[derive(Clone, Copy, Debug)]
pub enum LightEvent {
    Start,
    Stop,
    ScreenOpened,
    ScreenReconnected,
    ScreenError,
    SessionOpened,
    Draft,
    Saved,
    ClosedSaved,
    ClosedUnsaved,
    Fallback,
    Sample,
    SampleError,
    Present,
    Canvas,
    SensorRestart,
    /// Audio capture consent changed: `on` or `off`.
    AudioConsent,
    /// The state a spectrum widget is drawn with changed.
    Spectrum,
}
/// Typed metrics keep private strings out of Light diagnostics.
pub fn light(event: LightEvent, screen: u64, millis: f64, kind: &'static str) {
    use LightEvent::*;
    let kind = match kind {
        "full" | "partial" | "unchanged" | "unknown" | "interval" | "process" | "link" | "io"
        | "scene" | "reader" | "configured" | "resume" | "client" | "direct" | "document"
        | "session" | "request" | "on" | "off" | "live" | "disabled" | "player-missing"
        | "unavailable" | "unsupported" | "demo" => kind,
        _ => "other",
    };
    let important = matches!(
        event,
        Start | Stop | ScreenOpened | ScreenReconnected | ScreenError | SampleError | Fallback
    );
    if important {
        tracing::info!(target:"bezel_light",event=?event,screen,millis,kind,"Light event");
    } else if enabled() {
        tracing::debug!(target:"bezel_light",event=?event,screen,millis,kind,"Light event");
    }
    if std::env::var_os("BEZEL_PERF_LOG").is_some_and(|v| v == "1")
        && matches!(event, Sample | Present)
    {
        eprintln!("bezel light: {event:?} screen={screen} ms={millis:.2} {kind}");
    }
}

/// Fixed labels only: never format an adapter's arbitrary error message.
static LAST_FAILURE: Mutex<Option<(String, String, i32)>> = Mutex::new(None);
pub fn failure(stage: &str, error: &io::Error) {
    let stage = label(stage);
    let reason = match error.kind() {
        io::ErrorKind::InvalidData if error.to_string() == "unsupported owner protocol" => {
            "version_mismatch"
        }
        io::ErrorKind::Other if error.to_string() == "incompatible Light server" => {
            "handshake_mismatch"
        }
        io::ErrorKind::TimedOut => "timeout",
        io::ErrorKind::PermissionDenied => "access_denied",
        io::ErrorKind::NotFound => "not_found",
        io::ErrorKind::UnexpectedEof | io::ErrorKind::BrokenPipe => "peer_closed",
        io::ErrorKind::InvalidData => "protocol_or_bounds",
        _ => "io_error",
    };
    *LAST_FAILURE
        .lock()
        .unwrap_or_else(std::sync::PoisonError::into_inner) = Some((
        stage.into(),
        reason.into(),
        error.raw_os_error().unwrap_or(0),
    ));
    tracing::warn!(target:"bezel_light",event="ChannelFailure",stage,reason,os_code=error.raw_os_error().unwrap_or(0),"owner channel failure");
}
fn label(value: &str) -> &str {
    match value {
        "server" | "connect" | "handshake" | "request_write" | "reply_read" | "packet_read"
        | "reply_write" | "request_rejected" | "session_lost" | "connect_failed"
        | "owner_unreachable" | "legacy_takeover" | "runtime_request" => value,
        _ => "unknown",
    }
}
/// Persist only the fixed reason so Light and Studio report the same takeover.
pub fn fallback(directory: &Path, reason: &str) {
    let detail = LAST_FAILURE
        .lock()
        .unwrap_or_else(std::sync::PoisonError::into_inner)
        .clone();
    let value = serde_json::json!({"reason":label(reason),"detail":detail});
    let _ = std::fs::write(
        directory.join("bezel-light-fallback-reason"),
        value.to_string(),
    );
    log_fallback(&value);
}
fn log_fallback(value: &serde_json::Value) {
    let reason = label(value["reason"].as_str().unwrap_or("unknown"));
    let stage = label(value["detail"][0].as_str().unwrap_or("unknown"));
    let cause = match value["detail"][1].as_str().unwrap_or("unknown") {
        "timeout" => "timeout",
        "access_denied" => "access_denied",
        "not_found" => "not_found",
        "peer_closed" => "peer_closed",
        "protocol_or_bounds" => "protocol_or_bounds",
        "io_error" => "io_error",
        "version_mismatch" => "version_mismatch",
        "handshake_mismatch" => "handshake_mismatch",
        _ => "unknown",
    };
    let os_code = value["detail"][2].as_i64().unwrap_or(0);
    tracing::warn!(target:"bezel_light",event="Fallback",reason,stage,cause,os_code,"direct takeover");
    // Fallback is an important event even when Studio's verbose diagnostics
    // are off. Use the same bounded sink, without enabling other targets.
    if !enabled() && !IMPORTANT.load(Ordering::Relaxed) {
        let path = CONFIGURED_PATH
            .lock()
            .unwrap_or_else(std::sync::PoisonError::into_inner)
            .clone();
        if let Some(path) = path {
            let record = serde_json::json!({"time":chrono::Utc::now().to_rfc3339(),"level":"WARN","target":"bezel_light",
                "fields":{"event":"Fallback","reason":reason,"stage":stage,"cause":cause,"os_code":os_code}});
            if let Ok(mut bytes) = serde_json::to_vec(&record) {
                bytes.push(b'\n');
                let mut output = OUTPUT
                    .lock()
                    .unwrap_or_else(std::sync::PoisonError::into_inner);
                if output.is_none() {
                    if let Some(parent) = path.parent() {
                        let _ = std::fs::create_dir_all(parent);
                    }
                    *output = Output::open(&path).ok();
                }
                if let Some(output) = output.as_mut() {
                    let _ = output.write_record(&bytes);
                }
            }
        }
    }
}
pub fn observed_fallback(directory: &Path) {
    let value = std::fs::File::open(directory.join("bezel-light-fallback-reason"))
        .and_then(|file| {
            use std::io::Read;
            let mut text = String::new();
            file.take(512).read_to_string(&mut text)?;
            Ok(text)
        })
        .ok()
        .and_then(|text| serde_json::from_str(&text).ok())
        .unwrap_or(serde_json::Value::Null);
    log_fallback(&value);
}
/// Log only protocol operation names, never scene keys or payloads.
pub fn runtime_request(metadata: &[u8]) {
    if !enabled() {
        return;
    }
    let value: serde_json::Value = serde_json::from_slice(metadata).unwrap_or_default();
    let command = match value["op"]["command"].as_str().unwrap_or("") {
        "Sensors" => "Sensors",
        "Options" => "Options",
        "Draft" => "Draft",
        "Image" => "Image",
        "Inspect" => "Inspect",
        "Measure" => "Measure",
        "Live" => "Live",
        "Cards" => "Cards",
        "Thumbnail" => "Thumbnail",
        "SensorRestarted" => "SensorRestarted",
        _ => "unknown",
    };
    tracing::debug!(target:"bezel_light",event="RuntimeRequest",command,"owner request");
}
pub fn runtime_reply(metadata_bytes: usize, payload_bytes: usize, rejected: bool) {
    if enabled() {
        tracing::debug!(target:"bezel_light",event="RuntimeReply",metadata_bytes,payload_bytes,rejected,"owner response");
    }
}
pub fn present_reason(screen: u64, kind: &str, reason: &str) {
    if !enabled() || kind != "full" {
        return;
    }
    let reason = match reason {
        "connection"
        | "orientation"
        | "screen_off"
        | "release"
        | "previous_write_failed"
        | "dirty_full_canvas"
        | "device_requested"
        | "no_baseline"
        | "diff_larger_than_full" => reason,
        _ => "unreported_by_driver",
    };
    tracing::debug!(target:"bezel_light",event="FullFrame",screen,reason,"full frame reason");
}

/// Name the opened device without admitting arbitrary filesystem strings.
pub fn device(event: LightEvent, screen: u64, port: &str, model: &'static str) {
    let port = if port
        .strip_prefix("COM")
        .is_some_and(|digits| !digits.is_empty() && digits.bytes().all(|b| b.is_ascii_digit()))
    {
        port
    } else {
        "other"
    };
    let model =
        if bezel_core::domain::catalog::model_by_id(bezel_core::domain::device::ModelId(model))
            .is_some()
        {
            model
        } else {
            "unknown"
        };
    tracing::info!(target:"bezel_light",event=?event,screen,port,model,"screen link");
}

/// Refresh the same persisted debug choice used by Studio, without logging its path.
pub fn light_debug(settings: &Path, environment: bool) -> bool {
    environment
        || std::fs::read(settings)
            .ok()
            .and_then(|b| serde_json::from_slice::<serde_json::Value>(&b).ok())
            .is_some_and(|v| v["debug"].as_bool() == Some(true))
}
/// Keeps preference refresh and start/stop events alive for a Light process.
pub struct LightLog {
    stop: std::sync::Arc<AtomicBool>,
}
impl LightLog {
    /// Two MiB per file, three files total; errors/events remain enabled without debug.
    pub fn start(settings: PathBuf) -> io::Result<Self> {
        let environment = std::env::var_os("BEZEL_DEBUG").is_some_and(|v| v == "1");
        let path = logs_directory().join("light.log");
        configure(&path, light_debug(&settings, environment), true)?;
        light(LightEvent::Start, 0, 0.0, "process");
        let stop = std::sync::Arc::new(AtomicBool::new(false));
        let flag = stop.clone();
        std::thread::Builder::new()
            .name("bezel-light-log-settings".into())
            .spawn(move || {
                while !flag.load(Ordering::Relaxed) {
                    let _ = configure(&path, light_debug(&settings, environment), true);
                    for _ in 0..10 {
                        if flag.load(Ordering::Relaxed) {
                            return;
                        }
                        std::thread::sleep(std::time::Duration::from_millis(100));
                    }
                }
            })?;
        Ok(Self { stop })
    }
}
impl Drop for LightLog {
    fn drop(&mut self) {
        self.stop.store(true, Ordering::Relaxed);
        light(LightEvent::Stop, 0, 0.0, "process");
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    fn path(name: &str) -> PathBuf {
        let dir = Path::new(env!("CARGO_MANIFEST_DIR")).join("../../target/diagnostics-tests");
        std::fs::create_dir_all(&dir).unwrap();
        dir.join(format!("{name}-{}.log", std::process::id()))
    }
    #[test]
    fn rotation_bounds_all_three_files_and_rejects_an_oversized_record() {
        let path = path("rotation");
        let _ = std::fs::remove_file(&path);
        let mut output = Output::open(&path).unwrap();
        for _ in 0..5 {
            output.write_record(&vec![b'x'; LIMIT as usize]).unwrap();
        }
        assert!(output.write_record(&vec![0; LIMIT as usize + 1]).is_err());
        drop(output);
        for file in [
            path.clone(),
            path.with_extension("1.log"),
            path.with_extension("2.log"),
        ] {
            assert!(std::fs::metadata(&file).unwrap().len() <= LIMIT);
            std::fs::remove_file(file).unwrap();
        }
        assert!(!path.with_extension("3.log").exists());
    }
    #[test]
    fn preference_debug_filter_timestamps_and_path_privacy() {
        let path = path("events");
        let settings = path.with_extension("json");
        let _ = std::fs::remove_file(&path);
        std::fs::write(&settings, br#"{"debug":false}"#).unwrap();
        assert!(!light_debug(&settings, false));
        assert!(light_debug(&settings, true));
        std::fs::write(&settings, br#"{"debug":true}"#).unwrap();
        assert!(light_debug(&settings, false));
        configure(&path, false, true).unwrap();
        light(LightEvent::Start, 1, 0.0, "process");
        light(LightEvent::Sample, 1, 100.0, "interval");
        configure(&path, true, true).unwrap();
        light(LightEvent::Canvas, 1, 0.0, r"C:\Users\secret\private.theme");
        light(LightEvent::Present, 2, 400.0, "partial");
        device(
            LightEvent::ScreenOpened,
            1,
            r"C:\Users\secret\file",
            "private.model",
        );
        tracing::warn!(target:"bezel_media",path=r"C:\Users\secret\private.mp4","private path must not reach Light logs");
        tracing::warn!(target:"bezel_klipy","excluded private network data");
        failure(
            "reply_read",
            &io::Error::new(io::ErrorKind::UnexpectedEof, r"C:\Users\secret\private"),
        );
        let directory = path.parent().unwrap();
        fallback(directory, "owner_unreachable");
        observed_fallback(directory);
        present_reason(1, "full", "orientation");
        configure(&path, false, false).unwrap();
        fallback(directory, "connect_failed");
        let text = std::fs::read_to_string(&path).unwrap();
        assert!(text.contains("Start"));
        assert!(text.contains("Canvas"));
        assert!(text.contains("partial"));
        assert!(text.contains("peer_closed"));
        assert!(text.contains("owner_unreachable"));
        assert!(
            text.contains("connect_failed"),
            "fallback is logged with debug off too"
        );
        assert!(text.contains("orientation"));
        assert!(!text.contains("Sample"));
        assert!(!text.contains("secret"));
        assert!(!text.contains("private"));
        for line in text.lines() {
            let value: serde_json::Value = serde_json::from_str(line).unwrap();
            assert!(value["time"].as_str().unwrap().contains('T'));
        }
        std::fs::remove_file(path).unwrap();
        std::fs::remove_file(settings).unwrap();
    }
}
