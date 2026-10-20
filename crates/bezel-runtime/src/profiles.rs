//! Local display profiles, shared by the Studio and Light tray menus.
use crate::{Document, Engine, invalid};
use bezel_core::{
    Result,
    domain::{
        cover::{self, Cover, CoverDirection, CoverEffect, CoverStage},
        playback::{CardTrigger, TriggerSource},
        sensor::{SensorKey, Snapshot, Wanted},
    },
    ports::{ThemeLocation, ThemeStore},
};
use serde::{Deserialize, Serialize};
use std::{
    collections::{BTreeMap, BTreeSet},
    path::{Path, PathBuf},
    time::{Duration, SystemTime},
};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum Source {
    Foreground,
    Process,
    MediaPlaying,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Rule {
    pub source: Source,
    pub app: String,
    pub priority: u32,
    pub return_seconds: u32,
}
impl Rule {
    fn available(&self, snapshot: &Snapshot) -> bool {
        match self.source {
            Source::MediaPlaying => snapshot.media_available,
            _ => snapshot.activity_available,
        }
    }
    fn matches(&self, snapshot: &Snapshot) -> bool {
        self.available(snapshot)
            && CardTrigger {
                source: match self.source {
                    Source::Foreground => TriggerSource::Foreground,
                    Source::Process => TriggerSource::Process,
                    Source::MediaPlaying => TriggerSource::MediaPlaying,
                },
                app: self.app.clone(),
                face: 0,
                priority: self.priority,
                return_seconds: self.return_seconds,
                return_face: None,
                interval_seconds: None,
                next_face: false,
            }
            .matches(snapshot)
    }
}
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Profile {
    pub id: String,
    pub name: String,
    pub themes: BTreeMap<String, String>,
    pub rules: Vec<Rule>,
}

impl<'de> Deserialize<'de> for Profile {
    fn deserialize<D: serde::Deserializer<'de>>(
        deserializer: D,
    ) -> std::result::Result<Self, D::Error> {
        #[derive(Deserialize)]
        #[serde(deny_unknown_fields)]
        struct Stored {
            id: String,
            name: String,
            #[serde(default)]
            themes: BTreeMap<String, String>,
            #[serde(default)]
            screen: Option<String>,
            #[serde(default)]
            theme: Option<String>,
            rules: Vec<Rule>,
        }
        let mut stored = Stored::deserialize(deserializer)?;
        match (stored.screen, stored.theme) {
            (Some(screen), Some(theme)) if stored.themes.is_empty() => {
                stored.themes.insert(screen, theme);
            }
            (None, None) => {}
            _ => return Err(serde::de::Error::custom("conflicting profile assignments")),
        }
        Ok(Self {
            id: stored.id,
            name: stored.name,
            themes: stored.themes,
            rules: stored.rules,
        })
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default, deny_unknown_fields)]
pub struct Config {
    /// Shared effect used for manual, automatic and fallback changes.
    pub transition: TransitionSettings,
    pub profiles: Vec<Profile>,
    pub automatic: bool,
    pub manual: Option<String>,
    pub default_profile: Option<String>,
}
impl Default for Config {
    fn default() -> Self {
        Self {
            transition: TransitionSettings::default(),
            profiles: vec![],
            automatic: true,
            manual: None,
            default_profile: None,
        }
    }
}
impl Config {
    pub fn validate(&self) -> Result<()> {
        self.transition.cover()?;
        let mut ids = BTreeSet::new();
        if self.profiles.len() > 32 {
            return Err(invalid("too many profiles"));
        }
        for p in &self.profiles {
            if p.id.is_empty()
                || ["auto", "default", "manage"].contains(&p.id.as_str())
                || p.id.len() > 64
                || !p.id.bytes().all(|c| c.is_ascii_alphanumeric() || c == b'-')
                || !ids.insert(&p.id)
                || p.name.trim().is_empty()
                || p.name.len() > 160
                || p.themes.is_empty()
                || p.themes.len() > crate::MAX_SCENES
                || p.themes.iter().any(|(screen, theme)| {
                    screen.is_empty()
                        || screen.len() > 256
                        || theme.is_empty()
                        || theme.len() > 32768
                })
                || p.rules.len() > 16
            {
                return Err(invalid("invalid profile"));
            }
            for r in &p.rules {
                if r.priority > 100
                    || r.return_seconds > 300
                    || r.app.len() > 256
                    || (r.source != Source::MediaPlaying && r.app.trim().is_empty())
                {
                    return Err(invalid("invalid profile rule"));
                }
            }
        }
        for id in [&self.manual, &self.default_profile].into_iter().flatten() {
            if !ids.contains(id) {
                return Err(invalid("unknown profile selection"));
            }
        }
        Ok(())
    }
    pub fn select(&mut self, id: Option<&str>, automatic: bool) -> Result<()> {
        let mut next = self.clone();
        next.automatic = automatic;
        next.manual = id.map(str::to_owned);
        next.validate()?;
        *self = next;
        Ok(())
    }
    fn wanted(&self) -> Wanted {
        if !self.automatic {
            return Wanted::nothing();
        }
        self.profiles
            .iter()
            .flat_map(|p| &p.rules)
            .filter_map(|r| {
                SensorKey::new(if r.source == Source::MediaPlaying {
                    "media.sessions"
                } else {
                    "activity.processes"
                })
            })
            .collect()
    }
}

