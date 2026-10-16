//! Versioned, bounded IPC framing. This protocol never carries device packets.
use bezel_core::domain::{
    catalog::MODELS,
    discovery::Screen,
    frame::Frame,
    geometry::{Orientation, Size},
    job::{CancelToken, Job, JobPhase, Progress},
    screen::{Brightness, Confirm, ScreenIdentity},
    standby::{PlanB, Standby},
    storage::{
        Capacity, Confirmed, FileName, Operation, RemotePath, Repeat, StartMode, StorageInfo,
        StorageLocation,
    },
};
use bezel_core::ports::{ScreenChannel, ScreenConnector, ScreenLink, ScreenStorage, TransferStats};
use bezel_core::{BezelError, Result};
use serde::{Deserialize, Serialize};
use std::io::{self, Read, Write};
use std::sync::{Arc, Mutex};

/// Largest metadata block accepted before any allocation.
pub const MAX_METADATA: usize = 64 * 1024;
/// Absolute payload ceiling; upload additionally checks the device's profile.
pub const MAX_PAYLOAD: usize = 120_000_000;
const MAGIC: &[u8; 8] = b"BZLO\x02\0\0\0";

/// Encodes a packet with checked lengths. RGBA/media remain binary.
pub fn write_packet(writer: &mut impl Write, metadata: &[u8], payload: &[u8]) -> io::Result<()> {
    limits(metadata.len(), payload.len())?;
    writer.write_all(MAGIC)?;
    writer.write_all(&(metadata.len() as u32).to_le_bytes())?;
    writer.write_all(&(payload.len() as u32).to_le_bytes())?;
    writer.write_all(metadata)?;
    writer.write_all(payload)
}
fn limits(metadata: usize, payload: usize) -> io::Result<()> {
    if metadata > MAX_METADATA || payload > MAX_PAYLOAD {
        Err(io::Error::new(
            io::ErrorKind::InvalidData,
            "owner message exceeds limits",
        ))
    } else {
        Ok(())
    }
}
/// Validates magic/version and lengths before reading either body.
pub fn read_packet(reader: &mut impl Read) -> io::Result<(Vec<u8>, Vec<u8>)> {
    let mut header = [0; 16];
    reader.read_exact(&mut header)?;
    if &header[..8] != MAGIC {
        return Err(io::Error::new(
            io::ErrorKind::InvalidData,
            "unsupported owner protocol",
        ));
    }
    let metadata = u32::from_le_bytes(header[8..12].try_into().map_err(io::Error::other)?) as usize;
    let payload = u32::from_le_bytes(header[12..16].try_into().map_err(io::Error::other)?) as usize;
    limits(metadata, payload)?;
    let mut text = vec![0; metadata];
    reader.read_exact(&mut text)?;
    if payload > 64 * 1024 * 1024
        && serde_json::from_slice::<serde_json::Value>(&text).is_ok_and(|v| v["runtime"] == 2)
    {
        return Err(io::Error::new(
            io::ErrorKind::InvalidData,
            "runtime payload exceeds limits",
        ));
    }
    let mut bytes = vec![0; payload];
    reader.read_exact(&mut bytes)?;
    Ok((text, bytes))
}
fn transport(error: impl std::fmt::Display) -> BezelError {
    BezelError::Transport(format!("Light channel: {error}"))
}
fn invalid() -> BezelError {
    BezelError::InvalidInput("invalid owner command".into())
}

#[derive(Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
struct Request {
    screen: String,
    op: Op,
}
#[derive(Serialize, Deserialize)]
#[serde(tag = "command", deny_unknown_fields)]
enum Op {
    Identify,
    Brightness {
        percent: u8,
    },
    Orientation {
        index: u8,
    },
    Present {
        width: u32,
        height: u32,
    },
    Off,
    OffNow,
    Release,
    Restart,
    Info,
    List {
        folder: String,
    },
    Size {
        path: String,
    },
    Upload {
        path: String,
    },
    Delete {
        path: String,
        confirmed: bool,
    },
    Video {
        path: String,
        looping: bool,
        resume: bool,
    },
    Image {
        path: String,
    },
    Stop,
    Options {
        mode: u8,
        minutes: u8,
        confirmed: bool,
    },
    RestartSystem {
        confirmed: bool,
    },
}
#[derive(Serialize, Deserialize)]
#[serde(tag = "reply")]
enum Reply {
    Value {
        value: serde_json::Value,
    },
    Error {
        kind: String,
        message: String,
        partial: Option<u64>,
    },
    Progress {
        done: u64,
        total: u64,
    },
}
fn error_reply(error: BezelError) -> Reply {
    let (kind, message, partial) = match error {
        BezelError::Unsupported(message) => ("unsupported", message, None),
        BezelError::Cancelled { partial } => ("cancelled", String::new(), partial),
        BezelError::InvalidInput(message) => ("invalid", message, None),
        BezelError::NotConfirmed(message) => ("confirmation", message, None),
        BezelError::Hung(message) => ("hung", message, None),
        BezelError::Timeout(message) => ("timeout", message, None),
        BezelError::ScreenNotFound(message) => ("missing", message, None),
        BezelError::Transport(message) => ("device", message, None),
        error => ("device", error.to_string(), None),
    };
    Reply::Error {
        kind: kind.into(),
        message,
        partial,
    }
}

