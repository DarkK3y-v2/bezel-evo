//! Experimental per-display output selection. Call from that display's own I/O
//! worker: neither its encoder nor USB backpressure belongs on the render loop.
use crate::h264::H264Encoder;
use bezel_core::{
    Result,
    domain::{frame::Frame, geometry::Orientation, storage::FileName},
    ports::ScreenLink,
};
use std::path::Path;

/// What this particular display actually uses, independent of other outputs.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum OutputMode {
    /// Existing driver frames (including its partial-update implementation).
    Native,
    /// Whole-scene H.264 pictures through the screen's decoder.
    H264,
    /// The screen has no encoded-scene input; native frames remain available.
    UnsupportedFallback,
    /// Encoding or streaming failed; native delivery was attempted afterwards.
    ErrorFallback,
}

/// A link and, only when explicitly requested and supported, its own encoder.
pub struct SceneOutput {
    link: Box<dyn ScreenLink>,
    encoder: Option<H264Encoder>,
    orientation: Orientation,
    mode: OutputMode,
    last_error: Option<String>,
}

impl SceneOutput {
    /// Retains the existing transport. No encoder or video command is started.
    pub fn native(mut link: Box<dyn ScreenLink>, orientation: Orientation) -> Result<Self> {
        link.set_orientation(orientation)?;
        Ok(Self {
            link,
            encoder: None,
            orientation,
            mode: OutputMode::Native,
            last_error: None,
        })
    }

    /// Explicit opt-in. Unsupported models stay native. A failed startup is
    /// reported; it never silently advertises H.264 or writes device settings.
    pub fn h264(
        link: Box<dyn ScreenLink>,
        orientation: Orientation,
        ffmpeg: &Path,
        fps: u8,
        standby_clip: &FileName,
    ) -> Result<Self> {
        let mut output = Self::native(link, orientation)?;
        if output.link.encoded_scene().is_none() {
            output.mode = OutputMode::UnsupportedFallback;
            return Ok(output);
        }
        let model = output.link.identity().model;
        let size = model.panel.in_orientation(model.native_orientation);
        let encoder = H264Encoder::start(ffmpeg, size, fps)?;
        if let Some(stream) = output.link.encoded_scene() {
            stream.begin(fps, standby_clip)?;
        }
        output.encoder = Some(encoder);
        output.mode = OutputMode::H264;
        Ok(output)
    }

    /// Actual mode, suitable for a diagnostic report instead of a requested fps.
    pub fn mode(&self) -> OutputMode {
        self.mode
    }

    /// Why an active stream fell back, when it did.
    pub fn last_error(&self) -> Option<&str> {
        self.last_error.as_deref()
    }

    /// Submits one composed frame. Encoded pictures stay ordered; it is safe to
    /// skip obsolete RGBA frames before calling this, never encoded P pictures.
    pub fn present(&mut self, frame: &Frame) -> Result<()> {
        if let Some(encoder) = self.encoder.as_mut() {
            let model = self.link.identity().model;
            let expected = model.panel.in_orientation(self.orientation);
            if frame.size() != expected {
                return Err(bezel_core::BezelError::InvalidInput(
                    "output frame size mismatch".into(),
                ));
            }
            let native = frame.rotated(self.orientation.quarter_turns_to(model.native_orientation));
            let sent = encoder.encode(&native).and_then(|picture| {
                self.link
                    .encoded_scene()
                    .ok_or_else(|| {
                        bezel_core::BezelError::Unsupported(
                            "encoded scene input disappeared".into(),
                        )
                    })?
                    .send_picture(&picture)
            });
            if let Err(error) = sent {
                self.last_error = Some(error.to_string());
                if let Some(stream) = self.link.encoded_scene() {
                    let _ = stream.end();
                }
                self.encoder = None;
                self.mode = OutputMode::ErrorFallback;
            } else {
                return Ok(());
            }
        }
        self.link.present(frame)
    }

    /// Stops this output only and returns its screen to standalone operation.
    pub fn release(&mut self) -> Result<()> {
        let stopped = if self.encoder.take().is_some() {
            self.link
                .encoded_scene()
                .map_or(Ok(()), |stream| stream.end())
        } else {
            Ok(())
        };
        let released = self.link.release();
        stopped.and(released)
    }
}

