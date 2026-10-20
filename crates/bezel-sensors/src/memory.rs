//! Installation-scoped Bezel memory diagnostics, shared by Studio and Light.
//! This is OS/process information, not a core sensor or renderer concern.
//! No CPU counters, command lines, modules, network or hardware are refreshed.

use std::collections::{BTreeMap, BTreeSet};

use std::path::{Path, PathBuf};
use std::sync::{Mutex, OnceLock};
use std::time::{Duration, Instant};

use serde::Serialize;

#[allow(unsafe_code)] // Read-only Win32 queries, each with its safety rationale.
mod windows;

/// The minimum interval between process scans (including failed scans).
pub const SAMPLE_INTERVAL: Duration = Duration::from_secs(5);

/// Which processes a driving adapter reports.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Scope {
    /// Studio, its WebView2 descendants, Light and the sensor reader.
    Studio,
    /// Light and the sensor reader only.
    Light,
}

/// The role of one process, translated by the driving adapter.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum Role {
    Studio,
    Webview,
    Light,
    Sensors,
}

/// One verified process. A failed memory query stays unavailable, never zero.
#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProcessMemory {
    pub pid: u32,
    pub role: Role,
    pub bytes: Option<u64>,
}

/// Private working set bytes on Windows; unavailable on unsupported systems.
#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MemoryReport {
    pub total_bytes: Option<u64>,
    pub processes: Vec<ProcessMemory>,
}

impl MemoryReport {
    fn unavailable() -> Self {
        Self {
            total_bytes: None,
            processes: Vec::new(),
        }
    }

    /// Filter the cached installation snapshot without scanning a second time.
    pub fn for_scope(&self, scope: Scope) -> Self {
        if scope == Scope::Studio || self.processes.is_empty() {
            return self.clone();
        }
        report(
            self.processes
                .iter()
                .filter(|p| matches!(p.role, Role::Light | Role::Sensors))
                .cloned()
                .collect(),
        )
    }
}

/// The same whole-MB formatting rule used by both driving adapters (decimal MB).
/// Keep byte counts unrounded during aggregation; unavailable is distinct from 0.
pub fn megabytes(bytes: u64) -> u64 {
    bytes.saturating_add(500_000) / 1_000_000
}

/// Light's localized disabled menu item; no process details leak into its label.
pub fn light_label(report: &MemoryReport, locale: &str) -> String {
    let (name, missing) = if locale.starts_with("it") {
        ("Memoria", "non disponibile")
    } else if locale.starts_with("pt") {
        ("Memória", "indisponível")
    } else {
        ("Memory", "not available")
    };
    match report.for_scope(Scope::Light).total_bytes {
        Some(bytes) => format!("{name}: {} MB", megabytes(bytes)),
        None => format!("{name}: {missing}"),
    }
}

/// The inexpensive topology from a single process snapshot.
#[derive(Clone, Debug)]
struct Process {
    pid: u32,
    parent: u32,
    name: String,
}

/// Verified identity and measurement, read only for plausible Bezel processes.
#[derive(Clone)]
struct Details {
    path: PathBuf,
    same_user: bool,
    bytes: Option<u64>,
}

trait Enumerator {
    fn processes(&mut self) -> Option<Vec<Process>>;
    fn details(&mut self, pid: u32) -> Option<Details>;
}

fn same_path(a: &Path, b: &Path) -> bool {
    // Windows executable paths are case insensitive. Inputs from the OS are
    // canonicalized, so junctions and the extended-path prefix agree too.
    a.to_string_lossy().replace('/', "\\").to_lowercase()
        == b.to_string_lossy().replace('/', "\\").to_lowercase()
}

fn report(processes: Vec<ProcessMemory>) -> MemoryReport {
    let total_bytes = processes
        .iter()
        .try_fold(0u64, |total, p| total.checked_add(p.bytes?));
    MemoryReport {
        total_bytes,
        processes,
    }
}

