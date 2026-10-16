//! The one engine hosted by Light or, after transport failure, in Studio.
//! No Tauri, serial implementation, or second renderer lives here.
#![forbid(unsafe_code)]
pub mod element_preview;
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
    link: Option<Box<dyn ScreenLink>>,
    screen: Option<Screen>,
    live: bool,
    frame: Option<Frame>,
    sequence: u64,
    dirty: bool,
    orientation: Option<bezel_core::domain::geometry::Orientation>,
    source: Option<MediaLocation>,
    video_started: Duration,
    retry: Duration,
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
        if changed_video {
            self.source = None;
        }
        self.dirty = true;
    }
}
/// Persistent service. Scene lifetimes do not depend on an editor connection.
pub struct Engine {
    scenes: BTreeMap<String, Scene>,
    renderer: Box<dyn FrameRenderer>,
    sensors: Box<dyn SensorSource>,
    media: Box<dyn MediaTranscoder>,
    bus: Arc<dyn DeviceBus + Send + Sync>,
    connector: Arc<dyn ScreenConnector + Send + Sync>,
    origin: Instant,
    clock: fn() -> LocalTime,
    language: Language,
    cache: PathBuf,
    catalog: Vec<SensorInfo>,
    next_id: u64,
}
impl Engine {
    /// All adapters are injected; this exact constructor serves real Light,
    /// in-process recovery, and fake-device regression tests.
    #[allow(clippy::too_many_arguments)]
    pub fn new(
        renderer: Box<dyn FrameRenderer>,
        mut sensors: Box<dyn SensorSource>,
        media: Box<dyn MediaTranscoder>,
        bus: Arc<dyn DeviceBus + Send + Sync>,
        connector: Arc<dyn ScreenConnector + Send + Sync>,
        language: Language,
        cache: PathBuf,
        clock: fn() -> LocalTime,
    ) -> Result<Self> {
        let catalog = sensors.catalog()?;
        Ok(Self {
            scenes: BTreeMap::new(),
            renderer,
            sensors,
            media,
            bus,
            connector,
            origin: Instant::now(),
            clock,
            language,
            cache,
            catalog,
            next_id: 1,
        })
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
                    screen: None,
                    live: false,
                    frame: None,
                    sequence: 0,
                    dirty: true,
                    orientation: None,
                    source: None,
                    video_started: Duration::ZERO,
                    retry: Duration::ZERO,
                    rendered_at: Duration::ZERO,
                    frames: 0,
                    error: None,
                    cards: true,
                },
            );
            self.next_id += 1;
        }
        Ok(())
    }
    /// Attach a physical display once, preserving the runtime and its clocks.
    pub fn live(&mut self, key: &str, on: bool) -> Result<()> {
        let scene = self
            .scenes
            .get_mut(key)
            .ok_or_else(|| invalid("unknown scene"))?;
        if scene.live == on {
            return Ok(());
        }
        if on {
            let screen = bezel_core::app::choose_screen(
                bezel_core::app::discover_screens(self.bus.as_ref())?,
                Some(key),
            )?;
            let link = self.connector.connect(&screen)?;
            if scene
                .runtime
                .theme()
                .misfit(link.identity().model.panel)
                .is_some()
            {
                return Err(invalid("theme does not fit screen"));
            }
            scene.runtime.forget_screen();
            scene.link = Some(link);
            scene.screen = Some(screen);
            scene.dirty = true;
        } else {
            scene.link = None;
        }
        scene.live = on;
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
    /// Run at the engine's own monotonic time, independent of canvas requests.
    pub fn tick(&mut self) -> Result<Duration> {
        self.tick_at(self.origin.elapsed(), (self.clock)())
    }
    /// Deterministic clock entry for tests and the same loop's scheduling.
    pub fn tick_at(&mut self, now: Duration, time: LocalTime) -> Result<Duration> {
        let mut next = Duration::from_millis(50);
        for scene in self.scenes.values_mut() {
            if scene.live
                && scene.link.is_none()
                && now >= scene.retry
                && let Some(screen) = &scene.screen
            {
                match bezel_core::app::reopen_screen(
                    self.bus.as_ref(),
                    self.connector.as_ref(),
                    screen,
                ) {
                    Ok((screen, link)) => {
                        scene.screen = Some(screen);
                        scene.link = Some(link);
                        scene.orientation = None;
                        scene.runtime.forget_screen();
                        scene.dirty = true;
                    }
                    Err(error) => {
                        scene.error = Some(error.to_string());
                        scene.retry = now + Duration::from_secs(2);
                    }
                }
            }
            let mut due = scene.runtime.next_due();
            if matches!(scene.runtime.video(), VideoState::Host) {
                due = due.min(scene.rendered_at + Duration::from_secs(1) / HOST_VIDEO_FPS);
            }
            if !scene.dirty && now < due {
                next = next.min(due - now);
                continue;
            }
            Self::source(scene, self.media.as_mut(), &self.cache)?;
            if let Some(link) = scene.link.as_mut() {
                let orientation = scene.runtime.theme().orientation;
                if scene.orientation != Some(orientation) {
                    link.set_orientation(orientation)?;
                    scene.orientation = Some(orientation);
                }
                if matches!(scene.runtime.video(), VideoState::NotStarted) {
                    let host = scene.source.as_ref().map(|source| HostVideo {
                        media: self.media.as_mut(),
                        source: source.clone(),
                        fps: HOST_VIDEO_FPS,
                    });
                    scene.runtime.start_video(link.as_mut(), host)?;
                    scene.video_started = now;
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
            scene.runtime.sample_on_time(self.sensors.as_mut(), now)?;
            let frame = scene.runtime.render_at(
                self.renderer.as_mut(),
                time,
                now,
                now.saturating_sub(scene.video_started),
            )?;
            if scene.frame.as_ref() != Some(&frame) {
                scene.sequence = scene.sequence.saturating_add(1);
                scene.frame = Some(frame.clone());
            }
            if let Some(link) = scene.link.as_mut() {
                if let Err(error) = link.present(&frame) {
                    scene.error = Some(error.to_string());
                    scene.link = None;
                    scene.runtime.forget_screen();
                    scene.retry = now + Duration::from_secs(2);
                } else {
                    scene.frames += 1;
                    scene.error = None;
                }
            }
            scene.rendered_at = now;
            scene.dirty = false;
            let mut delay = scene.runtime.next_due().saturating_sub(now);
            if matches!(scene.runtime.video(), VideoState::Host) {
                delay = delay.min(Duration::from_secs(1) / HOST_VIDEO_FPS);
            }
            next = next.min(delay);
        }
        Ok(next.max(Duration::from_millis(5)))
    }
    /// Latest authoritative image, reduced without rendering a second scene.
    pub fn image(&mut self, key: &str, after: u64, max: u32) -> Result<wire::Image> {
        if max == 0 || max > 2320 {
            return Err(invalid("invalid canvas bound"));
        }
        self.tick()?;
        let scene = self
            .scenes
            .get(key)
            .ok_or_else(|| invalid("unknown scene"))?;
        let frame = scene
            .frame
            .as_ref()
            .ok_or_else(|| invalid("scene has no image"))?;
        let next = scene
            .runtime
            .next_due()
            .saturating_sub(self.origin.elapsed())
            .as_millis()
            .clamp(5, 1000) as u32;
        if scene.sequence == after {
            return Ok(wire::Image {
                sequence: scene.sequence,
                next_ms: next,
                frame: None,
            });
        }
        Ok(wire::Image {
            sequence: scene.sequence,
            next_ms: next,
            frame: Some(element_preview::fit_within(frame.clone(), max)),
        })
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
        for scene in self.scenes.values_mut() {
            scene.update(scene.saved.clone());
            scene.revision = 0;
            scene.runtime.automatic_cards(true);
        }
        Ok(())
    }
}
impl RuntimeEndpoint for Engine {
    fn request(&mut self, metadata: &[u8], payload: &[u8]) -> Result<(Vec<u8>, Vec<u8>)> {
        wire::dispatch(self, metadata, payload)
    }
    fn disconnected(&mut self) -> Result<()> {
        self.detach()
    }
}

#[cfg(test)]
mod tests;