fn encode(value: &impl Serialize) -> Result<Vec<u8>> {
    serde_json::to_vec(value).map_err(transport)
}
fn decode<T: for<'a> Deserialize<'a>>(bytes: &[u8]) -> Result<T> {
    serde_json::from_slice(bytes).map_err(transport)
}

/// Discovery is never needed for a frame on an already identified screen.
pub(crate) fn supplies_frame(metadata: &[u8]) -> bool {
    serde_json::from_slice::<Request>(metadata).is_ok_and(|r| matches!(r.op, Op::Present { .. }))
}

/// Whether the operation needs a fresh enumeration.
pub fn needs_discovery(metadata: &[u8]) -> bool {
    !matches!(
        decode::<Request>(metadata),
        Ok(Request {
            op: Op::Present { .. },
            ..
        })
    )
}

/// Dispatches one authenticated request onto the existing core ports.
/// Progress callbacks return false when the client cancels or disconnects.
pub fn dispatch(
    connector: &dyn ScreenConnector,
    screens: &[Screen],
    metadata: &[u8],
    payload: &[u8],
    progress: &mut dyn FnMut(Progress) -> bool,
) -> Result<Vec<u8>> {
    let answer = (|| {
        limits(metadata.len(), payload.len()).map_err(transport)?;
        let request: Request = decode(metadata)?;
        let screen = screens
            .iter()
            .find(|s| s.answers_to(&request.screen))
            .ok_or_else(invalid)?;
        if !matches!(request.op, Op::Present { .. } | Op::Upload { .. }) && !payload.is_empty() {
            return Err(invalid());
        }
        if matches!(request.op, Op::Restart) {
            connector.restart(screen)?;
            return Ok(serde_json::Value::Null);
        }
        let mut link = connector.connect(screen)?;
        let value = match request.op {
            Op::Identify => serde_json::json!({ "model": link.identity().model.id.0,
                "firmware": link.identity().firmware, "storage": link.storage().is_some() }),
            Op::Brightness { percent } => {
                link.set_brightness(Brightness::new(percent).ok_or_else(invalid)?)?;
                serde_json::Value::Null
            }
            Op::Orientation { index } => {
                link.set_orientation(
                    *Orientation::ALL
                        .get(usize::from(index))
                        .ok_or_else(invalid)?,
                )?;
                serde_json::Value::Null
            }
            Op::Present { width, height } => {
                let panel = link.identity().model.panel;
                if Size::new(width, height).portrait() != panel.portrait() {
                    return Err(invalid());
                }
                let frame = Frame::from_rgba(Size::new(width, height), payload.to_vec())
                    .ok_or_else(invalid)?;
                link.present(&frame)?;
                match link.last_transfer() {
                    Some(stats) => {
                        serde_json::json!({"bytes":stats.bytes,"conversion_ms":stats.conversion_ms,
                        "diff_ms":stats.diff_ms,"write_ms":stats.write_ms,"reply_ms":stats.reply_ms,"kind":stats.kind})
                    }
                    None => serde_json::Value::Null,
                }
            }
            Op::Off => {
                link.screen_off()?;
                serde_json::Value::Null
            }
            Op::OffNow => {
                link.turn_off_now()?;
                serde_json::Value::Null
            }
            Op::Release => {
                link.release()?;
                serde_json::Value::Null
            }
            op => {
                let profile =
                    bezel_core::domain::media::UploadProfile::for_model(link.identity().model);
                let storage = link
                    .storage()
                    .ok_or_else(|| BezelError::Unsupported("screen storage".into()))?;
                match op {
                    Op::Info => {
                        let info = storage.info()?;
                        let cap = |v: Capacity| [v.total, v.used, v.free];
                        serde_json::json!({ "internal": cap(info.internal), "card": info.card.map(cap) })
                    }
                    Op::List { folder } => {
                        let location = StorageLocation::ALL
                            .into_iter()
                            .find(|s| s.to_string() == folder)
                            .ok_or_else(invalid)?;
                        serde_json::json!(
                            storage
                                .list(location)?
                                .iter()
                                .map(FileName::as_str)
                                .collect::<Vec<_>>()
                        )
                    }
                    Op::Size { path } => {
                        serde_json::json!(storage.size(&RemotePath::parse(&path)?)?)
                    }
                    Op::Upload { path } => {
                        let path = RemotePath::parse(&path)?;
                        if payload.len() as u64 > profile.ok_or_else(invalid)?.max_upload_bytes {
                            return Err(invalid());
                        }
                        let token = CancelToken::new();
                        let mut report = |p| {
                            if !progress(p) {
                                token.cancel();
                            }
                        };
                        storage.upload(&path, payload, &mut Job::new(&token, &mut report))?;
                        serde_json::Value::Null
                    }
                    Op::Delete { path, confirmed } => {
                        let path = RemotePath::parse(&path)?;
                        let proof = proof(confirmed, Operation::Delete(path.clone()))?;
                        storage.delete(&path, proof)?;
                        serde_json::Value::Null
                    }
                    Op::Video {
                        path,
                        looping,
                        resume,
                    } => {
                        let path = RemotePath::parse(&path)?;
                        let repeat = if looping { Repeat::Loop } else { Repeat::Once };
                        if resume {
                            storage.resume_video(&path, repeat)?;
                        } else {
                            storage.play_video(&path, repeat)?;
                        }
                        serde_json::Value::Null
                    }
                    Op::Image { path } => {
                        storage.play_image(&RemotePath::parse(&path)?)?;
                        serde_json::Value::Null
                    }
                    Op::Stop => {
                        storage.stop()?;
                        serde_json::Value::Null
                    }
                    Op::Options {
                        mode,
                        minutes,
                        confirmed,
                    } => {
                        let start = match mode {
                            0 => StartMode::Default,
                            1 => StartMode::Image,
                            2 => StartMode::Video,
                            _ => return Err(invalid()),
                        };
                        let proof = proof(confirmed, Operation::Standby(Standby::Keep))?;
                        storage.set_options(PlanB::new(start, minutes), proof)?;
                        serde_json::Value::Null
                    }
                    Op::RestartSystem { confirmed } => {
                        storage.restart(proof(confirmed, Operation::Standby(Standby::Album))?)?;
                        serde_json::Value::Null
                    }
                    _ => return Err(invalid()),
                }
            }
        };
        Ok(value)
    })();
    encode(&match answer {
        Ok(value) => Reply::Value { value },
        Err(error) => error_reply(error),
    })
}
fn proof(confirmed: bool, operation: Operation) -> Result<Confirmed> {
    Confirmed::require(
        if confirmed { Confirm::Yes } else { Confirm::No },
        &operation,
    )
}