fn aggregate(enumerator: &mut impl Enumerator, directory: &Path) -> MemoryReport {
    let Some(processes) = enumerator.processes() else {
        return MemoryReport::unavailable();
    };
    let mut included = BTreeMap::new();
    let mut studios = BTreeSet::new();
    for process in &processes {
        let (role, path) = match process.name.to_ascii_lowercase().as_str() {
            "bezel-studio.exe" => (Role::Studio, directory.join("bezel-studio.exe")),
            "bezel.exe" => (Role::Light, directory.join("bezel.exe")),
            "bezel-sensors-helper.exe" => (
                Role::Sensors,
                directory.join("sensors/bezel-sensors-helper.exe"),
            ),
            _ => continue,
        };
        let Some(details) = enumerator.details(process.pid) else {
            continue;
        };
        if !details.same_user || !same_path(&details.path, &path) {
            continue;
        }
        if role == Role::Studio {
            studios.insert(process.pid);
        }
        included.insert(
            process.pid,
            ProcessMemory {
                pid: process.pid,
                role,
                bytes: details.bytes,
            },
        );
    }
    let parents: BTreeMap<_, _> = processes.iter().map(|p| (p.pid, p.parent)).collect();
    for process in &processes {
        if !process.name.eq_ignore_ascii_case("msedgewebview2.exe") {
            continue;
        }
        let mut ancestor = process.parent;
        let mut seen = BTreeSet::new();
        while !studios.contains(&ancestor) && seen.insert(ancestor) {
            let Some(parent) = parents.get(&ancestor) else {
                break;
            };
            ancestor = *parent;
        }
        if !studios.contains(&ancestor) {
            continue;
        }
        let Some(details) = enumerator.details(process.pid) else {
            continue;
        };
        // WebView2 lives in the shared Edge runtime, not the install directory.
        if !details.same_user
            || !details
                .path
                .file_name()
                .is_some_and(|name| name.eq_ignore_ascii_case("msedgewebview2.exe"))
        {
            continue;
        }
        included.insert(
            process.pid,
            ProcessMemory {
                pid: process.pid,
                role: Role::Webview,
                bytes: details.bytes,
            },
        );
    }
    report(included.into_values().collect())
}

#[derive(Default)]
struct Cache {
    sampled: Option<(Instant, MemoryReport)>,
}

impl Cache {
    fn sample(&mut self, now: Instant, read: impl FnOnce() -> MemoryReport) -> MemoryReport {
        if let Some((at, value)) = &self.sampled
            && now.saturating_duration_since(*at) < SAMPLE_INTERVAL
        {
            return value.clone();
        }
        let value = read();
        self.sampled = Some((now, value.clone()));
        value
    }
}

/// Cached OS measurement. Both adapters call this entry point; failed scans
/// are cached too, so a denied query cannot create a high-frequency retry loop.
pub fn sample(scope: Scope) -> MemoryReport {
    static CACHE: OnceLock<Mutex<Cache>> = OnceLock::new();
    let mut cache = CACHE
        .get_or_init(|| Mutex::new(Cache::default()))
        .lock()
        .unwrap_or_else(|e| e.into_inner());
    cache.sample(Instant::now(), system_report).for_scope(scope)
}