/// Whole-profile cover settings; existing configurations default to no motion.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default, deny_unknown_fields)]
pub struct TransitionSettings {
    /// none, curtain, wipe, blinds or mosaic.
    #[serde(deserialize_with = "effect_name")]
    pub effect: String,
    /// Left, right, up or down.
    pub direction: String,
    /// Closing plus opening in milliseconds, 150 to 3000.
    pub duration_ms: u32,
}
impl Default for TransitionSettings {
    fn default() -> Self {
        Self {
            effect: "none".into(),
            direction: "left".into(),
            duration_ms: 1500,
        }
    }
}
/// The whole-scene fade, slide and flip of earlier versions moved pixels the
/// host never has under a video the screen plays itself; a saved one becomes
/// the cover closest to it.
fn effect_name<'de, D: serde::Deserializer<'de>>(
    deserializer: D,
) -> std::result::Result<String, D::Error> {
    let name = String::deserialize(deserializer)?;
    Ok(match name.as_str() {
        "fade" => "mosaic",
        "slide" => "wipe",
        "flip" => "curtain",
        other => other,
    }
    .to_owned())
}
impl TransitionSettings {
    /// The cover to draw, `None` for an immediate change.
    pub(crate) fn cover(&self) -> Result<Option<Cover>> {
        let effect = match self.effect.as_str() {
            "none" => None,
            "curtain" => Some(CoverEffect::Curtain),
            "wipe" => Some(CoverEffect::Wipe),
            "blinds" => Some(CoverEffect::Blinds),
            "mosaic" => Some(CoverEffect::Mosaic),
            _ => return Err(invalid("unknown profile transition effect")),
        };
        let direction = match self.direction.as_str() {
            "left" => CoverDirection::Left,
            "right" => CoverDirection::Right,
            "up" => CoverDirection::Up,
            "down" => CoverDirection::Down,
            _ => return Err(invalid("unknown profile transition direction")),
        };
        if !(150..=3000).contains(&self.duration_ms) {
            return Err(invalid(
                "profile transition duration must be 150 to 3000 ms",
            ));
        }
        Ok(effect.map(|effect| Cover {
            effect,
            direction,
            panel: cover::DEFAULT_PANEL,
            accent: cover::DEFAULT_ACCENT,
        }))
    }
}

/// What a screen trying a profile from the profile manager says it shows; no
/// saved profile has this id (ids are letters, digits and `-`).
pub(crate) const PREVIEW_ID: &str = "__preview__";
/// How long a tried profile stays on show before the screen returns to what
/// it should show, with the same cover.
pub(crate) const PREVIEW_HOLD: Duration = Duration::from_secs(3);

/// The theme at `path` as a document the engine accepts.
pub(crate) fn load_document(path: &str) -> Option<Document> {
    bezel_themes::FsThemeStore
        .load(&ThemeLocation(path.to_owned()))
        .ok()
        .map(|(theme, assets)| Document { theme, assets })
        .filter(|d| d.validate().is_ok())
}