/// ScreenConnector client over an injected local channel (real pipe or fake).
#[derive(Clone)]
pub struct RemoteConnector {
    channel: Arc<Mutex<Box<dyn ScreenChannel>>>,
}
impl RemoteConnector {
    /// Holds one editor session until all proxies and this connector drop.
    pub fn new(channel: Box<dyn ScreenChannel>) -> Self {
        Self {
            channel: Arc::new(Mutex::new(channel)),
        }
    }
    /// Transport health, used to distinguish an owner crash from a device error.
    pub fn connected(&self) -> bool {
        self.channel.lock().is_ok_and(|channel| channel.connected())
    }
    /// Binary runtime request over the same authenticated editor session.
    pub fn runtime(&self, metadata: &[u8], payload: &[u8]) -> Result<(Vec<u8>, Vec<u8>)> {
        self.channel
            .lock()
            .map_err(|_| transport("client lock poisoned"))?
            .exchange_binary(metadata, payload)
    }
    fn call(
        &self,
        screen: &str,
        op: Op,
        data: &[u8],
        job: Option<&mut Job<'_>>,
    ) -> Result<serde_json::Value> {
        let request = encode(&Request {
            screen: screen.into(),
            op,
        })?;
        let bytes = self
            .channel
            .lock()
            .map_err(|_| transport("client lock poisoned"))?
            .exchange(&request, data, job)?;
        match decode(&bytes)? {
            Reply::Value { value } => Ok(value),
            Reply::Error {
                kind,
                message,
                partial,
            } => Err(match kind.as_str() {
                "unsupported" => BezelError::Unsupported(message),
                "cancelled" => BezelError::Cancelled { partial },
                "hung" => BezelError::Hung(message),
                "timeout" => BezelError::Timeout(message),
                "missing" => BezelError::ScreenNotFound(message),
                "invalid" => BezelError::InvalidInput(message),
                "confirmation" => BezelError::NotConfirmed(message),
                _ => BezelError::Transport(message),
            }),
            Reply::Progress { .. } => Err(transport("unexpected progress")),
        }
    }
}
impl ScreenConnector for RemoteConnector {
    fn manages_shutdown(&self) -> bool {
        true
    }
    fn connect(&self, screen: &Screen) -> Result<Box<dyn ScreenLink>> {
        let address = screen.address().ok_or_else(invalid)?.0.clone();
        let value = self.call(&address, Op::Identify, &[], None)?;
        let id = value["model"].as_str().ok_or_else(invalid)?;
        let identity = ScreenIdentity {
            model: MODELS.iter().find(|m| m.id.0 == id).ok_or_else(invalid)?,
            firmware: value["firmware"].as_str().map(Into::into),
        };
        let storage = value["storage"].as_bool().unwrap_or(false);
        Ok(Box::new(RemoteLink {
            remote: self.clone(),
            address,
            identity,
            storage,
            transfer: None,
        }))
    }
    fn restart(&self, screen: &Screen) -> Result<()> {
        self.call(
            &screen.address().ok_or_else(invalid)?.0,
            Op::Restart,
            &[],
            None,
        )
        .map(|_| ())
    }
}
struct RemoteLink {
    remote: RemoteConnector,
    address: String,
    identity: ScreenIdentity,
    storage: bool,
    transfer: Option<TransferStats>,
}
impl RemoteLink {
    fn call(&self, op: Op) -> Result<serde_json::Value> {
        self.remote.call(&self.address, op, &[], None)
    }
    fn unit(&self, op: Op) -> Result<()> {
        self.call(op).map(|_| ())
    }
}
impl ScreenLink for RemoteLink {
    fn last_transfer(&self) -> Option<TransferStats> {
        self.transfer
    }
    fn manages_shutdown(&self) -> bool {
        true
    }
    fn identity(&self) -> &ScreenIdentity {
        &self.identity
    }
    fn set_brightness(&mut self, b: Brightness) -> Result<()> {
        self.unit(Op::Brightness {
            percent: b.percent(),
        })
    }
    fn set_orientation(&mut self, o: Orientation) -> Result<()> {
        self.unit(Op::Orientation { index: o.index() })
    }
    fn present(&mut self, f: &Frame) -> Result<()> {
        self.transfer = None;
        let value = self.remote.call(
            &self.address,
            Op::Present {
                width: f.size().width,
                height: f.size().height,
            },
            f.as_rgba(),
            None,
        )?;
        if !value.is_null() {
            let kind = match value["kind"].as_str() {
                Some("full") => "full",
                Some("partial") => "partial",
                Some("unchanged") => "unchanged",
                _ => "remote",
            };
            self.transfer = Some(TransferStats {
                bytes: value["bytes"].as_u64().ok_or_else(invalid)?,
                conversion_ms: value["conversion_ms"].as_f64().ok_or_else(invalid)?,
                diff_ms: value["diff_ms"].as_f64().ok_or_else(invalid)?,
                write_ms: value["write_ms"].as_f64().ok_or_else(invalid)?,
                reply_ms: value["reply_ms"].as_f64().ok_or_else(invalid)?,
                kind,
            });
        }
        Ok(())
    }

