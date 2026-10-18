//! Persistent, bounded, low-latency scene encoding for experimental USB video.
//! Each call returns one complete Annex-B picture. FFmpeg's framecrc tee slave
//! supplies the encoded packet length before the H.264 slave writes its bytes;
//! this avoids guessing packet boundaries from pipe read sizes or idle time.

use bezel_core::{
    BezelError, Result,
    domain::{frame::Frame, geometry::Size},
};
use std::{
    io::{BufRead, BufReader, Read, Write},
    path::Path,
    process::{Child, Command, Stdio},
    sync::mpsc::{self, Receiver, SyncSender},
    thread::{self, JoinHandle},
    time::Duration,
};

/// Maximum picture accepted by the initially supported TURZX decoder.
pub const MAX_PICTURE: usize = 202_752;
const TIMEOUT: Duration = Duration::from_secs(5);

fn failure(what: impl std::fmt::Display) -> BezelError {
    BezelError::Transport(format!("H.264 encoder: {what}"))
}

/// One encoder per display. Only one frame may be outstanding. Processes and
/// helper threads are terminated on drop, including after a broken pipe/timeout.
pub struct H264Encoder {
    size: Size,
    child: Child,
    input: Option<SyncSender<Frame>>,
    output: Option<Receiver<Result<Vec<u8>>>>,
    worker: Option<JoinHandle<()>>,
    metadata: Option<JoinHandle<()>>,
}

impl H264Encoder {
    /// Starts the explicitly selected local FFmpeg. No shell, files or network
    /// inputs are used. Dimensions must be even and fps must be 1..=50.
    pub fn start(ffmpeg: &Path, size: Size, fps: u8) -> Result<Self> {
        if !(1..=50).contains(&fps)
            || size.width == 0
            || size.height == 0
            || size.width > 2320
            || size.height > 2320
            || !size.width.is_multiple_of(2)
            || !size.height.is_multiple_of(2)
            || size.area() > 1080 * 2320
        {
            return Err(BezelError::InvalidInput(
                "invalid scene encoder size or frame rate".into(),
            ));
        }
        let mut command = Command::new(ffmpeg);
        command.args([
            "-hide_banner", "-loglevel", "error", "-nostats",
            "-probesize", "32", "-analyzeduration", "0", "-fpsprobesize", "0",
            "-f", "rawvideo", "-pix_fmt", "rgba", "-video_size", &format!("{}x{}", size.width, size.height),
            "-framerate", &fps.to_string(), "-i", "pipe:0", "-map", "0:v:0", "-an",
            "-c:v", "libx264", "-profile:v", "baseline", "-preset", "superfast",
            "-tune", "zerolatency", "-threads", "1", "-pix_fmt", "yuv420p",
            "-crf", "25", "-maxrate", "2M", "-bufsize", "2M",
            "-x264-params", &format!("aud=1:sliced-threads=0:bframes=0:scenecut=0:keyint={}:min-keyint={}:repeat-headers=1", u32::from(fps) * 5, u32::from(fps) * 5),
            "-f", "tee", "[f=framecrc:flush_packets=1]pipe:2|[f=h264:flush_packets=1]pipe:1",
        ]).stdin(Stdio::piped()).stdout(Stdio::piped()).stderr(Stdio::piped());
        crate::process::hide_console(&mut command);
        let mut child = command.spawn().map_err(failure)?;
        let setup = (|| {
            let mut stdin = child.stdin.take().ok_or_else(|| failure("no input pipe"))?;
            let mut stdout = child
                .stdout
                .take()
                .ok_or_else(|| failure("no output pipe"))?;
            let stderr = child
                .stderr
                .take()
                .ok_or_else(|| failure("no metadata pipe"))?;
            let (sizes_tx, sizes_rx) = mpsc::sync_channel(2);
            let metadata = thread::Builder::new()
                .name("bezel-h264-metadata".into())
                .spawn(move || {
                    for line in BufReader::new(stderr).lines() {
                        let Ok(line) = line else { break };
                        if let Some(size) = packet_size(&line)
                            && sizes_tx.send(size).is_err()
                        {
                            break;
                        }
                    }
                })
                .map_err(failure)?;
            let (input, frames) = mpsc::sync_channel::<Frame>(1);
            let (pictures, output) = mpsc::sync_channel(1);
            let worker = thread::Builder::new()
                .name("bezel-h264-encode".into())
                .spawn(move || {
                    while let Ok(frame) = frames.recv() {
                        let encoded = (|| {
                            stdin.write_all(frame.as_rgba()).map_err(failure)?;
                            let size = sizes_rx.recv_timeout(TIMEOUT).map_err(failure)?;
                            if size == 0 || size > MAX_PICTURE {
                                return Err(failure("picture exceeds decoder limit"));
                            }
                            let mut data = vec![0; size];
                            stdout.read_exact(&mut data).map_err(failure)?;
                            validate_picture(&data)?;
                            Ok(data)
                        })();
                        let failed = encoded.is_err();
                        if pictures.send(encoded).is_err() || failed {
                            break;
                        }
                    }
                })
                .map_err(failure)?;
            Ok((input, output, worker, metadata))
        })();
        match setup {
            Ok((input, output, worker, metadata)) => Ok(Self {
                size,
                child,
                input: Some(input),
                output: Some(output),
                worker: Some(worker),
                metadata: Some(metadata),
            }),
            Err(error) => {
                let _ = child.kill();
                let _ = child.wait();
                Err(error)
            }
        }
    }

