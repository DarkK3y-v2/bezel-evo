//! The one engine hosted by Light or, after transport failure, in Studio.
//! No Tauri, serial implementation, or second renderer lives here.
#![forbid(unsafe_code)]
pub mod element_preview;
mod images;
mod presentation;
mod sampling;
mod wake;
pub use wake::Wake;
pub mod wire;
use bezel_core::{
    BezelError, Result,
    app::{HOST_VIDEO_FPS, HostVideo, ThemeRuntime, VideoState},
    domain::{
        clock::{Language, LocalTime},
        discovery::Screen,
        frame::Frame,
        sensor::SensorInfo,
        theme::{AssetRef, Background, BoxF, ElementId, Theme},
    },
    ports::{
        DeviceBus, FrameRenderer, MediaLocation, MediaTranscoder, RuntimeEndpoint, ScreenConnector,
        ScreenLink, SensorSource,
    },
};
use bezel_power::diagnostics::{LightEvent, light};
pub use images::Images;
use std::{
    collections::BTreeMap,
    path::PathBuf,
    sync::Arc,
    time::{Duration, Instant},
};

/// Maximum persistent scenes and bytes of each complete document.
pub const MAX_SCENES: usize = 16;
pub const MAX_DOCUMENT: usize = 64 * 1024 * 1024;
const MAX_ALL_ASSETS: usize = 256 * 1024 * 1024;
/// A complete document, with asset bytes outside the wire JSON.
#[derive(Clone, PartialEq)]
pub struct Document {
    pub theme: Theme,
    pub assets: BTreeMap<AssetRef, Vec<u8>>,
}
impl Document {
    fn bytes(&self) -> usize {
        self.assets.values().map(Vec::len).sum()
    }
    fn validate(&self) -> Result<()> {
        let size = self.theme.canvas;
        if self.assets.len() > 4096
            || self.bytes() > MAX_DOCUMENT
            || size.width == 0
            || size.height == 0
            || size.width > 2320
            || size.height > 2320
            || size.area() > 1080 * 2320
        {
            return Err(invalid("document exceeds engine limits"));
        }
        for asset in self.assets.keys() {
            bezel_themes::native::safe_asset_path(asset).map_err(|e| invalid(&e.to_string()))?;
        }
        Ok(())
    }
}
fn invalid(message: &str) -> BezelError {
    BezelError::InvalidInput(message.into())
}
struct Scene {
    id: u64,
    runtime: ThemeRuntime,
    saved: Document,
    revision: u64,
    link: Option<presentation::Link>,
    presenter: Option<presentation::Presenter>,
    sample_origin: Duration,
    screen: Option<Screen>,
    live: bool,
    frame: Option<Arc<Frame>>,
    sequence: u64,
    dirty: bool,
    orientation: Option<bezel_core::domain::geometry::Orientation>,
    source: Option<MediaLocation>,
    video_started: Duration,
    video_dirty: bool,
    rendered_at: Duration,
    frames: u64,
    error: Option<String>,
    cards: bool,
}
impl Scene {
    fn update(&mut self, document: Document) {
        if self.runtime.theme() == &document.theme && self.runtime.assets() == &document.assets {
            return;
        }
        let asset = |theme: &Theme| match &theme.background {
            Background::Video { asset, .. } => Some(asset.clone()),
            _ => None,
        };
        let playback_before = self.runtime.video().clone();
        let before = asset(self.runtime.theme());
        let after = asset(&document.theme);
        let changed_video = before != after
            || after
                .as_ref()
                .is_some_and(|a| self.runtime.assets().get(a) != document.assets.get(a));
        if self.runtime.assets() == &document.assets {
            self.runtime.replace_theme(document.theme);
        } else {
            self.runtime.replace(document.theme, document.assets);
        }
        if self.runtime.video() != &playback_before {
            self.video_dirty = true;
        }
        if changed_video {
            self.source = None;
        }
        self.dirty = true;
    }
}
/// Sensor/media adapter replacement for explicit configuration changes.
pub type Configure = Box<
    dyn Fn(&wire::Options) -> Result<(Box<dyn SensorSource>, Box<dyn MediaTranscoder>)>
        + Send
        + Sync,
>;

type Handoff = (
    Arc<dyn bezel_core::ports::HandoffStore + Send + Sync>,
    fn() -> Duration,
);

