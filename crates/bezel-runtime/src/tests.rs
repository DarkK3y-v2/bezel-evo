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
use wire::{Command, document, request, response};
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
    op: Command,
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
            Command::Draft {
                revision: 1,
                saved: false,
            },
            &document(&saved.theme, Some(&saved.assets)).unwrap(),
        )
        .unwrap();
        send(&mut f.engine, &f.key, Command::Live { on: true }, &[]).unwrap();
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
        Command::Draft {
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
        Command::Draft {
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
            Command::Draft {
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
        Command::Draft {
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
        Command::Image {
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
        Command::Image {
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
        Command::Inspect {
            element: 1,
            max: 64,
            motion: false,
        },
        &[],
    )
    .unwrap();
    assert!(value["width"].as_u64().unwrap() <= 64);
    assert!(!pixels.is_empty());
    let (value, _) = send(&mut f.engine, &f.key, Command::Measure { element: 1 }, &[]).unwrap();
    assert_eq!(value["width"], 3.0);
    assert!(
        send(
            &mut f.engine,
            &f.key,
            Command::Image {
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
            Command::Inspect {
                element: 999,
                max: 64,
                motion: true
            },
            &[]
        )
        .is_err()
    );
    assert!(send(&mut f.engine, &f.key, Command::Live { on: false }, &[1]).is_err());
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
                Command::Draft {
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
            Command::Draft {
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
