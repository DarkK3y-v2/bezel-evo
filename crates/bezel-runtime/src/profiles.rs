//! Local display profiles, shared by the Studio and Light tray menus.
use crate::{Document, Engine, invalid};
use bezel_core::{
    Result,
    domain::{
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
    pub profiles: Vec<Profile>,
    pub automatic: bool,
    pub manual: Option<String>,
    pub default_profile: Option<String>,
}
impl Default for Config {
    fn default() -> Self {
        Self {
            profiles: vec![],
            automatic: true,
            manual: None,
            default_profile: None,
        }
    }
}
impl Config {
    pub fn validate(&self) -> Result<()> {
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
impl Overview {
    pub fn baseline_label(&self, unassigned: &str) -> String {
        let connected = self.displays.iter().any(|d| d.connected);
        let names = self
            .displays
            .iter()
            .filter(|d| {
                if connected {
                    d.connected
                } else {
                    d.theme_name.is_some()
                }
            })
            .map(|d| d.theme_name.as_deref().unwrap_or(unassigned))
            .collect::<Vec<_>>();
        if names.is_empty() {
            unassigned.into()
        } else {
            names.join(" · ")
        }
    }
}

/// Native tray strings, also used while no WebView is running.
pub fn menu_labels(language: bezel_core::domain::clock::Language) -> [&'static str; 4] {
    use bezel_core::domain::clock::Language;
    match language {
        Language::Italian => [
            "Profili",
            "Automatico",
            "Nessun tema selezionato",
            "Gestisci profili…",
        ],
        Language::PortugueseBr => [
            "Perfis",
            "Automático",
            "Nenhum tema selecionado",
            "Gerenciar perfis…",
        ],
        Language::English => [
            "Profiles",
            "Automatic",
            "No theme selected",
            "Manage profiles…",
        ],
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
        // Keep only active documents; failed reads retry at most once a second.
        self.documents.retain(|(id, screen), document| {
            if document.is_none() {
                return !poll;
            }
            engine
                .scenes
                .get(screen)
                .is_some_and(|scene| scene.profile_id.as_ref() == Some(id))
        });
        let config_changed = changed;
        let scene_bytes = |scene: &crate::Scene| {
            scene.runtime.assets().values().map(Vec::len).sum::<usize>()
                + scene.saved.bytes()
                + scene.profile_restore.as_ref().map_or(0, Document::bytes)
        };
        let mut budget: usize = engine.scenes.values().map(&scene_bytes).sum();
        let selected = self.selection.choose(&self.config, snapshot, now);
        for (key, scene) in &mut engine.scenes {
            let id = selected.clone().filter(|id| {
                self.config
                    .profiles
                    .iter()
                    .any(|p| &p.id == id && p.themes.contains_key(key))
            });
            // Editing pauses profile output. Its pixels never replace the editor's
            // published frame, so reopening Studio first sees its own document.
            let id = id.filter(|_| {
                scene.live
                    && !engine.images.viewed(key)
                    && scene
                        .profile_edit_at
                        .is_none_or(|at| at.elapsed() >= Duration::from_secs(2))
            });
            if config_changed || scene.profile_id != id {
                let before = scene_bytes(scene);
                scene.restore_profile();
                budget = budget
                    .saturating_sub(before)
                    .saturating_add(scene_bytes(scene));
                if let Some(id) = id {
                    let cache_key = (id.clone(), key.clone());
                    if !self.documents.contains_key(&cache_key) {
                        let document = self
                            .config
                            .profiles
                            .iter()
                            .find(|p| p.id == id)
                            .and_then(|p| p.themes.get(key))
                            .and_then(|path| {
                                bezel_themes::FsThemeStore
                                    .load(&ThemeLocation(path.clone()))
                                    .ok()
                            })
                            .map(|(theme, assets)| Document { theme, assets })
                            .filter(|d| d.validate().is_ok());
                        let cached_bytes: usize =
                            self.documents.values().flatten().map(Document::bytes).sum();
                        let document = document.filter(|d| {
                            cached_bytes.saturating_add(d.bytes()) <= crate::MAX_ALL_ASSETS / 2
                        });
                        self.documents.insert(cache_key.clone(), document);
                    }
                    if let Some(Some(document)) = self.documents.get(&cache_key)
                        && scene
                            .screen
                            .as_ref()
                            .and_then(|s| s.model())
                            .map_or(document.theme.canvas == scene.runtime.theme().canvas, |m| {
                                document.theme.misfit(m.panel).is_none()
                            })
                        && budget.saturating_add(document.bytes()) <= crate::MAX_ALL_ASSETS
                    {
                        scene.profile_restore = Some(Document {
                            theme: scene.runtime.theme().clone(),
                            assets: scene.runtime.assets().clone(),
                        });
                        scene.profile_id = Some(id);
                        scene.update(document.clone());
                        scene.runtime.automatic_cards(true);
                        budget += document.bytes();
                        changed = true;
                    }
                } else {
                    changed = true;
                }
            }
        }
        changed
    }
}

#[cfg(test)]
mod tests {
    use super::*;
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
