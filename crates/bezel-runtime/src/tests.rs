#![allow(clippy::unwrap_used)]
use super::*;
use bezel_core::{
    domain::{
        frame::Rgba,
        geometry::{Orientation, Size},
        sensor::{Reading, SensorKey, Snapshot},
        storage::{RemotePath, Repeat},
        theme::{Binding, Element, ElementKind, GraphStyle},
    },
    ports::RenderContext,
};
use bezel_devices::{
    FakeBus, FakeConnector,
    fake::{FakeStorage, StorageCall},
};
use bezel_power::owner::Owner;
use bezel_sensors::FakeSensors;
use std::sync::{
    Mutex,
    atomic::{AtomicU64, Ordering},
};
use wire::{RuntimeOp, document, request, response};
fn time() -> LocalTime {
    LocalTime {
        year: 2026,
        month: 10,
        day: 16,
        hour: 12,
        minute: 0,
        second: 0,
        weekday: 4,
    }
}
#[derive(Clone, Debug)]
struct Seen {
    history: Vec<Option<f64>>,
    clock: Duration,
    theme: String,
}
struct Renderer(Arc<Mutex<Vec<Seen>>>);
impl FrameRenderer for Renderer {
    fn render(
        &mut self,
        theme: &Theme,
        _: &BTreeMap<AssetRef, Vec<u8>>,
        context: RenderContext<'_>,
    ) -> Result<Frame> {
        let history = theme
            .graph_series()
            .first()
            .map_or(Vec::new(), |id| context.histories.points(id, 100));
        self.0.lock().unwrap().push(Seen {
            history,
            clock: context.animation,
            theme: theme.name.clone(),
        });
        Ok(Frame::filled(theme.canvas, Rgba::BLACK))
    }
    fn measure_element(
        &mut self,
        _: &Theme,
        _: ElementId,
        _: &BTreeMap<AssetRef, Vec<u8>>,
        _: RenderContext<'_>,
    ) -> Result<Option<BoxF>> {
        Ok(Some(BoxF::new(1.0, 2.0, 3.0, 4.0)))
    }
}
fn doc() -> Document {
    let mut theme = Theme::blank("saved", Size::new(1920, 480), Orientation::Landscape);
    theme.refresh_seconds = 1.0;
    theme.background = Background::DeviceVideo {
        path: RemotePath::parse("internal/video/earth.mp4").unwrap(),
        repeat: Repeat::Loop,
        color: Rgba::BLACK,
    };
    theme.elements.push(Element {
        id: ElementId(1),
        name: "CPU".into(),
        frame: BoxF::new(0.0, 0.0, 120.0, 60.0),
        visible: true,
        locked: false,
        opacity: 1.0,
        is_group: false,
        group_parent: None,
        card_member: None,
        card: None,
        color_by_value: None,
        value_transition: None,
        kind: ElementKind::Graph {
            binding: Binding {
                key: SensorKey::new("cpu.usage").unwrap(),
                min: 0.0,
                max: 100.0,
            },
            history: 100,
            interval_seconds: None,
            style: GraphStyle::Line,
            color: Rgba::WHITE,
            fill: None,
            line_width: 1.0,
            autoscale: false,
        },
    });
    Document {
        theme,
        assets: BTreeMap::new(),
    }
}
struct Fixture {
    engine: Engine,
    physical: FakeConnector,
    owner: Owner,
    seen: Arc<Mutex<Vec<Seen>>>,
    key: String,
}
fn fixture() -> Fixture {
    static NEXT: AtomicU64 = AtomicU64::new(0);
    let bus = Arc::new(FakeBus::turing_88());
    let key = bezel_core::app::discover_screens(bus.as_ref()).unwrap()[0]
        .address()
        .unwrap()
        .0
        .clone();
    let physical = FakeConnector::with_storage(FakeStorage::default().with_file(
        RemotePath::parse("internal/video/earth.mp4").unwrap(),
        vec![1],
    ));
    let owner = Owner::new(Arc::new(physical.clone()));
    let seen = Arc::new(Mutex::new(Vec::new()));
    let sensors = FakeSensors::new(
        Vec::new(),
        (1..=20)
            .map(|n| {
                let mut s = Snapshot::default();
                s.insert(
                    SensorKey::new("cpu.usage").unwrap(),
                    Reading::Value(f64::from(n)),
                );
                s
            })
            .collect(),
    );
    let engine = Engine::new(
        Box::new(Renderer(seen.clone())),
        Box::new(sensors),
        Box::new(bezel_media::FfmpegTranscoder::new(None)),
        bus,
        Arc::new(owner.client(true)),
        Language::English,
        std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join(format!(
            "../../target/engine-{}-{}",
            std::process::id(),
            NEXT.fetch_add(1, Ordering::Relaxed)
        )),
        time,
    )
    .unwrap();
    Fixture {
        engine,
        physical,
        owner,
        seen,
        key,
    }
}
fn send(
    engine: &mut Engine,
    key: &str,
    op: RuntimeOp,
    payload: &[u8],
) -> Result<(serde_json::Value, Vec<u8>)> {
    let (meta, pixels) = engine.request(&request(key, op)?, payload)?;
    Ok((response(&meta)?, pixels))
}
#[test]
fn editor_attach_detach_keeps_graph_clock_link_and_earth_playing() {
    let mut f = fixture();
    let saved = doc();
    f.engine.document(&f.key, 0, saved.clone(), true).unwrap();
    f.engine.live(&f.key, true).unwrap();
    for n in 0..4 {
        f.engine.tick_at(Duration::from_secs(n), time()).unwrap();
    }
    let before = f.seen.lock().unwrap().last().unwrap().clone();
    let frames = f.physical.log().frames.len();
    for _ in 0..3 {
        f.owner.set_editing(true);
        send(
            &mut f.engine,
            &f.key,
            RuntimeOp::Draft {
                revision: 1,
                saved: false,
            },
            &document(&saved.theme, Some(&saved.assets)).unwrap(),
        )
        .unwrap();
        send(&mut f.engine, &f.key, RuntimeOp::Live { on: true }, &[]).unwrap();
        f.engine
            .tick_at(Duration::from_millis(3100), time())
            .unwrap();
        f.engine.disconnected().unwrap();
        f.owner.set_editing(false);
        f.owner.saved_ready();
        f.engine
            .tick_at(Duration::from_millis(3200), time())
            .unwrap();
    }
    assert_eq!(
        f.physical.log().frames.len(),
        frames,
        "handover must not schedule a redraw"
    );
    f.engine.tick_at(Duration::from_secs(4), time()).unwrap();
    let after = f.seen.lock().unwrap().last().unwrap().clone();
    assert_eq!(&after.history[..before.history.len()], before.history);
    assert_eq!(after.history.len(), 5);
    assert!(after.clock > before.clock);
    assert_eq!(f.physical.log().connects, 1);
    assert_eq!(
        f.physical
            .log()
            .storage
            .calls
            .iter()
            .filter(|c| matches!(c, StorageCall::PlayVideo(..)))
            .count(),
        1
    );
    assert!(!f.physical.log().storage.calls.contains(&StorageCall::Stop));
}
#[test]
fn unsaved_draft_crash_restores_saved_in_same_scene_and_keeps_history() {
    let mut f = fixture();
    let saved = doc();
    f.engine.document(&f.key, 0, saved.clone(), true).unwrap();
    f.engine.live(&f.key, true).unwrap();
    f.engine.tick_at(Duration::ZERO, time()).unwrap();
    let mut draft = saved.clone();
    draft.theme.name = "draft".into();
    draft.theme.elements[0].frame.x = 50.0;
    send(
        &mut f.engine,
        &f.key,
        RuntimeOp::Draft {
            revision: 1,
            saved: false,
        },
        &document(&draft.theme, None).unwrap(),
    )
    .unwrap();
    f.engine.tick_at(Duration::from_secs(1), time()).unwrap();
    f.engine.disconnected().unwrap();
    f.engine.tick_at(Duration::from_secs(2), time()).unwrap();
    let seen = f.seen.lock().unwrap();
    assert_eq!(seen.last().unwrap().theme, "saved");
    assert_eq!(
        seen.last().unwrap().history,
        [Some(1.0), Some(2.0), Some(3.0)]
    );
    assert_eq!(seen.last().unwrap().clock, Duration::from_secs(2));
    assert_eq!(f.physical.log().connects, 1);
}
#[test]
fn saved_commit_survives_client_crash_and_revisions_are_checked() {
    let mut f = fixture();
    let mut d = doc();
    f.engine.document(&f.key, 1, d.clone(), true).unwrap();
    d.theme.name = "committed".into();
    let bytes = document(&d.theme, None).unwrap();
    send(
        &mut f.engine,
        &f.key,
        RuntimeOp::Draft {
            revision: 2,
            saved: true,
        },
        &bytes,
    )
    .unwrap();
    assert!(
        send(
            &mut f.engine,
            &f.key,
            RuntimeOp::Draft {
                revision: 2,
                saved: false
            },
            &bytes
        )
        .is_err()
    );
    f.engine.detach().unwrap();
    assert_eq!(f.engine.scenes[&f.key].runtime.theme().name, "committed");
    send(
        &mut f.engine,
        &f.key,
        RuntimeOp::Draft {
            revision: 1,
            saved: false,
        },
        &bytes,
    )
    .unwrap();
}
#[test]
fn canvas_backpressure_scaling_inspector_and_measure_are_bounded() {
    let mut f = fixture();
    f.engine.document(&f.key, 0, doc(), true).unwrap();
    let (value, pixels) = send(
        &mut f.engine,
        &f.key,
        RuntimeOp::Image {
            after: 0,
            max: 320,
            cards: true,
        },
        &[],
    )
    .unwrap();
    assert_eq!(value["width"], 320);
    assert_eq!(pixels.len(), 320 * 80 * 4);
    let seq = value["sequence"].as_u64().unwrap();
    let (_, pixels) = send(
        &mut f.engine,
        &f.key,
        RuntimeOp::Image {
            after: seq,
            max: 320,
            cards: true,
        },
        &[],
    )
    .unwrap();
    assert!(pixels.is_empty());
    let (value, pixels) = send(
        &mut f.engine,
        &f.key,
        RuntimeOp::Inspect {
            element: 1,
            max: 64,
            motion: false,
        },
        &[],
    )
    .unwrap();
    assert!(value["width"].as_u64().unwrap() <= 64);
    assert!(!pixels.is_empty());
    let (value, _) = send(
        &mut f.engine,
        &f.key,
        RuntimeOp::Measure { element: 1 },
        &[],
    )
    .unwrap();
    assert_eq!(value["width"], 3.0);
    assert!(
        send(
            &mut f.engine,
            &f.key,
            RuntimeOp::Image {
                after: 0,
                max: 2321,
                cards: true
            },
            &[]
        )
        .is_err()
    );
    assert!(
        send(
            &mut f.engine,
            &f.key,
            RuntimeOp::Inspect {
                element: 999,
                max: 64,
                motion: true
            },
            &[]
        )
        .is_err()
    );
    assert!(send(&mut f.engine, &f.key, RuntimeOp::Live { on: false }, &[1]).is_err());
}
#[test]
fn untrusted_document_lengths_paths_dimensions_and_versions_are_rejected() {
    let mut f = fixture();
    let key = f.key.clone();
    for bytes in [vec![], vec![255; 4], vec![0; 4]] {
        assert!(
            send(
                &mut f.engine,
                &key,
                RuntimeOp::Draft {
                    revision: 1,
                    saved: false
                },
                &bytes
            )
            .is_err()
        );
    }
    let mut d = doc();
    d.theme.canvas = bezel_core::domain::geometry::Size::new(u32::MAX, u32::MAX);
    assert!(f.engine.document(&key, 0, d, false).is_err());
    let mut d = doc();
    d.assets.insert(AssetRef("../secret".into()), vec![1]);
    let bytes = document(&d.theme, Some(&d.assets)).unwrap();
    assert!(
        send(
            &mut f.engine,
            &key,
            RuntimeOp::Draft {
                revision: 1,
                saved: false
            },
            &bytes
        )
        .is_err()
    );
    let (meta, _) = f
        .engine
        .request(
            br#"{"runtime":99,"scene":"x","op":{"command":"Live","on":false}}"#,
            &[],
        )
        .unwrap();
    assert!(response(&meta).is_err());
    assert!(wire::frame(&serde_json::json!({"width":u32::MAX,"height":2}), vec![]).is_err());
}