fn system_report() -> MemoryReport {
    {
        let Ok(executable) = std::env::current_exe().and_then(std::fs::canonicalize) else {
            return MemoryReport::unavailable();
        };
        let Some(directory) = executable.parent() else {
            return MemoryReport::unavailable();
        };
        let Some(mut enumerator) = windows::Processes::new() else {
            return MemoryReport::unavailable();
        };
        aggregate(&mut enumerator, directory)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    struct Fake {
        entries: Vec<(Process, Option<Details>)>,
        failed: bool,
        queried: Vec<u32>,
    }
    impl Enumerator for Fake {
        fn processes(&mut self) -> Option<Vec<Process>> {
            (!self.failed).then(|| self.entries.iter().map(|(p, _)| p.clone()).collect())
        }
        fn details(&mut self, pid: u32) -> Option<Details> {
            self.queried.push(pid);
            self.entries.iter().find(|(p, _)| p.pid == pid)?.1.clone()
        }
    }
    fn fake() -> Fake {
        Fake {
            entries: Vec::new(),
            failed: false,
            queried: Vec::new(),
        }
    }
    fn add(
        fake: &mut Fake,
        pid: u32,
        parent: u32,
        name: &str,
        path: &str,
        same_user: bool,
        bytes: Option<u64>,
    ) {
        fake.entries.push((
            Process {
                pid,
                parent,
                name: name.into(),
            },
            Some(Details {
                path: path.into(),
                same_user,
                bytes,
            }),
        ));
    }

    #[test]
    fn only_this_installation_user_and_studio_webview_tree_are_counted_once() {
        let mut f = fake();
        add(
            &mut f,
            1,
            0,
            "bezel-studio.exe",
            "/bezel/BEZEL-STUDIO.EXE",
            true,
            Some(100_000_000),
        );
        add(
            &mut f,
            2,
            1,
            "msedgewebview2.exe",
            "/edge/msedgewebview2.exe",
            true,
            Some(70_000_000),
        );
        add(
            &mut f,
            3,
            2,
            "msedgewebview2.exe",
            "/edge/msedgewebview2.exe",
            true,
            Some(50_000_000),
        );
        add(
            &mut f,
            4,
            0,
            "bezel.exe",
            "/bezel/bezel.exe",
            true,
            Some(40_000_000),
        );
        add(
            &mut f,
            5,
            0,
            "bezel-sensors-helper.exe",
            "/bezel/sensors/bezel-sensors-helper.exe",
            true,
            Some(24_000_000),
        );
        add(
            &mut f,
            6,
            0,
            "bezel-studio.exe",
            "/other/bezel-studio.exe",
            true,
            Some(999_000_000),
        );
        add(
            &mut f,
            7,
            6,
            "msedgewebview2.exe",
            "/edge/msedgewebview2.exe",
            true,
            Some(999_000_000),
        );
        add(
            &mut f,
            8,
            0,
            "bezel.exe",
            "/bezel/bezel.exe",
            false,
            Some(999_000_000),
        );
        add(
            &mut f,
            9,
            1,
            "msedgewebview2.exe",
            "/edge/msedgewebview2.exe",
            false,
            Some(999_000_000),
        );
        add(
            &mut f,
            10,
            0,
            "bezel-sensors-helper.exe",
            "/other/bezel-sensors-helper.exe",
            true,
            Some(999_000_000),
        );
        add(
            &mut f,
            11,
            0,
            "browser.exe",
            "/browser.exe",
            true,
            Some(999_000_000),
        );
        let result = aggregate(&mut f, Path::new("/bezel"));
        assert_eq!(result.total_bytes, Some(284_000_000));
        assert_eq!(
            result.processes.iter().map(|p| p.pid).collect::<Vec<_>>(),
            [1, 2, 3, 4, 5]
        );
        assert!(!f.queried.contains(&7));
        assert!(!f.queried.contains(&11));
        assert_eq!(result.for_scope(Scope::Light).total_bytes, Some(64_000_000));
        assert_eq!(light_label(&result, "it-IT"), "Memoria: 64 MB");
        assert_eq!(light_label(&result, "en"), "Memory: 64 MB");
        assert_eq!(light_label(&result, "pt-BR"), "Memória: 64 MB");
    }

    #[test]
    fn unavailable_memory_or_scan_is_never_reported_as_zero() {
        let mut f = fake();
        add(&mut f, 1, 0, "bezel.exe", "/bezel/bezel.exe", true, None);
        let result = aggregate(&mut f, Path::new("/bezel"));
        assert_eq!(result.total_bytes, None);
        assert_eq!(result.processes[0].bytes, None);
        assert_eq!(light_label(&result, "it"), "Memoria: non disponibile");
        f.failed = true;
        assert_eq!(
            aggregate(&mut f, Path::new("/bezel")),
            MemoryReport::unavailable()
        );
        assert_eq!(report(Vec::new()).total_bytes, Some(0));
    }

    #[test]
    fn exited_processes_cycles_and_pid_identity_changes_are_safe() {
        let mut f = fake();
        add(
            &mut f,
            1,
            0,
            "bezel-studio.exe",
            "/bezel/bezel-studio.exe",
            true,
            Some(1),
        );
        add(
            &mut f,
            2,
            3,
            "msedgewebview2.exe",
            "/edge/msedgewebview2.exe",
            true,
            Some(999),
        );
        add(
            &mut f,
            3,
            2,
            "msedgewebview2.exe",
            "/edge/msedgewebview2.exe",
            true,
            Some(999),
        );
        add(
            &mut f,
            4,
            1,
            "msedgewebview2.exe",
            "/other/process.exe",
            true,
            Some(999),
        );
        f.entries.push((
            Process {
                pid: 5,
                parent: 1,
                name: "msedgewebview2.exe".into(),
            },
            None,
        ));
        f.entries.push((
            Process {
                pid: 6,
                parent: 0,
                name: "bezel.exe".into(),
            },
            None,
        ));
        assert_eq!(aggregate(&mut f, Path::new("/bezel")).total_bytes, Some(1));
        f.entries.retain(|(p, _)| p.pid != 1);
        assert_eq!(aggregate(&mut f, Path::new("/bezel")).total_bytes, Some(0));
    }

    #[test]
    fn formatting_rounds_the_total_not_each_process_and_handles_overflow() {
        assert_eq!(megabytes(499_999), 0);
        assert_eq!(megabytes(500_000), 1);
        let result = report(vec![
            ProcessMemory {
                pid: 1,
                role: Role::Light,
                bytes: Some(499_999),
            },
            ProcessMemory {
                pid: 2,
                role: Role::Sensors,
                bytes: Some(499_999),
            },
        ]);
        assert_eq!(light_label(&result, "en"), "Memory: 1 MB");
        assert_eq!(
            report(vec![
                ProcessMemory {
                    pid: 1,
                    role: Role::Light,
                    bytes: Some(u64::MAX)
                },
                ProcessMemory {
                    pid: 2,
                    role: Role::Sensors,
                    bytes: Some(1)
                }
            ])
            .total_bytes,
            None
        );
    }

    #[test]
    fn cache_scans_at_most_every_five_seconds_including_failures() {
        let mut cache = Cache::default();
        let now = Instant::now();
        let mut scans = 0;
        for millis in [0, 1, 999, 4999, 5000, 5001, 9999, 10000] {
            cache.sample(now + Duration::from_millis(millis), || {
                scans += 1;
                MemoryReport::unavailable()
            });
        }
        assert_eq!(scans, 3);
    }
}