    fn screen_off(&mut self) -> Result<()> {
        self.unit(Op::Off)
    }
    fn turn_off_now(&mut self) -> Result<()> {
        self.unit(Op::OffNow)
    }
    fn release(&mut self) -> Result<()> {
        self.unit(Op::Release)
    }
    fn storage(&mut self) -> Option<&mut dyn ScreenStorage> {
        self.storage.then_some(self)
    }
}
impl ScreenStorage for RemoteLink {
    fn info(&mut self) -> Result<StorageInfo> {
        let value = self.call(Op::Info)?;
        let cap = |v: &serde_json::Value| -> Result<Capacity> {
            let [total, used, free]: [u64; 3] =
                serde_json::from_value(v.clone()).map_err(transport)?;
            Ok(Capacity { total, used, free })
        };
        Ok(StorageInfo {
            internal: cap(&value["internal"])?,
            card: if value["card"].is_null() {
                None
            } else {
                Some(cap(&value["card"])?)
            },
        })
    }
    fn list(&mut self, location: StorageLocation) -> Result<Vec<FileName>> {
        let names: Vec<String> = serde_json::from_value(self.call(Op::List {
            folder: location.to_string(),
        })?)
        .map_err(transport)?;
        names
            .iter()
            .map(|n| FileName::parse(n).map_err(transport))
            .collect()
    }
    fn size(&mut self, path: &RemotePath) -> Result<Option<u64>> {
        serde_json::from_value(self.call(Op::Size {
            path: path.to_string(),
        })?)
        .map_err(transport)
    }
    fn upload(&mut self, path: &RemotePath, data: &[u8], job: &mut Job<'_>) -> Result<()> {
        job.checkpoint()?;
        self.remote
            .call(
                &self.address,
                Op::Upload {
                    path: path.to_string(),
                },
                data,
                Some(job),
            )
            .map(|_| ())
    }
    fn delete(&mut self, path: &RemotePath, confirmed: Confirmed) -> Result<()> {
        let _ = confirmed;
        self.unit(Op::Delete {
            path: path.to_string(),
            confirmed: true,
        })
    }
    fn play_video(&mut self, path: &RemotePath, repeat: Repeat) -> Result<()> {
        self.unit(Op::Video {
            path: path.to_string(),
            looping: repeat == Repeat::Loop,
            resume: false,
        })
    }
    fn resume_video(&mut self, path: &RemotePath, repeat: Repeat) -> Result<()> {
        self.unit(Op::Video {
            path: path.to_string(),
            looping: repeat == Repeat::Loop,
            resume: true,
        })
    }
    fn play_image(&mut self, path: &RemotePath) -> Result<()> {
        self.unit(Op::Image {
            path: path.to_string(),
        })
    }
    fn stop(&mut self) -> Result<()> {
        self.unit(Op::Stop)
    }
    fn set_options(&mut self, plan: PlanB, confirmed: Confirmed) -> Result<()> {
        let _ = confirmed;
        let mode = match plan.start_mode {
            StartMode::Default => 0,
            StartMode::Image => 1,
            StartMode::Video => 2,
        };
        self.unit(Op::Options {
            mode,
            minutes: plan.sleep_minutes,
            confirmed: true,
        })
    }
    fn restart(&mut self, confirmed: Confirmed) -> Result<()> {
        let _ = confirmed;
        self.unit(Op::RestartSystem { confirmed: true })
    }
}