/// Whether `document` can be shown on `scene`'s screen (its canvas, when the
/// screen is not known yet).
pub(crate) fn fits(scene: &crate::Scene, document: &Document) -> bool {
    scene
        .screen
        .as_ref()
        .and_then(|s| s.model())
        .map_or(document.theme.canvas == scene.runtime.theme().canvas, |m| {
            document.theme.misfit(m.panel).is_none()
        })
}

/// Where a profile change stands on one screen.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum Phase {
    /// The cover closes over the old theme; the new one is not applied yet.
    Closing,
    /// Closed: the new theme is applied and its first frame is being drawn.
    Covered,
    /// The cover opens on the new theme's frames.
    Opening,
}

pub(crate) struct Animation {
    /// The profile applied once the cover is closed (`None`: the selected themes).
    pub target: Option<String>,
    pub phase: Phase,
    pub started: Duration,
    /// Coverage the closing starts from: a cover still moving when another
    /// profile is chosen closes from where it is.
    pub base: f32,
    pub cover: Cover,
    /// Closing and opening each take half the duration; loading the new theme
    /// happens in between and shortens neither.
    pub half: Duration,
    /// False for a preview: no profile is applied when it closes.
    pub apply: bool,
    /// A preview's theme to show once closed (`None`: it opens on the same).
    pub show: Option<Document>,
}
impl Animation {
    fn closing(
        target: Option<String>,
        cover: Cover,
        duration_ms: u32,
        now: Duration,
        base: f32,
    ) -> Self {
        Self {
            target,
            phase: Phase::Closing,
            started: now,
            base: base.clamp(0.0, 1.0),
            cover,
            half: Duration::from_millis(u64::from(duration_ms / 2)),
            apply: true,
            show: None,
        }
    }
    /// The cover the profile manager tries out: it closes over what the
    /// screen shows and opens on `show` (or the same theme), heading to the
    /// profile shown so that the service does not step in while it moves.
    pub fn preview(
        shown: Option<String>,
        cover: Cover,
        duration_ms: u32,
        now: Duration,
        base: f32,
        show: Option<Document>,
    ) -> Self {
        Self {
            apply: false,
            show,
            ..Self::closing(shown, cover, duration_ms, now, base)
        }
    }
    fn elapsed(&self, now: Duration) -> f32 {
        now.saturating_sub(self.started).as_secs_f32() / self.half.as_secs_f32().max(0.001)
    }
    pub fn coverage(&self, now: Duration) -> f32 {
        match self.phase {
            Phase::Closing => self.base + (1.0 - self.base) * cover::ease(self.elapsed(now)),
            Phase::Covered => 1.0,
            Phase::Opening => 1.0 - cover::ease(self.elapsed(now)),
        }
    }
    pub fn stage(&self) -> CoverStage {
        if self.phase == Phase::Opening {
            CoverStage::Opening
        } else {
            CoverStage::Closing
        }
    }
    pub fn closed(&self, now: Duration) -> bool {
        self.phase == Phase::Closing && (self.base >= 1.0 || self.elapsed(now) >= 1.0)
    }
    /// Starts the opening at the new theme's first frame.
    pub fn open(&mut self, now: Duration) {
        if self.phase == Phase::Covered {
            self.phase = Phase::Opening;
            self.started = now;
        }
    }
    pub fn finished(&self, now: Duration) -> bool {
        self.phase == Phase::Opening && self.elapsed(now) >= 1.0
    }
}

