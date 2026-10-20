//! Bounded real-device native-output measurement with cooperative Light handoff.
//! No raw device packets, storage operations, restart, or theme edits.
//! Captures and restores the existing scene. Explicit address required.
//! cargo run --release -p bezel-runtime --example device_scene_probe -- <owner-exe> <screen-key> <report.json>
use bezel_core::{
    Result,
    domain::{
        device::Family,
        frame::{Frame, Rect, Rgba},
        geometry::Orientation,
    },
    ports::{ScreenConnector, ScreenLink},
};
use bezel_devices::{SystemBus, SystemConnector};
use bezel_power::{handoff, owner_pipe::PipeChannel, owner_protocol::RemoteConnector};
use bezel_runtime::wire::{self, RuntimeOp};
use std::{
    path::PathBuf,
    sync::{
        Arc,
        atomic::{AtomicBool, Ordering},
    },
    time::{Duration, Instant},
};

type AnyResult<T> = std::result::Result<T, Box<dyn std::error::Error>>;

struct Restore {
    link: Box<dyn ScreenLink>,
    frame: Frame,
    restored: bool,
}
impl Restore {
    fn now(&mut self) -> Result<()> {
        self.link.present(&self.frame)?;
        self.restored = true;
        Ok(())
    }
}
impl Drop for Restore {
    fn drop(&mut self) {
        if !self.restored {
            let _ = self.link.present(&self.frame);
        }
    }
}

fn test_frame(original: &Frame, area: Rect, elapsed: f64) -> Frame {
    let mut frame = original.clone();
    let area = area.clip(frame.size());
    frame.fill_rect(area, Rgba::opaque(14, 22, 29));
    let center = area.y + area.height / 2;
    for x in 0..area.width {
        let phase = f64::from(x) / 50. + elapsed * 2.5;
        let y = (f64::from(center) + phase.sin() * f64::from(area.height.saturating_sub(12)) * 0.35)
            as u32;
        frame.fill_rect(Rect::new(area.x + x, y, 1, 3), Rgba::opaque(32, 225, 190));
    }
    let cursor = area.x + ((elapsed * 150.) as u32 % area.width.max(1));
    frame.fill_rect(
        Rect::new(cursor, area.y, 2, area.height),
        Rgba::opaque(250, 155, 70),
    );
    frame
}

fn measure(
    restore: &mut Restore,
    name: &str,
    area: Rect,
    stop: &AtomicBool,
) -> AnyResult<serde_json::Value> {
    let start = Instant::now();
    let mut times = Vec::new();
    let mut bytes = 0;
    let mut partial = 0;
    let mut full = 0;
    let mut write_ms = 0.;
    let mut reply_ms = 0.;
    let mut next = Instant::now();
    while start.elapsed() < Duration::from_secs(5) && !stop.load(Ordering::SeqCst) {
        let elapsed = start.elapsed().as_secs_f64();
        let mut frame = test_frame(&restore.frame, area, elapsed);
        if name == "full-pixel-motion" {
            // Slow, dark gradient: every row changes, without flashing.
            let shift = (elapsed * 60.) as u32;
            for y in 0..area.height {
                let shade = ((y + shift) % 128) as u8;
                frame.fill_rect(
                    Rect::new(0, y, area.width, 1),
                    Rgba::opaque(12 + shade / 4, 25 + shade, 48 + shade),
                );
            }
        }
        let began = Instant::now();
        restore.link.present(&frame)?;
        times.push(began.elapsed().as_secs_f64() * 1000.);
        if let Some(stats) = restore.link.last_transfer() {
            bytes += stats.bytes;
            partial += u64::from(stats.kind == "partial");
            full += u64::from(stats.kind == "full");
            write_ms += stats.write_ms;
            reply_ms += stats.reply_ms;
        }
        next += Duration::from_millis(20);
        let now = Instant::now();
        if next > now {
            std::thread::sleep(next - now);
        } else {
            next = now;
        }
    }
    let elapsed = start.elapsed().as_secs_f64();
    let count = times.len();
    let mean = times.iter().sum::<f64>() / count.max(1) as f64;
    times.sort_by(f64::total_cmp);
    let median = times.get(count / 2).copied().unwrap_or(0.);
    let p95 = times
        .get((count.saturating_sub(1) * 95) / 100)
        .copied()
        .unwrap_or(0.);
    let report = serde_json::json!({"phase":name,"area":{"width":area.width,"height":area.height},"targetFps":50,"completedTransfers":count,"elapsedSeconds":elapsed,"completedTransfersPerSecond":count as f64/elapsed,"meanPresentMs":mean,"medianPresentMs":median,"p95PresentMs":p95,"wireBytes":bytes,"partialTransfers":partial,"fullTransfers":full,"totalWriteMs":write_ms,"totalReplyMs":reply_ms});
    println!("{}", serde_json::to_string(&report)?);
    Ok(report)
}