    /// Encodes one opaque composed scene in its panel-native orientation.
    /// A timeout makes this session unusable; create a fresh encoder to recover.
    pub fn encode(&mut self, frame: &Frame) -> Result<Vec<u8>> {
        if frame.size() != self.size {
            return Err(BezelError::InvalidInput(
                "scene encoder frame size mismatch".into(),
            ));
        }
        if frame
            .as_rgba()
            .as_chunks::<4>()
            .0
            .iter()
            .any(|pixel| pixel[3] != 255)
        {
            return Err(BezelError::InvalidInput(
                "whole-scene H.264 requires an opaque composed background".into(),
            ));
        }
        let result = (|| {
            self.input
                .as_ref()
                .ok_or_else(|| failure("session closed"))?
                .try_send(frame.clone())
                .map_err(failure)?;
            self.output
                .as_ref()
                .ok_or_else(|| failure("session closed"))?
                .recv_timeout(TIMEOUT)
                .map_err(failure)?
        })();
        if result.is_err() {
            self.close();
        }
        result
    }

    fn close(&mut self) {
        self.input.take();
        self.output.take();
        let _ = self.child.kill();
        let _ = self.child.wait();
        if let Some(worker) = self.worker.take() {
            let _ = worker.join();
        }
        if let Some(metadata) = self.metadata.take() {
            let _ = metadata.join();
        }
    }
}
impl Drop for H264Encoder {
    fn drop(&mut self) {
        self.close();
    }
}

fn packet_size(line: &str) -> Option<usize> {
    let fields: Vec<_> = line.split(',').map(str::trim).collect();
    // Recent FFmpeg versions append flags and quality side-data columns.
    (fields.len() >= 6 && fields[0] == "0" && fields[5].starts_with("0x"))
        .then(|| fields[4].parse().ok())
        .flatten()
}

/// Rejects multi-slice or missing-picture output; packet boundaries come from
/// the muxer, so a NAL start code inside two consecutive pipe reads is harmless.
pub fn validate_picture(data: &[u8]) -> Result<()> {
    let mut slices = 0;
    let mut at = 0;
    while at + 3 < data.len() {
        let prefix = if data[at..].starts_with(&[0, 0, 0, 1]) {
            4
        } else if data[at..].starts_with(&[0, 0, 1]) {
            3
        } else {
            at += 1;
            continue;
        };
        let Some(header) = data.get(at + prefix) else {
            break;
        };
        if matches!(header & 31, 1 | 5) {
            slices += 1;
        }
        at += prefix + 1;
    }
    if data.len() > MAX_PICTURE || slices != 1 {
        return Err(failure("expected exactly one bounded slice per picture"));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn parses_only_framecrc_video_packets() {
        assert_eq!(packet_size("0, 0, 0, 1, 123, 0x1234"), Some(123));
        assert_eq!(
            packet_size("0, 0, 0, 1, 123, 0x1234, S=1, Quality stats, 8, 0x0"),
            Some(123)
        );
        assert_eq!(packet_size("#extradata 0: 123"), None);
        assert_eq!(packet_size("[error] failed, nope"), None);
        assert_eq!(packet_size("0, 0, 0, 1, invalid, 0x1234"), None);
    }
    #[test]
    fn rejects_multiple_pictures_and_slices() {
        assert!(validate_picture(&[0, 0, 0, 1, 9, 0xf0, 0, 0, 1, 0x65, 0x80]).is_ok());
        assert!(validate_picture(&[0, 0, 1, 0x41, 0x80]).is_ok());
        assert!(validate_picture(&[0, 0, 1, 0x65, 0x80, 0, 0, 1, 0x41, 0x80]).is_err());
        assert!(validate_picture(&[0, 0, 0, 1, 9, 0xf0]).is_err());
    }

    #[test]
    #[ignore = "requires BEZEL_TEST_FFMPEG with libx264; no hardware"]
    fn real_encoder_returns_decodable_individual_pictures() {
        let ffmpeg = std::path::PathBuf::from(
            std::env::var_os("BEZEL_TEST_FFMPEG").expect("explicit FFmpeg path"),
        );
        let size = Size::new(32, 32);
        let mut encoder = H264Encoder::start(&ffmpeg, size, 50).unwrap();
        assert!(
            encoder
                .encode(&Frame::filled(
                    size,
                    bezel_core::domain::frame::Rgba::default()
                ))
                .is_err()
        );
        let mut stream = Vec::new();
        for i in 0..16 {
            let frame = Frame::filled(
                size,
                bezel_core::domain::frame::Rgba::opaque(240 - i * 8, 32, i * 8),
            );
            let picture = encoder.encode(&frame).unwrap();
            validate_picture(&picture).unwrap();
            stream.extend_from_slice(&picture);
        }
        drop(encoder);
        let temp = tempfile::tempdir().unwrap();
        let input = temp.path().join("scene.h264");
        let output = temp.path().join("decoded.rgba");
        std::fs::write(&input, stream).unwrap();
        let args = [
            std::ffi::OsString::from("-v"),
            "error".into(),
            "-i".into(),
            crate::process::file_url(&input),
            "-fps_mode".into(),
            "passthrough".into(),
            "-pix_fmt".into(),
            "rgba".into(),
            "-f".into(),
            "rawvideo".into(),
            crate::process::file_url(&output),
        ];
        let decoded = crate::process::capture(&ffmpeg, &args, TIMEOUT).unwrap();
        assert!(decoded.success, "{}", decoded.stderr);
        let bytes = std::fs::read(output).unwrap();
        assert_eq!(
            bytes.len(),
            16 * 32 * 32 * 4,
            "no missing or duplicate dependent pictures"
        );
        assert!(bytes[0] > 200 && bytes[2] < 30, "first frame remains red");
        let last = bytes.len() - 32 * 32 * 4;
        assert!(
            bytes[last + 2] > 90,
            "last frame's blue channel survives the stream"
        );
    }
}