impl Drop for SceneOutput {
    fn drop(&mut self) {
        if self.encoder.take().is_some()
            && let Some(stream) = self.link.encoded_scene()
        {
            let _ = stream.end();
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use bezel_core::domain::{
        catalog::model_by_id,
        device::ModelId,
        frame::Rgba,
        screen::{Brightness, ScreenIdentity},
    };
    use std::sync::{
        Arc,
        atomic::{AtomicUsize, Ordering},
    };
    struct NativeLink {
        identity: ScreenIdentity,
        sent: Arc<AtomicUsize>,
    }
    impl ScreenLink for NativeLink {
        fn identity(&self) -> &ScreenIdentity {
            &self.identity
        }
        fn set_brightness(&mut self, _: Brightness) -> Result<()> {
            Ok(())
        }
        fn set_orientation(&mut self, _: Orientation) -> Result<()> {
            Ok(())
        }
        fn present(&mut self, _: &Frame) -> Result<()> {
            self.sent.fetch_add(1, Ordering::SeqCst);
            Ok(())
        }
        fn screen_off(&mut self) -> Result<()> {
            Ok(())
        }
        fn release(&mut self) -> Result<()> {
            Ok(())
        }
    }
    #[test]
    fn unsupported_display_remains_native_without_starting_an_encoder() {
        let sent = Arc::new(AtomicUsize::new(0));
        let model = model_by_id(ModelId("turing-2.1")).unwrap();
        let native = NativeLink {
            identity: ScreenIdentity {
                model,
                firmware: None,
            },
            sent: sent.clone(),
        };
        let mut output = SceneOutput::h264(
            Box::new(native),
            Orientation::Portrait,
            Path::new("an-encoder-that-does-not-exist.exe"),
            50,
            &FileName::parse("standby.h264").unwrap(),
        )
        .unwrap();
        assert_eq!(output.mode(), OutputMode::UnsupportedFallback);
        output
            .present(&Frame::filled(model.panel, Rgba::BLACK))
            .unwrap();
        output
            .present(&Frame::filled(model.panel, Rgba::WHITE))
            .unwrap();
        assert_eq!(sent.load(Ordering::SeqCst), 2);
        assert_eq!(output.last_error(), None);
        output.release().unwrap();
    }

    #[test]
    #[ignore = "requires BEZEL_TEST_FFMPEG with libx264; no hardware"]
    fn failed_stream_returns_to_native_for_only_its_own_link() {
        struct FailingStream {
            native: NativeLink,
            ended: Arc<AtomicUsize>,
        }
        impl ScreenLink for FailingStream {
            fn identity(&self) -> &ScreenIdentity {
                self.native.identity()
            }
            fn set_brightness(&mut self, b: Brightness) -> Result<()> {
                self.native.set_brightness(b)
            }
            fn set_orientation(&mut self, o: Orientation) -> Result<()> {
                self.native.set_orientation(o)
            }
            fn present(&mut self, f: &Frame) -> Result<()> {
                self.native.present(f)
            }
            fn screen_off(&mut self) -> Result<()> {
                Ok(())
            }
            fn release(&mut self) -> Result<()> {
                Ok(())
            }
            fn encoded_scene(&mut self) -> Option<&mut dyn bezel_core::ports::EncodedScene> {
                Some(self)
            }
        }
        impl bezel_core::ports::EncodedScene for FailingStream {
            fn begin(&mut self, _: u8, _: &FileName) -> Result<usize> {
                Ok(crate::h264::MAX_PICTURE)
            }
            fn send_picture(&mut self, _: &[u8]) -> Result<()> {
                Err(bezel_core::BezelError::Timeout(
                    "simulated queue failure".into(),
                ))
            }
            fn end(&mut self) -> Result<()> {
                self.ended.fetch_add(1, Ordering::SeqCst);
                Ok(())
            }
        }
        let model = model_by_id(ModelId("turing-usb-8.8")).unwrap();
        let sent = Arc::new(AtomicUsize::new(0));
        let ended = Arc::new(AtomicUsize::new(0));
        let link = FailingStream {
            native: NativeLink {
                identity: ScreenIdentity {
                    model,
                    firmware: None,
                },
                sent: sent.clone(),
            },
            ended: ended.clone(),
        };
        let ffmpeg = std::path::PathBuf::from(
            std::env::var_os("BEZEL_TEST_FFMPEG").expect("explicit FFmpeg path"),
        );
        let mut output = SceneOutput::h264(
            Box::new(link),
            Orientation::Portrait,
            &ffmpeg,
            50,
            &FileName::parse("standby.h264").unwrap(),
        )
        .unwrap();
        let frame = Frame::filled(model.panel, Rgba::BLACK);
        output.present(&frame).unwrap();
        output.present(&frame).unwrap();
        assert_eq!(output.mode(), OutputMode::ErrorFallback);
        assert!(
            output
                .last_error()
                .unwrap()
                .contains("simulated queue failure")
        );
        assert_eq!(sent.load(Ordering::SeqCst), 2);
        assert_eq!(ended.load(Ordering::SeqCst), 1);
    }
}