#[test]
fn changing_background_stops_video_but_closing_same_document_does_not() {
    let mut f = fixture();
    let saved = doc();
    f.engine.document(&f.key, 0, saved.clone(), true).unwrap();
    f.engine.live(&f.key, true).unwrap();
    f.engine.tick_at(Duration::ZERO, time()).unwrap();
    let mut draft = saved;
    draft.theme.background = Background::Color(Rgba::BLACK);
    f.engine.document(&f.key, 1, draft, false).unwrap();
    f.engine.tick_at(Duration::from_secs(1), time()).unwrap();
    assert_eq!(
        f.physical
            .log()
            .storage
            .calls
            .iter()
            .filter(|c| matches!(c, StorageCall::Stop))
            .count(),
        1
    );
    f.engine.detach().unwrap();
    f.engine.tick_at(Duration::from_secs(2), time()).unwrap();
    assert_eq!(
        f.physical
            .log()
            .storage
            .calls
            .iter()
            .filter(|c| matches!(c, StorageCall::PlayVideo(..)))
            .count(),
        2
    );
}
#[test]
fn host_decoder_clock_and_instance_survive_drafts_and_client_crash() {
    use bezel_core::{
        domain::{
            job::Job,
            media::{MediaInfo, MediaTools, StreamSpec, TranscodeTarget},
        },
        ports::VideoFrames,
    };
    struct Media {
        opened: Arc<AtomicU64>,
        times: Arc<Mutex<Vec<Duration>>>,
    }
    struct Clip {
        frame: Frame,
        times: Arc<Mutex<Vec<Duration>>>,
    }
    impl VideoFrames for Clip {
        fn frame_at(&mut self, at: Duration) -> Result<&Frame> {
            self.times.lock().unwrap().push(at);
            Ok(&self.frame)
        }
    }
    impl MediaTranscoder for Media {
        fn tools(&mut self) -> MediaTools {
            MediaTools::Ready {
                version: "fake".into(),
            }
        }
        fn probe(&mut self, _: &MediaLocation) -> Result<MediaInfo> {
            Err(invalid("no probe in this test"))
        }
        fn transcode(
            &mut self,
            _: &MediaLocation,
            _: &TranscodeTarget,
            _: &mut Job<'_>,
        ) -> Result<MediaLocation> {
            Err(invalid("no conversion"))
        }
        fn load(&mut self, _: &MediaLocation) -> Result<Vec<u8>> {
            Err(invalid("no load"))
        }
        fn stream(&mut self, _: &MediaLocation, spec: StreamSpec) -> Result<Box<dyn VideoFrames>> {
            self.opened.fetch_add(1, Ordering::SeqCst);
            Ok(Box::new(Clip {
                frame: Frame::filled(spec.size, Rgba::BLACK),
                times: self.times.clone(),
            }))
        }
    }
    let mut f = fixture();
    let opened = Arc::new(AtomicU64::new(0));
    let times = Arc::new(Mutex::new(Vec::new()));
    f.engine.media = Box::new(Media {
        opened: opened.clone(),
        times: times.clone(),
    });
    let mut d = doc();
    let asset = AssetRef("assets/clip.mp4".into());
    d.theme.background = Background::Video {
        asset: asset.clone(),
        poster: None,
        framing: None,
    };
    d.assets.insert(asset, vec![1, 2, 3]);
    f.engine.document("offline", 0, d.clone(), true).unwrap();
    f.engine.tick_at(Duration::ZERO, time()).unwrap();
    f.engine
        .tick_at(Duration::from_millis(100), time())
        .unwrap();
    d.theme.elements[0].frame.x = 20.0;
    f.engine.document("offline", 1, d, false).unwrap();
    f.engine
        .tick_at(Duration::from_millis(200), time())
        .unwrap();
    f.engine.detach().unwrap();
    f.engine
        .tick_at(Duration::from_millis(300), time())
        .unwrap();
    assert_eq!(opened.load(Ordering::SeqCst), 1);
    assert_eq!(
        *times.lock().unwrap(),
        [
            Duration::ZERO,
            Duration::from_millis(100),
            Duration::from_millis(200),
            Duration::from_millis(300)
        ]
    );
}
#[test]
fn independent_scenes_and_demo_thumbnail_leave_live_histories_untouched() {
    let mut f = fixture();
    f.engine.thumbnail_sensors = Some(Box::new(FakeSensors::demo()));
    let d = doc();
    f.engine.document("one", 0, d.clone(), true).unwrap();
    f.engine.document("two", 0, d.clone(), true).unwrap();
    f.engine.tick_at(Duration::ZERO, time()).unwrap();
    let (meta, pixels) = send(
        &mut f.engine,
        "thumbnail",
        RuntimeOp::Thumbnail,
        &document(&d.theme, Some(&d.assets)).unwrap(),
    )
    .unwrap();
    assert_eq!(meta["width"], 360);
    assert!(!pixels.is_empty());
    f.engine.tick_at(Duration::from_secs(1), time()).unwrap();
    let seen = f.seen.lock().unwrap();
    let last = &seen[seen.len() - 2..];
    assert_eq!(last[0].history.len(), 2);
    assert_eq!(last[1].history.len(), 2);
}