#[derive(Clone)]
pub struct ProfileFile(pub PathBuf);

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Display {
    pub key: String,
    pub name: String,
    pub theme: Option<String>,
    pub theme_name: Option<String>,
    pub connected: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct Overview {
    pub config: Config,
    pub displays: Vec<Display>,
}
/// Native tray strings, also used while no WebView is running.
pub fn menu_labels(language: bezel_core::domain::clock::Language) -> [&'static str; 4] {
    use bezel_core::domain::clock::Language;
    match language {
        Language::Italian => ["Profili", "Automatico", "Default", "Gestisci profili…"],
        Language::PortugueseBr => ["Perfis", "Automático", "Default", "Gerenciar perfis…"],
        Language::English => ["Profiles", "Automatic", "Default", "Manage profiles…"],
    }
}
impl ProfileFile {
    pub fn beside(settings: &Path) -> Self {
        Self(settings.with_file_name("profiles.json"))
    }
    pub fn overview(&self) -> Result<Overview> {
        let config = self.load()?;
        let settings = self.0.with_file_name("settings.json");
        let settings = std::fs::metadata(&settings)
            .ok()
            .filter(|m| m.len() <= 1024 * 1024)
            .and_then(|_| std::fs::read(settings).ok())
            .and_then(|bytes| serde_json::from_slice::<serde_json::Value>(&bytes).ok())
            .unwrap_or_default();
        let mut keys: BTreeSet<String> = config
            .profiles
            .iter()
            .flat_map(|p| p.themes.keys().cloned())
            .collect();
        if let Some(themes) = settings["screenThemes"].as_object() {
            keys.extend(themes.keys().cloned());
        }
        if let Some(key) = settings["selectedScreen"].as_str() {
            keys.insert(key.into());
        }
        if let Some(live) = settings["liveScreens"].as_array() {
            keys.extend(live.iter().filter_map(|v| v.as_str().map(str::to_owned)));
        }
        let displays = keys
            .into_iter()
            .map(|key| {
                let theme = settings["screenThemes"][&key]
                    .as_str()
                    .or_else(|| {
                        (settings["selectedScreen"].as_str() == Some(&key))
                            .then(|| settings["lastTheme"].as_str())
                            .flatten()
                    })
                    .map(str::to_owned);
                let theme_name = theme.as_ref().and_then(|path| {
                    bezel_themes::native::load_manifest(&ThemeLocation(path.clone()))
                        .ok()
                        .map(|t| t.name)
                        .or_else(|| {
                            Path::new(path)
                                .file_stem()
                                .map(|s| s.to_string_lossy().into_owned())
                        })
                });
                Display {
                    name: key.clone(),
                    key,
                    theme,
                    theme_name,
                    connected: false,
                }
            })
            .collect();
        Ok(Overview { config, displays })
    }
    pub fn load(&self) -> Result<Config> {
        let metadata = match std::fs::metadata(&self.0) {
            Ok(m) => m,
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => return Ok(Config::default()),
            Err(e) => return Err(invalid(&e.to_string())),
        };
        if metadata.len() > 1024 * 1024 {
            return Err(invalid("profile file too large"));
        }
        let bytes = std::fs::read(&self.0).map_err(|e| invalid(&e.to_string()))?;
        let config: Config =
            serde_json::from_slice(&bytes).map_err(|_| invalid("invalid profile file"))?;
        config.validate()?;
        Ok(config)
    }
    pub fn save(&self, config: &Config) -> Result<()> {
        config.validate()?;
        if let Some(parent) = self.0.parent() {
            std::fs::create_dir_all(parent).map_err(|e| invalid(&e.to_string()))?;
        }
        let bytes = serde_json::to_vec_pretty(config).map_err(|e| invalid(&e.to_string()))?;
        let temporary = self.0.with_extension(format!("{}.tmp", std::process::id()));
        std::fs::write(&temporary, bytes)
            .and_then(|()| std::fs::rename(&temporary, &self.0))
            .map_err(|e| invalid(&e.to_string()))
    }
    pub fn select(&self, id: Option<&str>, automatic: bool) -> Result<()> {
        let mut config = self.load()?;
        config.select(id, automatic)?;
        self.save(&config)
    }
}

#[derive(Default)]
struct Selection {
    active: Option<String>,
    release: Option<Duration>,
    return_seconds: u32,
    priority: u32,
}
impl Selection {
    fn choose(&mut self, config: &Config, snapshot: &Snapshot, now: Duration) -> Option<String> {
        if !config.automatic {
            self.active = config.manual.as_ref().cloned();
            self.release = None;
            return self.active.clone();
        }
        let matching = config
            .profiles
            .iter()
            .flat_map(|p| p.rules.iter().map(move |r| (p, r)))
            .filter(|(_, r)| r.matches(snapshot))
            // Stable saved order wins ties.
            .fold(None, |best: Option<(&Profile, &Rule)>, candidate| {
                if best.is_none_or(|(_, r)| candidate.1.priority > r.priority) {
                    Some(candidate)
                } else {
                    best
                }
            });
        if let Some((p, r)) = matching {
            if self.active.as_ref().is_some_and(|id| id != &p.id) && r.priority < self.priority {
                let until = *self
                    .release
                    .get_or_insert(now + Duration::from_secs(u64::from(self.return_seconds)));
                if now < until {
                    return self.active.clone();
                }
            }
            self.active = Some(p.id.clone());
            self.return_seconds = r.return_seconds;
            self.priority = r.priority;
            self.release = None;
        } else if let Some(profile) = self
            .active
            .as_ref()
            .and_then(|id| config.profiles.iter().find(|p| &p.id == id))
        {
            if profile.rules.iter().any(|r| !r.available(snapshot)) {
                return self.active.clone();
            }
            let until = *self
                .release
                .get_or_insert(now + Duration::from_secs(u64::from(self.return_seconds)));
            if now >= until {
                self.active = None;
                self.release = None;
            }
        } else {
            self.active = None;
            self.release = None;
        }
        self.active.clone().or_else(|| {
            config
                .default_profile
                .as_ref()
                .filter(|id| config.profiles.iter().any(|p| &p.id == *id))
                .cloned()
        })
    }
}

pub(crate) struct Service {
    file: ProfileFile,
    config: Config,
    stamp: Option<SystemTime>,
    poll: Duration,
    selection: Selection,
    documents: BTreeMap<(String, String), Option<Document>>,
}
impl Service {
    pub fn new(file: ProfileFile) -> Self {
        Self {
            file,
            config: Config::default(),
            stamp: None,
            poll: Duration::ZERO,
            selection: Selection::default(),
            documents: BTreeMap::new(),
        }
    }
    pub fn wanted(&self) -> Wanted {
        self.config.wanted()
    }
    pub fn tick(&mut self, engine: &mut Engine, snapshot: &Snapshot, now: Duration) -> bool {
        let mut changed = false;
        let poll = now >= self.poll;
        if poll {
            self.poll = now + Duration::from_secs(1);
            let stamp = std::fs::metadata(&self.file.0)
                .ok()
                .and_then(|m| m.modified().ok());
            if stamp != self.stamp
                && let Ok(config) = self.file.load()
            {
                changed = true;
                self.config = config;
                self.selection = Selection::default();
                self.documents.clear();
                self.stamp = stamp;
            }
        }
        // Re-entering a profile after editing must read its freshly saved theme.
        // Keep only active documents (and those a closing cover heads to);
        // failed reads retry at most once a second.
        self.documents.retain(|(id, screen), document| {
            if document.is_none() {
                return !poll;
            }
            engine.scenes.get(screen).is_some_and(|scene| {
                scene.profile_id.as_ref() == Some(id)
                    || scene
                        .profile_animation
                        .as_ref()
                        .is_some_and(|a| a.target.as_ref() == Some(id))
            })
        });
        let config_changed = changed;
        let mut budget: usize = engine.scenes.values().map(scene_bytes).sum();
        let selected = self.selection.choose(&self.config, snapshot, now);
        let cover = self.config.transition.cover().ok().flatten();
        let duration_ms = self.config.transition.duration_ms;
        for (key, scene) in &mut engine.scenes {
            // A profile being tried stays on show for its hold, then returns.
            if scene.preview_until.is_some_and(|until| now < until) {
                continue;
            }
            let id = selected.clone().filter(|id| {
                self.config
                    .profiles
                    .iter()
                    .any(|p| &p.id == id && p.themes.contains_key(key))
            });
            // Editing pauses profile output. Its pixels never replace the editor's
            // published frame, so reopening Studio first sees its own document.
            let viewed = engine.images.viewed(key);
            let id = id.filter(|_| {
                scene.live
                    && !viewed
                    && scene
                        .profile_edit_at
                        .is_none_or(|at| at.elapsed() >= Duration::from_secs(2))
            });
            // A closing cover already heads to the profile it will apply.
            let heading = match &scene.profile_animation {
                Some(a) if a.phase == Phase::Closing => a.target.clone(),
                _ => scene.profile_id.clone(),
            };
            if config_changed || heading != id {
                // The cover paints opaque pixels only, so it also hides a video
                // the screen plays itself. It waits for a theme that can be shown.
                let animate = scene.live
                    && !viewed
                    && scene.frame.is_some()
                    && (heading.is_some() || id.is_some())
                    && id
                        .as_deref()
                        .is_none_or(|id| self.document(id, key, scene).is_some());
                match cover.filter(|_| animate) {
                    Some(cover) => {
                        let base = scene
                            .profile_animation
                            .as_ref()
                            .map_or(0.0, |a| a.coverage(now));
                        scene.profile_animation =
                            Some(Animation::closing(id, cover, duration_ms, now, base));
                        scene.dirty = true;
                    }
                    None => changed |= self.apply(key, scene, id, &mut budget),
                }
            }
            if scene
                .profile_animation
                .as_ref()
                .is_some_and(|a| a.apply && a.closed(now))
                && let Some(mut animation) = scene.profile_animation.take()
            {
                changed |= self.apply(key, scene, animation.target.clone(), &mut budget);
                animation.phase = Phase::Covered;
                scene.profile_animation = Some(animation);
                scene.dirty = true;
            }
        }
        changed
    }

    /// The profile's theme for the screen `key`, read once and cached, when
    /// it fits the screen.
    fn document(&mut self, id: &str, key: &str, scene: &crate::Scene) -> Option<&Document> {
        let cache_key = (id.to_owned(), key.to_owned());
        if !self.documents.contains_key(&cache_key) {
            let document = self
                .config
                .profiles
                .iter()
                .find(|p| p.id == id)
                .and_then(|p| p.themes.get(key))
                .and_then(|path| load_document(path));
            let cached_bytes: usize = self.documents.values().flatten().map(Document::bytes).sum();
            let document = document
                .filter(|d| cached_bytes.saturating_add(d.bytes()) <= crate::MAX_ALL_ASSETS / 2);
            self.documents.insert(cache_key.clone(), document);
        }
        self.documents
            .get(&cache_key)
            .and_then(Option::as_ref)
            .filter(|document| fits(scene, document))
    }

    /// Shows the profile `id` (or the selected themes) on the screen at once.
    /// A cover in progress is kept: it is the one hiding this change.
    fn apply(
        &mut self,
        key: &str,
        scene: &mut crate::Scene,
        id: Option<String>,
        budget: &mut usize,
    ) -> bool {
        let animation = scene.profile_animation.take();
        let before = scene_bytes(scene);
        scene.restore_profile();
        *budget = budget
            .saturating_sub(before)
            .saturating_add(scene_bytes(scene));
        let mut changed = false;
        match id {
            Some(id) => {
                if let Some(document) = self.document(&id, key, scene).cloned()
                    && budget.saturating_add(document.bytes()) <= crate::MAX_ALL_ASSETS
                {
                    scene.profile_restore = Some(Document {
                        theme: scene.runtime.theme().clone(),
                        assets: scene.runtime.assets().clone(),
                    });
                    scene.profile_id = Some(id);
                    *budget += document.bytes();
                    scene.update(document);
                    scene.runtime.automatic_cards(true);
                    changed = true;
                }
            }
            None => changed = true,
        }
        scene.profile_animation = animation;
        changed
    }
}

fn scene_bytes(scene: &crate::Scene) -> usize {
    scene.runtime.assets().values().map(Vec::len).sum::<usize>()
        + scene.saved.bytes()
        + scene.profile_restore.as_ref().map_or(0, Document::bytes)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn transitions_are_backward_compatible_and_bounded() {
        let mut config: Config = serde_json::from_str("{}").unwrap();
        assert_eq!(config.transition.effect, "none");
        for effect in ["none", "curtain", "wipe", "blinds", "mosaic"] {
            config.transition.effect = effect.into();
            config.validate().unwrap();
            let saved = serde_json::to_vec(&config).unwrap();
            assert_eq!(serde_json::from_slice::<Config>(&saved).unwrap(), config);
        }
        // Whole-scene effects of earlier versions load as the nearest cover.
        for (old, new) in [("fade", "mosaic"), ("slide", "wipe"), ("flip", "curtain")] {
            let saved = format!(
                r#"{{"transition":{{"effect":"{old}","direction":"down","durationMs":600}}}}"#
            );
            let loaded: Config = serde_json::from_str(&saved).unwrap();
            loaded.validate().unwrap();
            assert_eq!(
                (
                    loaded.transition.effect.as_str(),
                    loaded.transition.direction.as_str()
                ),
                (new, "down")
            );
        }
        config.transition.duration_ms = 149;
        assert!(config.validate().is_err());
        config.transition.duration_ms = 3001;
        assert!(config.validate().is_err());
        config.transition.duration_ms = 600;
        config.transition.direction = "invalid".into();
        assert!(config.validate().is_err());
        config.transition.direction = "left".into();
        config.transition.effect = "invalid".into();
        assert!(config.validate().is_err());
    }
    #[test]
    fn a_cover_closes_and_opens_in_halves_around_the_first_new_frame() {
        let cover = Cover {
            effect: CoverEffect::Curtain,
            direction: CoverDirection::Left,
            panel: cover::DEFAULT_PANEL,
            accent: cover::DEFAULT_ACCENT,
        };
        let ms = Duration::from_millis;
        let mut animation =
            Animation::closing(Some("music".into()), cover, 800, Duration::ZERO, 0.0);
        assert_eq!(animation.coverage(Duration::ZERO), 0.0);
        assert!(!animation.closed(ms(399)));
        assert!(animation.closed(ms(400)));
        assert_eq!(animation.coverage(ms(400)), 1.0);
        // Loading the theme takes 600 ms: it stays covered, the opening waits.
        animation.phase = Phase::Covered;
        assert_eq!(animation.coverage(ms(1000)), 1.0);
        animation.open(ms(1000));
        assert_eq!(
            (animation.phase, animation.stage()),
            (Phase::Opening, CoverStage::Opening)
        );
        assert_eq!(animation.coverage(ms(1000)), 1.0);
        assert!(!animation.finished(ms(1399)));
        assert!(animation.finished(ms(1400)));
        assert_eq!(animation.coverage(ms(1400)), 0.0);
        // Another profile chosen mid-opening closes again from where it stands.
        let again = Animation::closing(None, cover, 800, ms(1200), animation.coverage(ms(1200)));
        assert!((again.coverage(ms(1200)) - 0.5).abs() < 1e-6);
        assert!(!again.closed(ms(1200)));
    }
    #[test]
    fn legacy_single_screen_profiles_migrate_without_losing_their_assignment() {
        let old = r#"{"profiles":[{"id":"gaming","name":"Gaming","screen":"COM3","theme":"wide.bezeltheme","rules":[]}],"automatic":false,"manual":"gaming"}"#;
        let config: Config = serde_json::from_str(old).unwrap();
        config.validate().unwrap();
        assert_eq!(config.profiles[0].themes["COM3"], "wide.bezeltheme");
        let saved = serde_json::to_value(&config).unwrap();
        assert!(saved["profiles"][0].get("screen").is_none());
        assert!(saved["profiles"][0].get("theme").is_none());
        assert_eq!(saved["profiles"][0]["themes"]["COM3"], "wide.bezeltheme");
        let duplicate = r#"{"id":"bad","name":"Bad","screen":"COM3","theme":"old","themes":{"COM4":"new"},"rules":[]}"#;
        assert!(serde_json::from_str::<Profile>(duplicate).is_err());
    }
    fn config() -> Config {
        Config {
            profiles: vec![
                Profile {
                    id: "music".into(),
                    name: "Music".into(),
                    themes: BTreeMap::from([("screen".into(), "music.bezeltheme".into())]),
                    rules: vec![Rule {
                        source: Source::MediaPlaying,
                        app: String::new(),
                        priority: 10,
                        return_seconds: 3,
                    }],
                },
                Profile {
                    id: "game".into(),
                    name: "Game".into(),
                    themes: BTreeMap::from([("screen".into(), "game.bezeltheme".into())]),
                    rules: vec![Rule {
                        source: Source::Foreground,
                        app: "Game.exe".into(),
                        priority: 20,
                        return_seconds: 2,
                    }],
                },
            ],
            ..Config::default()
        }
    }
    #[test]
    fn manual_selection_is_stable_and_automatic_restores_the_rules() {
        let mut c = config();
        c.select(Some("music"), false).unwrap();
        let mut s = Snapshot::default();
        s.foreground = Some("game".into());
        s.activity_available = true;
        let mut choice = Selection::default();
        assert_eq!(
            choice.choose(&c, &s, Duration::ZERO).as_deref(),
            Some("music")
        );
        c.select(None, true).unwrap();
        assert_eq!(
            choice.choose(&c, &s, Duration::ZERO).as_deref(),
            Some("game")
        );
    }
    #[test]
    fn priorities_delay_and_missing_measurements_preserve_the_expected_profile() {
        let c = config();
        let mut choice = Selection::default();
        let mut s = Snapshot::default();
        s.foreground = Some("game.exe".into());
        s.activity_available = true;
        s.media_available = true;
        assert_eq!(
            choice.choose(&c, &s, Duration::ZERO).as_deref(),
            Some("game")
        );
        s.foreground = None;
        assert_eq!(
            choice.choose(&c, &s, Duration::from_secs(1)).as_deref(),
            Some("game")
        );
        assert_eq!(
            choice.choose(&c, &s, Duration::from_secs(2)).as_deref(),
            Some("game")
        );
        assert_eq!(choice.choose(&c, &s, Duration::from_secs(3)), None);
        s.foreground = Some("game".into());
        choice.choose(&c, &s, Duration::from_secs(4));
        s.activity_available = false;
        assert_eq!(
            choice.choose(&c, &s, Duration::from_secs(40)).as_deref(),
            Some("game")
        );
    }
    #[test]
    fn invalid_configuration_is_rejected_without_changing_selection() {
        let mut c = config();
        assert!(c.select(Some("missing"), false).is_err());
        assert!(c.automatic);
        c.profiles[0].rules[0].app.clear();
        assert!(c.validate().is_ok());
        c.profiles[1].rules[0].app.clear();
        assert!(c.validate().is_err());
    }

    #[test]
    fn gaming_overrides_music_then_returns_after_its_delay_and_ties_keep_saved_order() {
        use bezel_core::domain::playback::MediaSession;
        let mut c = config();
        let mut snapshot = Snapshot::default();
        snapshot.activity_available = true;
        snapshot.media_available = true;
        snapshot.media.push(MediaSession {
            source: "Spotify".into(),
            title: "Track".into(),
            artist: String::new(),
            playing: true,
            position: 0.,
            duration: 100.,
            cover: vec![],
        });
        let mut choice = Selection::default();
        assert_eq!(
            choice.choose(&c, &snapshot, Duration::ZERO).as_deref(),
            Some("music")
        );
        snapshot.foreground = Some("GAME.EXE".into());
        assert_eq!(
            choice
                .choose(&c, &snapshot, Duration::from_secs(1))
                .as_deref(),
            Some("game")
        );
        snapshot.foreground = None;
        assert_eq!(
            choice
                .choose(&c, &snapshot, Duration::from_secs(2))
                .as_deref(),
            Some("game")
        );
        assert_eq!(
            choice
                .choose(&c, &snapshot, Duration::from_secs(3))
                .as_deref(),
            Some("game")
        );
        assert_eq!(
            choice
                .choose(&c, &snapshot, Duration::from_secs(4))
                .as_deref(),
            Some("music")
        );
        snapshot.foreground = Some("game".into());
        c.profiles[1].rules[0].priority = 10;
        assert_eq!(
            Selection::default()
                .choose(&c, &snapshot, Duration::ZERO)
                .as_deref(),
            Some("music")
        );
    }
    #[test]
    fn file_round_trip_and_selection_survive_a_restart() {
        let directory = std::env::temp_dir().join(format!("bezel-profiles-{}", std::process::id()));
        let file = ProfileFile(directory.join("profiles.json"));
        file.save(&config()).unwrap();
        file.select(Some("music"), false).unwrap();
        let loaded = file.load().unwrap();
        assert!(!loaded.automatic);
        assert_eq!(loaded.manual.as_deref(), Some("music"));
        std::fs::remove_file(&file.0).unwrap();
        std::fs::remove_dir(directory).unwrap();
    }
}