/// Serve the synchronous progress subprotocol on an already authenticated channel.
pub fn serve_request(
    stream: &mut (impl Read + Write),
    connector: &dyn ScreenConnector,
    screens: &[Screen],
    metadata: &[u8],
    payload: &[u8],
) -> Result<()> {
    let mut progress = |p: Progress| -> bool {
        let Ok(bytes) = encode(&Reply::Progress {
            done: p.done,
            total: p.total,
        }) else {
            return false;
        };
        if write_packet(stream, &bytes, &[]).is_err() {
            return false;
        }
        let Ok((reply, data)) = read_packet(stream) else {
            return false;
        };
        reply == b"continue" && data.is_empty()
    };
    let reply = dispatch(connector, screens, metadata, payload, &mut progress)?;
    write_packet(stream, &reply, &[]).map_err(transport)
}

/// Complete a request/reply exchange, forwarding streamed progress to Job.
pub fn exchange(
    stream: &mut (impl Read + Write),
    metadata: &[u8],
    payload: &[u8],
    mut job: Option<&mut Job<'_>>,
) -> Result<Vec<u8>> {
    write_packet(stream, metadata, payload).map_err(transport)?;
    loop {
        let (reply, data) = read_packet(stream).map_err(transport)?;
        if !data.is_empty() {
            return Err(transport("unexpected reply payload"));
        }
        match decode::<Reply>(&reply)? {
            Reply::Progress { done, total } => {
                if let Some(job) = job.as_mut() {
                    job.report(Progress::new(JobPhase::Upload, done, total));
                }
                let cancel = job.as_ref().is_some_and(|j| j.is_cancelled());
                write_packet(stream, if cancel { b"cancel" } else { b"continue" }, &[])
                    .map_err(transport)?;
            }
            _ => return Ok(reply),
        }
    }
}