#[test]
fn sensor_options_status_and_catalog_use_engine_sources_without_losing_histories() {
    let mut f = fixture();
    let configured = Arc::new(AtomicU64::new(0));
    let count = configured.clone();
    f.engine = f.engine.with_adapters(
        Box::new(move |_| {
            count.fetch_add(1, Ordering::SeqCst);
            Ok((
                Box::new(FakeSensors::demo()),
                Box::new(bezel_media::FfmpegTranscoder::new(None)),
            ))
        }),
        Box::new(FakeSensors::demo()),
    );
    f.engine.document("editor", 0, doc(), true).unwrap();
    f.engine.tick_at(Duration::ZERO, time()).unwrap();
    let options = wire::Options {
        ping_host: "127.0.0.1".into(),
        mangohud_dir: None,
        ffmpeg: None,
    };
    for _ in 0..2 {
        send(
            &mut f.engine,
            "editor",
            RuntimeOp::Options {
                options: options.clone(),
            },
            &[],
        )
        .unwrap();
    }
    assert_eq!(configured.load(Ordering::SeqCst), 1);
    f.engine.tick_at(Duration::from_secs(1), time()).unwrap();
    let (status, _) = send(
        &mut f.engine,
        "editor",
        RuntimeOp::Sensors {
            listed: Some(vec!["cpu.usage".into()]),
        },
        &[],
    )
    .unwrap();
    assert!(!wire::catalog(&status).is_empty());
    assert!(!wire::snapshot(&status).is_empty());
    assert_eq!(f.seen.lock().unwrap().last().unwrap().history.len(), 2);
    let mut bad = options;
    bad.ping_host = "x".repeat(254);
    assert!(
        send(
            &mut f.engine,
            "editor",
            RuntimeOp::Options { options: bad },
            &[]
        )
        .is_err()
    );
}
#[test]
fn suspend_reconnect_and_explicit_live_off_keep_the_same_document_clock() {
    let mut f = fixture();
    f.engine.document(&f.key, 0, doc(), true).unwrap();
    f.engine.live(&f.key, true).unwrap();
    f.engine.tick_at(Duration::ZERO, time()).unwrap();
    let frames = f.physical.log().frames.len();
    f.engine.suspend(true);
    f.engine.tick_at(Duration::from_secs(1), time()).unwrap();
    assert_eq!(f.physical.log().frames.len(), frames);
    f.engine.suspend(false);
    f.engine.disconnect_links();
    f.owner.clear().unwrap();
    f.engine.tick_at(Duration::from_secs(2), time()).unwrap();
    assert_eq!(f.physical.log().connects, 2);
    assert_eq!(
        f.seen.lock().unwrap().last().unwrap().clock,
        Duration::from_secs(2)
    );
    f.engine.live(&f.key, false).unwrap();
    f.engine.follow_saved_live(&[]);
    f.engine.tick_at(Duration::from_secs(3), time()).unwrap();
    assert_eq!(f.physical.log().connects, 2);
}
#[test]
fn legacy_baseline_is_seeded_after_orientation_and_before_the_first_engine_frame() {
    use bezel_core::{
        app::handoff::hand_over,
        domain::{discovery::DeviceAddress, handoff::HandedFrame},
        ports::HandoffStore,
    };
    #[derive(Default)]
    struct Store(Mutex<Option<HandedFrame>>);
    impl HandoffStore for Store {
        fn save(&self, frame: &HandedFrame) -> Result<()> {
            *self.0.lock().unwrap() = Some(frame.clone());
            Ok(())
        }
        fn take(&self, _: &DeviceAddress) -> Result<Option<HandedFrame>> {
            Ok(self.0.lock().unwrap().take())
        }
    }
    let mut f = fixture();
    let screen = bezel_core::app::discover_screens(&FakeBus::turing_88())
        .unwrap()
        .remove(0);
    let mut previous = f.physical.connect(&screen).unwrap();
    previous.set_orientation(Orientation::Landscape).unwrap();
    previous
        .present(&Frame::filled(Size::new(1920, 480), Rgba::BLACK))
        .unwrap();
    let store = Arc::new(Store::default());
    hand_over(
        previous.as_ref(),
        DeviceAddress(f.key.clone()),
        store.as_ref(),
        Duration::from_secs(99),
    )
    .unwrap();
    drop(previous);
    f.engine = f.engine.with_handoff(store, || Duration::from_secs(100));
    f.engine.document(&f.key, 0, doc(), true).unwrap();
    f.engine.live(&f.key, true).unwrap();
    assert_eq!(f.physical.log().seeds.len(), 1);
    assert_eq!(
        f.physical.log().frames.len(),
        1,
        "only the old owner has sent a frame"
    );
}