/// Persistent service. Scene lifetimes do not depend on an editor connection.
pub struct Engine {
    scenes: BTreeMap<String, Scene>,
    renderer: Box<dyn FrameRenderer>,
    sensors: sampling::Sampler,
    wake: Wake,
    catalog_sequence: u64,
    images: Arc<Images>,
    media: Box<dyn MediaTranscoder>,
    bus: Arc<dyn DeviceBus + Send + Sync>,
    connector: Arc<dyn ScreenConnector + Send + Sync>,
    origin: Instant,
    clock: fn() -> LocalTime,
    language: Language,
    cache: PathBuf,
    handoff: Option<Handoff>,
    thumbnail_sensors: Option<Box<dyn SensorSource>>,
    configure: Option<Configure>,
    options: Option<wire::Options>,
    suspended: bool,
    catalog: Vec<SensorInfo>,
    next_id: u64,
}
impl Engine {
    /// All adapters are injected; this exact constructor serves real Light,
    /// in-process recovery, and fake-device regression tests.
    #[allow(clippy::too_many_arguments)]
    pub fn new(
        renderer: Box<dyn FrameRenderer>,
        sensors: Box<dyn SensorSource>,
        media: Box<dyn MediaTranscoder>,
        bus: Arc<dyn DeviceBus + Send + Sync>,
        connector: Arc<dyn ScreenConnector + Send + Sync>,
        language: Language,
        cache: PathBuf,
        clock: fn() -> LocalTime,
    ) -> Result<Self> {
        let origin = Instant::now();
        let wake = Wake::default();
        let sensors = sampling::Sampler::new(sensors, origin, wake.clone())?;
        let catalog = sensors.latest().catalog.clone();
        Ok(Self {
            scenes: BTreeMap::new(),
            renderer,
            sensors,
            wake,
            catalog_sequence: 0,
            images: Arc::default(),
            media,
            bus,
            connector,
            origin,
            clock,
            language,
            cache,
            handoff: None,
            thumbnail_sensors: None,
            configure: None,
            options: None,
            suspended: false,
            catalog,
            next_id: 1,
        })
    }
    /// Compatibility baseline used only when a physical connection is actually opened.
    pub fn with_handoff(
        mut self,
        store: Arc<dyn bezel_core::ports::HandoffStore + Send + Sync>,
        wall: fn() -> Duration,
    ) -> Self {
        self.handoff = Some((store, wall));
        self
    }
    /// Configure adapter factories; thumbnails use an isolated demo source.
    pub fn with_adapters(
        mut self,
        configure: Configure,
        thumbnails: Box<dyn SensorSource>,
    ) -> Self {
        self.configure = Some(configure);
        self.thumbnail_sensors = Some(thumbnails);
        self
    }
    /// Change sources in place without replacing scene runtimes or histories.
    pub fn options(&mut self, options: wire::Options) -> Result<()> {
        if self.options.as_ref() == Some(&options) {
            return Ok(());
        }
        if options.ping_host.len() > 253
            || options.ffmpeg.as_ref().is_some_and(|p| p.len() > 32768)
            || options
                .mangohud_dir
                .as_ref()
                .is_some_and(|p| p.len() > 32768)
        {
            return Err(invalid("option bounds"));
        }
        if let Some(configure) = &self.configure {
            let (sensors, media) = configure(&options)?;
            self.sensors.replace(sensors);
            self.media = media;
            for scene in self.scenes.values_mut() {
                scene.runtime.use_catalog(&self.catalog);
                scene.dirty = true;
            }
        }
        self.options = Some(options);
        Ok(())
    }
    /// Register/update a draft, or commit the document only after Studio saved it.
    /// Revisions are scoped to the connected editor and reset on disconnect.
    pub fn document(
        &mut self,
        key: &str,
        revision: u64,
        document: Document,
        saved: bool,
    ) -> Result<()> {
        document.validate()?;
        if key.is_empty() || key.len() > 256 {
            return Err(invalid("invalid scene key"));
        }
        if let Some(scene) = self.scenes.get(key) {
            if revision != 0 && revision <= scene.revision {
                return Err(invalid("obsolete draft revision"));
            }
        } else if self.scenes.len() >= MAX_SCENES {
            return Err(invalid("too many scenes"));
        }
        let other_bytes: usize = self
            .scenes
            .iter()
            .filter(|(k, _)| k.as_str() != key)
            .map(|(_, s)| {
                s.runtime.assets().values().map(Vec::len).sum::<usize>() + s.saved.bytes()
            })
            .sum();
        if other_bytes.saturating_add(document.bytes().saturating_mul(2)) > MAX_ALL_ASSETS {
            return Err(invalid("engine asset budget exceeded"));
        }
        if let Some(scene) = self.scenes.get_mut(key) {
            if saved {
                scene.saved = document.clone();
            }
            scene.update(document);
            scene.revision = revision;
        } else {
            let mut runtime = ThemeRuntime::new(
                document.theme.clone(),
                document.assets.clone(),
                self.language,
            );
            runtime.use_catalog(&self.catalog);
            runtime.reuse_recent_frames(true);
            self.scenes.insert(
                key.into(),
                Scene {
                    id: self.next_id,
                    runtime,
                    saved: document,
                    revision,
                    link: None,
                    presenter: None,
                    sample_origin: self.sensors.latest().scheduled_at,
                    screen: None,
                    live: false,
                    frame: None,
                    sequence: 0,
                    dirty: true,
                    orientation: None,
                    source: None,
                    video_started: Duration::ZERO,
                    video_dirty: true,
                    rendered_at: Duration::ZERO,
                    frames: 0,
                    error: None,
                    cards: true,
                },
            );
            self.next_id += 1;
        }
        self.schedule_sensors();
        self.wake.notify();
        light(
            if saved {
                LightEvent::Saved
            } else {
                LightEvent::Draft
            },
            0,
            0.0,
            "document",
        );
        Ok(())
    }
    fn schedule_sensors(&self) {
        use bezel_core::domain::{history::Cadence, sensor::Wanted};
        let mut periods = Vec::new();
        let mut wanted = Wanted::nothing();
        if !self.suspended {
            for scene in self.scenes.values() {
                wanted = wanted.union(scene.runtime.wanted());
                periods.push((scene.runtime.refresh(), scene.sample_origin));
                for series in scene.runtime.theme().graph_series() {
                    if let Cadence::Every(period) = series.cadence {
                        periods.push((period, scene.sample_origin));
                    }
                }
            }
        }
        periods.sort();
        periods.dedup();
        self.sensors.schedule(periods, wanted);
    }
    /// Reconcile only explicit persisted live choices after legacy direct recovery.
    pub fn follow_saved_live(&mut self, keys: &[String]) {
        for (key, scene) in &mut self.scenes {
            if !keys.contains(key) {
                scene.live = false;
                scene.link = None;
                scene.presenter = None;
            }
        }
    }
    /// Attach a physical display once, preserving the runtime and its clocks.
    pub fn live(&mut self, key: &str, on: bool) -> Result<()> {
        let scene = self
            .scenes
            .get_mut(key)
            .ok_or_else(|| invalid("unknown scene"))?;
        if scene.live == on && (!on || scene.presenter.is_some()) {
            return Ok(());
        }
        if on && let Some(presenter) = &scene.presenter {
            presenter.pause(false);
            scene.dirty = true;
            scene.orientation = None;
            if matches!(scene.runtime.video(), VideoState::OnDevice(_)) {
                scene.video_dirty = true;
            }
        } else if on {
            scene.presenter = Some(presentation::Presenter::start(
                scene.id,
                key.into(),
                self.bus.clone(),
                self.connector.clone(),
                self.handoff.clone(),
                scene.runtime.theme().clone(),
                self.wake.clone(),
            )?);
            scene.dirty = true;
        } else if let Some(presenter) = &scene.presenter {
            presenter.pause(true);
        }
        scene.live = on;
        self.wake.notify();
        Ok(())
    }
    fn source(
        scene: &mut Scene,
        media: &mut dyn MediaTranscoder,
        cache: &std::path::Path,
    ) -> Result<()> {
        if scene.source.is_some() {
            return Ok(());
        }
        let Background::Video { asset, .. } = &scene.runtime.theme().background else {
            return Ok(());
        };
        if let Some(bytes) = scene.runtime.assets().get(asset) {
            std::fs::create_dir_all(cache).map_err(|e| BezelError::Transport(e.to_string()))?;
            let name = std::path::Path::new(&asset.0)
                .file_name()
                .ok_or_else(|| invalid("invalid video asset"))?
                .to_string_lossy();
            let path = cache.join(format!("scene-{}-{}-{name}", std::process::id(), scene.id));
            std::fs::write(&path, bytes).map_err(|e| BezelError::Transport(e.to_string()))?;
            let location = MediaLocation(path.to_string_lossy().into_owned());
            scene.runtime.set_video_info(media.probe(&location).ok());
            scene.source = Some(location);
        }
        Ok(())
    }
    /// Stop scheduling writes during final shutdown; links remain available to finish.
    pub fn suspend(&mut self, on: bool) {
        let resuming = self.suspended && !on;
        self.suspended = on;
        for scene in self.scenes.values_mut() {
            if let Some(presenter) = &scene.presenter {
                presenter.pause(on);
            }
            if !on {
                scene.dirty = true;
                if resuming && matches!(scene.runtime.video(), VideoState::OnDevice(_)) {
                    scene.video_dirty = true;
                }
            }
        }
        self.schedule_sensors();
    }
    /// Physical link loss/legacy takeover preserves document state, not handles.
    pub fn disconnect_links(&mut self) {
        for scene in self.scenes.values_mut() {
            scene.link = None;
            scene.presenter = None;
            scene.runtime.forget_screen();
            scene.orientation = None;
            scene.dirty = true;
        }
    }
    /// Run at the engine's own monotonic time, independent of canvas requests.
    pub fn tick(&mut self) -> Result<Duration> {
        self.tick_at(self.origin.elapsed(), (self.clock)())
    }
    /// Deterministic clock entry for tests and the same loop's scheduling.
    pub fn tick_at(&mut self, now: Duration, time: LocalTime) -> Result<Duration> {
        if self.suspended {
            return Ok(Duration::from_millis(50));
        }
        let reading = self.sensors.latest();
        if reading.sequence != self.catalog_sequence && !reading.catalog.is_empty() {
            self.catalog = reading.catalog.clone();
            self.catalog_sequence = reading.sequence;
        }
        let mut next = Duration::from_millis(50);
        for (key, scene) in &mut self.scenes {
            if scene.live && scene.presenter.is_none() {
                scene.presenter = Some(presentation::Presenter::start(
                    scene.id,
                    key.clone(),
                    self.bus.clone(),
                    self.connector.clone(),
                    None,
                    scene.runtime.theme().clone(),
                    self.wake.clone(),
                )?);
            }
            if let Some(presenter) = &scene.presenter {
                let update = presenter.poll();
                scene.frames += update.completed;
                if update.error {
                    scene.error = Some("screen I/O failed".into());
                    scene.link = None;
                    scene.runtime.forget_screen();
                    scene.dirty = true;
                }
                if let Some((screen, link)) = update.opened {
                    scene.screen = Some(screen);
                    scene.link = Some(link);
                    scene.orientation = None;
                    scene.runtime.forget_screen();
                    scene.dirty = true;
                    scene.error = None;
                }
            }
            let result = (|| -> Result<Duration> {
                if reading.sequence > 0
                    && scene.runtime.sample_on_time(
                        &mut sampling::Latest(reading.clone()),
                        reading.scheduled_at,
                    )?
                {
                    scene.dirty = true;
                }
                let mut due = scene.runtime.next_due();
                if matches!(scene.runtime.video(), VideoState::Host) {
                    due = due.min(scene.rendered_at + Duration::from_secs(1) / HOST_VIDEO_FPS);
                }
                if !scene.dirty && now < due {
                    return Ok(due - now);
                }
                Self::source(scene, self.media.as_mut(), &self.cache)?;
                if let Some(link) = &mut scene.link {
                    if scene
                        .runtime
                        .theme()
                        .misfit(link.identity().model.panel)
                        .is_some()
                    {
                        return Err(invalid("theme does not fit screen"));
                    }
                    let orientation = scene.runtime.theme().orientation;
                    if scene.orientation != Some(orientation) {
                        link.set_orientation(orientation)?;
                        scene.orientation = Some(orientation);
                    }
                    if scene.video_dirty || matches!(scene.runtime.video(), VideoState::NotStarted)
                    {
                        link.pending = false;
                        let host = scene.source.as_ref().map(|source| HostVideo {
                            media: self.media.as_mut(),
                            source: source.clone(),
                            fps: HOST_VIDEO_FPS,
                        });
                        let result = scene.runtime.start_video(link, host);
                        if link.pending {
                            return Ok(Duration::from_millis(5));
                        }
                        result?;
                        scene.video_started = now;
                        scene.video_dirty = false;
                    }
                }
                if scene.link.is_none()
                    && !scene.live
                    && matches!(scene.runtime.video(), VideoState::NotStarted)
                    && let Some(source) = &scene.source
                {
                    scene.runtime.start_host_video(HostVideo {
                        media: self.media.as_mut(),
                        source: source.clone(),
                        fps: HOST_VIDEO_FPS,
                    })?;
                    scene.video_started = now;
                }
                self.renderer.set_scene(scene.id);
                self.renderer.set_motion(true);
                let render_started = Instant::now();
                let frame = scene.runtime.render_at(
                    self.renderer.as_mut(),
                    time,
                    now,
                    now.saturating_sub(scene.video_started),
                )?;
                let render_millis = render_started.elapsed().as_secs_f64() * 1000.0;
                if scene
                    .frame
                    .as_ref()
                    .is_none_or(|previous| previous.as_ref() != &frame)
                {
                    scene.sequence = scene.sequence.saturating_add(1);
                    scene.frame = Some(Arc::new(frame));
                }
                let frame = scene
                    .frame
                    .as_ref()
                    .ok_or_else(|| invalid("missing rendered frame"))?
                    .clone();
                if scene.live
                    && scene.link.is_some()
                    && let Some(presenter) = &scene.presenter
                {
                    presenter.frame(frame.clone());
                }
                scene.rendered_at = now;
                scene.dirty = false;
                let mut delay = scene.runtime.next_due().saturating_sub(now);
                if matches!(scene.runtime.video(), VideoState::Host) {
                    delay = delay.min(Duration::from_secs(1) / HOST_VIDEO_FPS);
                }
                self.images.publish(
                    key,
                    images::Snapshot {
                        render_millis,
                        frame,
                        sequence: scene.sequence,
                        next_ms: delay.as_millis().clamp(5, 1000) as u32,
                    },
                );
                Ok(delay)
            })();
            match result {
                Ok(delay) => next = next.min(delay),
                Err(_) => {
                    scene.error = Some("scene update failed".into());
                    light(LightEvent::ScreenError, scene.id, 0.0, "scene");
                }
            }
        }
        Ok(next.max(Duration::from_millis(5)))
    }
    /// Completion barrier inspected by shutdown callers outside the engine lock.
    pub fn quiescent(&self) -> bool {
        self.scenes.values().all(|s| {
            s.presenter
                .as_ref()
                .is_none_or(presentation::Presenter::idle)
        })
    }
    /// Readonly frames: no renderer, sensor source or device is touched.
    pub fn wake(&self) -> Wake {
        self.wake.clone()
    }
    pub fn images(&self) -> Arc<Images> {
        self.images.clone()
    }
    pub fn image(&self, key: &str, after: u64, max: u32) -> Result<wire::Image> {
        self.images.latest(key, after, max)
    }
    /// Isolated inspector scene, with the runtime's current readings/histories.
    pub fn inspect(&mut self, key: &str, id: ElementId, max: u32, motion: bool) -> Result<Frame> {
        let scene = self
            .scenes
            .get_mut(key)
            .ok_or_else(|| invalid("unknown scene"))?;
        let theme = element_preview::isolate(scene.runtime.theme(), id)
            .ok_or_else(|| invalid("unknown element"))?;
        self.renderer.set_scene(scene.id | (1 << 63));
        self.renderer.set_motion(motion);
        let (frame, _) = scene.runtime.preview_detached(
            self.renderer.as_mut(),
            &theme,
            (self.clock)(),
            self.origin.elapsed(),
        )?;
        Ok(element_preview::fit_within(
            frame,
            element_preview::side_of(Some(max)),
        ))
    }
    /// Measure through the same renderer without advancing the live scene.
    pub fn measure(&mut self, key: &str, id: ElementId) -> Result<Option<BoxF>> {
        let scene = self
            .scenes
            .get_mut(key)
            .ok_or_else(|| invalid("unknown scene"))?;
        self.renderer.set_scene(scene.id | (1 << 63));
        scene.runtime.measure_element(
            self.renderer.as_mut(),
            id,
            (self.clock)(),
            self.origin.elapsed(),
        )
    }
    /// EOF restores only documents; the scene objects, clocks and links survive.
    pub fn detach(&mut self) -> Result<()> {
        let unsaved = self
            .scenes
            .values()
            .any(|s| s.runtime.theme() != &s.saved.theme || s.runtime.assets() != &s.saved.assets);
        light(
            if unsaved {
                LightEvent::ClosedUnsaved
            } else {
                LightEvent::ClosedSaved
            },
            0,
            0.0,
            "session",
        );
        for scene in self.scenes.values_mut() {
            scene.update(scene.saved.clone());
            scene.revision = 0;
            if !scene.cards {
                scene.cards = true;
                scene.runtime.automatic_cards(true);
                scene.dirty = true;
            }
        }
        self.schedule_sensors();
        Ok(())
    }
}
impl RuntimeEndpoint for Engine {
    fn images(&self) -> Option<Arc<dyn bezel_core::ports::RuntimeImages>> {
        Some(self.images.clone())
    }
    fn request(&mut self, metadata: &[u8], payload: &[u8]) -> Result<(Vec<u8>, Vec<u8>)> {
        wire::dispatch(self, metadata, payload)
    }
    fn disconnected(&mut self) -> Result<()> {
        self.detach()
    }
}

#[cfg(test)]
mod tests;