fn main() -> AnyResult<()> {
    let mut args = std::env::args_os().skip(1);
    let executable = PathBuf::from(args.next().ok_or("expected owner executable")?);
    let key = args
        .next()
        .ok_or("expected explicit screen key")?
        .to_string_lossy()
        .into_owned();
    let report_file = PathBuf::from(args.next().ok_or("expected report path")?);
    let screens = bezel_core::app::discover_screens(&SystemBus)?;
    let screen = screens
        .iter()
        .find(|s| s.answers_to(&key))
        .ok_or("screen not present")?;
    // This measurement uses the current CT88 serial family's known frame path.
    // It must not send TURZX USB H.264 commands to that serial endpoint.
    if screen.family != Family::TuringRevC {
        return Err("this bounded probe is for the Rev C native frame path".into());
    }
    let directory = handoff::runtime_directory(&executable)?;
    let remote = RemoteConnector::new(Box::new(PipeChannel::connect(
        &directory,
        Duration::from_secs(3),
    )?));
    let request = wire::request(
        &key,
        RuntimeOp::Image {
            after: 0,
            max: 2320,
            cards: true,
        },
    )?;
    let (metadata, pixels) = wire::unpack_reply(remote.runtime(&request, &[])?)?;
    let original = wire::frame(&wire::response(&metadata)?, pixels)?
        .ok_or("no live frame to restore; probe refused")?;
    let size = original.size();
    // The authoritative runtime intentionally refuses external Present calls.
    // Use its existing cooperative screen ownership protocol instead.
    drop(remote);
    let _session = handoff::enter_studio(&directory, Duration::from_secs(15))?;
    println!("Light yielded its links; starting the bounded native probe.");
    let link = SystemConnector.connect(screen)?;
    let model = link.identity().model.id.0;
    let firmware = link.identity().firmware.clone();
    if model != "turing-8.8" {
        return Err("this physical probe requires the confirmed 8.8 model".into());
    }
    let orientation = if size.width > size.height {
        Orientation::Landscape
    } else {
        Orientation::Portrait
    };
    let mut restore = Restore {
        link,
        frame: original,
        restored: false,
    };
    let stopped = Arc::new(AtomicBool::new(false));
    let flag = stopped.clone();
    ctrlc::set_handler(move || flag.store(true, Ordering::SeqCst))?;
    restore.link.set_orientation(orientation)?;
    let phases = (|| {
        let mut results = Vec::new();
        for (name, area) in [
            (
                "small-graph",
                Rect::new(16, 16, 240.min(size.width - 16), 80.min(size.height - 16)),
            ),
            (
                "large-graph",
                Rect::new(16, 16, 800.min(size.width - 16), 240.min(size.height - 16)),
            ),
            ("wide-sparse-graph", Rect::of(size)),
            ("full-pixel-motion", Rect::of(size)),
        ] {
            if stopped.load(Ordering::SeqCst) {
                break;
            }
            results.push(measure(&mut restore, name, area, &stopped)?);
        }
        Ok::<_, Box<dyn std::error::Error>>(results)
    })();
    let restored = restore.now();
    let report = serde_json::json!({"hardware":true,"transport":"native serial with cooperative Light handoff","screen":key,"model":model,"firmware":firmware,"h264Tested":false,"h264Reason":"Connected Rev C serial family does not expose the TURZX USB 1CBE stream input","originalFrameRestored":restored.is_ok(),"cancelled":stopped.load(Ordering::SeqCst),"phases":phases.as_ref().ok(),"error":phases.as_ref().err().map(ToString::to_string)});
    if let Some(parent) = report_file.parent() {
        std::fs::create_dir_all(parent)?;
    }
    std::fs::write(&report_file, serde_json::to_vec_pretty(&report)?)?;
    restored?;
    phases?;
    println!("Original frame restored; releasing cooperative ownership resumes saved themes.");
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use bezel_core::domain::{
        catalog::model_by_id,
        device::ModelId,
        geometry::Size,
        screen::{Brightness, ScreenIdentity},
    };
    use std::sync::Mutex;
    #[test]
    fn calibration_changes_only_its_bounded_area() {
        let frame = Frame::filled(Size::new(480, 320), Rgba::WHITE);
        let next = test_frame(&frame, Rect::new(16, 16, 100, 80), 0.5);
        assert_eq!(next.pixel(0, 0), frame.pixel(0, 0));
        assert_eq!(next.pixel(116, 100), frame.pixel(116, 100));
        assert_ne!(next.pixel(16, 16), frame.pixel(16, 16));
    }
    #[test]
    fn restoration_runs_when_a_probe_scope_fails() {
        struct Link {
            frames: Arc<Mutex<Vec<Frame>>>,
            identity: ScreenIdentity,
        }
        impl ScreenLink for Link {
            fn identity(&self) -> &ScreenIdentity {
                &self.identity
            }
            fn set_brightness(&mut self, _: Brightness) -> Result<()> {
                Ok(())
            }
            fn set_orientation(&mut self, _: Orientation) -> Result<()> {
                Ok(())
            }
            fn present(&mut self, f: &Frame) -> Result<()> {
                self.frames.lock().unwrap().push(f.clone());
                Ok(())
            }
            fn screen_off(&mut self) -> Result<()> {
                Ok(())
            }
            fn release(&mut self) -> Result<()> {
                Ok(())
            }
        }
        let frames = Arc::new(Mutex::new(Vec::new()));
        let original = Frame::filled(Size::new(2, 2), Rgba::WHITE);
        {
            let _guard = Restore {
                link: Box::new(Link {
                    frames: frames.clone(),
                    identity: ScreenIdentity {
                        model: model_by_id(ModelId("turing-8.8")).unwrap(),
                        firmware: None,
                    },
                }),
                frame: original.clone(),
                restored: false,
            };
        }
        assert_eq!(*frames.lock().unwrap(), vec![original]);
    }
}
