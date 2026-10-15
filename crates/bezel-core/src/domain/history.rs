//! Rolling sample histories for graph elements
//! (D-2026-10-15-studio-redesign-fidelity-16): one series per sensor and
//! cadence. A graph without its own interval takes a point at every
//! refresh of the theme, as before; a graph with one takes a point every
//! interval, whatever the refresh.

use std::collections::{BTreeMap, VecDeque};
use std::time::Duration;

use super::sensor::{SensorKey, Snapshot};

/// The fewest points a graph draws.
pub const GRAPH_POINTS_MIN: u16 = 2;

/// The most points a graph draws, and the most a history keeps: every
/// tracked series keeps this many whatever its graphs show now, so a window
/// cut short and widened again (each preview of an edit swaps the theme in)
/// gets its older points back instead of losing them.
pub const GRAPH_POINTS_MAX: u16 = 3600;

/// The longest time between two points of a graph, seconds (one hour).
pub const GRAPH_INTERVAL_MAX_SECONDS: u32 = 3600;

/// How often a series takes a point.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub enum Cadence {
    /// At every refresh of the theme (a graph without its own interval).
    EveryRefresh,
    /// Every so long, whatever the refresh.
    Every(Duration),
}

impl Cadence {
    /// The cadence of a graph taking a point every `interval_seconds`
    /// (`None` or 0: at every refresh), at most
    /// [`GRAPH_INTERVAL_MAX_SECONDS`] apart.
    pub fn of_graph(interval_seconds: Option<u32>) -> Self {
        match interval_seconds.filter(|s| *s > 0) {
            Some(s) => Self::Every(Duration::from_secs(u64::from(
                s.min(GRAPH_INTERVAL_MAX_SECONDS),
            ))),
            None => Self::EveryRefresh,
        }
    }
}

/// One history: the readings of `key` taken at `cadence`.
#[derive(Debug, Clone, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub struct SeriesId {
    /// The sensor read.
    pub key: SensorKey,
    /// How often it takes a point.
    pub cadence: Cadence,
}

impl SeriesId {
    /// The series a graph of `key` taking a point every `interval_seconds`
    /// draws ([`Cadence::of_graph`]).
    pub fn graph(key: &SensorKey, interval_seconds: Option<u32>) -> Self {
        Self {
            key: key.clone(),
            cadence: Cadence::of_graph(interval_seconds),
        }
    }
}

/// When a sample is recorded.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Tick {
    /// A sample with no clock (a one-off frame, a thumbnail): every series
    /// takes it.
    Untimed,
    /// A sample at `now` on the caller's monotonic clock; `refresh` says it
    /// is the theme's refresh (not only one a graph's interval asked for).
    At {
        /// The caller's monotonic clock.
        now: Duration,
        /// Whether the theme's refresh was due.
        refresh: bool,
    },
}

/// The values of one series, oldest first, and when it next takes one.
#[derive(Debug, Clone, Default, PartialEq)]
struct Series {
    values: VecDeque<Option<f64>>,
    due: Option<Duration>,
}

impl Series {
    /// Whether the series takes the sample of `tick`; schedules its next
    /// point when it does (a whole interval after the due one, or after
    /// `now` for a series that fell further behind).
    fn takes(&mut self, cadence: Cadence, tick: Tick) -> bool {
        let (every, now) = match (cadence, tick) {
            (_, Tick::Untimed) => return true,
            (Cadence::EveryRefresh, Tick::At { refresh, .. }) => return refresh,
            (Cadence::Every(every), Tick::At { now, .. }) => (every, now),
        };
        if self.due.is_some_and(|due| now < due) {
            return false;
        }
        let next = self.due.unwrap_or(now) + every;
        self.due = Some(if next > now { next } else { now + every });
        true
    }
}

/// The last [`GRAPH_POINTS_MAX`] values of each tracked series, oldest
/// first. Unavailable readings are kept as gaps (`None`) so time stays
/// evenly spaced. A graph draws its own window of it ([`Self::points`]).
#[derive(Debug, Clone, Default, PartialEq)]
pub struct Histories {
    series: BTreeMap<SeriesId, Series>,
}

impl Histories {
    /// Tracks each series of `wanted` (repeats are one series).
    pub fn new(wanted: &[SeriesId]) -> Self {
        let series = wanted
            .iter()
            .map(|id| (id.clone(), Series::default()))
            .collect();
        Self { series }
    }

    /// Records the snapshot's value of each series the `tick` is for.
    pub fn push(&mut self, snapshot: &Snapshot, tick: Tick) {
        for (id, series) in &mut self.series {
            if !series.takes(id.cadence, tick) {
                continue;
            }
            series.values.push_back(snapshot.get(&id.key).value());
            while series.values.len() > usize::from(GRAPH_POINTS_MAX) {
                series.values.pop_front();
            }
        }
    }

    /// Lets the `tick` pass without a point (a sample that failed): each
    /// series it was for waits for its next one.
    pub fn skip(&mut self, tick: Tick) {
        for (id, series) in &mut self.series {
            series.takes(id.cadence, tick);
        }
    }

    /// Copies the values (and schedule) of series both histories track
    /// (after a theme edit). A graph whose interval changed has another
    /// series: it starts again, never mixing points of two cadences.
    pub fn adopt(&mut self, previous: &Histories) {
        for (id, series) in &mut self.series {
            if let Some(old) = previous.series.get(id) {
                series.values.extend(old.values.iter().copied());
                series.due = old.due;
            }
        }
    }

    /// When the next point of a series with its own interval is due (at
    /// once for one that took none yet); `None` when every series follows
    /// the refresh.
    pub fn next_due(&self) -> Option<Duration> {
        self.series
            .iter()
            .filter(|(id, _)| matches!(id.cadence, Cadence::Every(_)))
            .map(|(_, s)| s.due.unwrap_or_default())
            .min()
    }

    /// The whole history of `key` taken at every refresh, oldest first
    /// (empty when untracked).
    pub fn get(&self, key: &SensorKey) -> Vec<Option<f64>> {
        let id = SeriesId {
            key: key.clone(),
            cadence: Cadence::EveryRefresh,
        };
        self.points(&id, usize::from(GRAPH_POINTS_MAX))
    }

    /// The newest `count` values of the series `id`, oldest first: what a
    /// graph of `count` points draws (fewer while the history is shorter).
    pub fn points(&self, id: &SeriesId, count: usize) -> Vec<Option<f64>> {
        self.series
            .get(id)
            .map(|s| {
                let v = &s.values;
                v.iter()
                    .skip(v.len().saturating_sub(count))
                    .copied()
                    .collect()
            })
            .unwrap_or_default()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::domain::sensor::Reading;

    fn key(k: &str) -> SensorKey {
        SensorKey::new(k).expect("key")
    }

    fn reading(k: &SensorKey, v: f64) -> Snapshot {
        let mut s = Snapshot::default();
        s.insert(k.clone(), Reading::Value(v));
        s
    }

    fn at(seconds: u64, refresh: bool) -> Tick {
        Tick::At {
            now: Duration::from_secs(seconds),
            refresh,
        }
    }

    #[test]
    fn keeps_the_values_with_gaps_and_gives_each_graph_its_window() {
        let k = key("cpu.usage");
        let other = key("gpu.usage");
        let id = SeriesId::graph(&k, None);
        let mut h = Histories::new(&[id.clone(), id.clone()]);
        for v in [1.0, 2.0, 3.0, 4.0] {
            h.push(&reading(&k, v), Tick::Untimed);
        }
        h.push(&Snapshot::default(), Tick::Untimed);
        assert_eq!(h.points(&id, 3), vec![Some(3.0), Some(4.0), None]);
        assert_eq!(h.points(&id, 2), vec![Some(4.0), None]);
        assert_eq!(h.get(&k).len(), 5, "kept whatever the graphs show");
        assert!(h.get(&other).is_empty());

        let mut shorter = Histories::new(&[id.clone(), SeriesId::graph(&other, None)]);
        shorter.adopt(&h);
        assert_eq!(shorter.get(&k), h.get(&k), "a shorter window cuts nothing");
        assert!(shorter.get(&other).is_empty());
    }

    #[test]
    fn keeps_at_most_the_longest_window() {
        let k = key("cpu.usage");
        let mut h = Histories::new(&[SeriesId::graph(&k, None)]);
        for v in 0..=GRAPH_POINTS_MAX {
            h.push(&reading(&k, f64::from(v)), Tick::Untimed);
        }
        let kept = h.get(&k);
        assert_eq!(kept.len(), usize::from(GRAPH_POINTS_MAX));
        assert_eq!(kept[0], Some(1.0), "the oldest went");
    }

    #[test]
    fn a_graph_with_its_own_interval_takes_a_point_at_its_pace() {
        let k = key("cpu.usage");
        let (refresh, every_3s) = (SeriesId::graph(&k, None), SeriesId::graph(&k, Some(3)));
        let mut h = Histories::new(&[refresh.clone(), every_3s.clone()]);
        assert_eq!(h.next_due(), Some(Duration::ZERO), "at once");
        // A refresh every second, from 0 to 7 s.
        for s in 0..=7 {
            h.push(&reading(&k, s as f64), at(s, true));
        }
        assert_eq!(h.points(&refresh, 100).len(), 8, "one per refresh");
        assert_eq!(
            h.points(&every_3s, 100),
            [Some(0.0), Some(3.0), Some(6.0)],
            "one every 3 s"
        );
        assert_eq!(h.next_due(), Some(Duration::from_secs(9)));
    }

    #[test]
    fn an_interval_shorter_than_the_refresh_takes_the_samples_it_asked_for() {
        let k = key("cpu.usage");
        let (refresh, every_1s) = (SeriesId::graph(&k, None), SeriesId::graph(&k, Some(1)));
        let mut h = Histories::new(&[refresh.clone(), every_1s.clone()]);
        // The theme refreshes every 4 s; the graph's interval adds samples.
        for s in 0..=4 {
            h.push(&reading(&k, s as f64), at(s, s % 4 == 0));
        }
        assert_eq!(h.points(&refresh, 100), [Some(0.0), Some(4.0)]);
        assert_eq!(h.points(&every_1s, 100).len(), 5);
    }

    #[test]
    fn a_late_sample_restarts_the_count_and_untimed_samples_feed_every_series() {
        let k = key("cpu.usage");
        let every_5s = SeriesId::graph(&k, Some(5));
        let mut h = Histories::new(std::slice::from_ref(&every_5s));
        h.push(&reading(&k, 1.0), at(0, true));
        h.push(&reading(&k, 2.0), at(12, true));
        assert_eq!(h.next_due(), Some(Duration::from_secs(17)));
        h.push(&reading(&k, 3.0), Tick::Untimed);
        assert_eq!(h.points(&every_5s, 9), [Some(1.0), Some(2.0), Some(3.0)]);
    }

    #[test]
    fn a_skipped_tick_waits_for_the_next_point() {
        let k = key("cpu.usage");
        let every_5s = SeriesId::graph(&k, Some(5));
        let mut h = Histories::new(std::slice::from_ref(&every_5s));
        h.skip(at(0, true));
        assert_eq!(h.next_due(), Some(Duration::from_secs(5)));
        assert!(h.points(&every_5s, 9).is_empty(), "no point recorded");
    }

    #[test]
    fn another_interval_is_another_series() {
        let k = key("cpu.usage");
        let mut h = Histories::new(&[SeriesId::graph(&k, Some(2))]);
        h.push(&reading(&k, 1.0), at(0, true));
        let mut edited = Histories::new(&[SeriesId::graph(&k, Some(30))]);
        edited.adopt(&h);
        assert!(
            edited.points(&SeriesId::graph(&k, Some(30)), 9).is_empty(),
            "no point of the old cadence"
        );
        let mut same = Histories::new(&[SeriesId::graph(&k, Some(2))]);
        same.adopt(&h);
        assert_eq!(
            same.next_due(),
            Some(Duration::from_secs(2)),
            "schedule kept"
        );
    }

    #[test]
    fn graph_cadences_ignore_zero_and_cap_the_interval() {
        assert_eq!(Cadence::of_graph(None), Cadence::EveryRefresh);
        assert_eq!(Cadence::of_graph(Some(0)), Cadence::EveryRefresh);
        assert_eq!(
            Cadence::of_graph(Some(90_000)),
            Cadence::Every(Duration::from_secs(3600))
        );
        assert_eq!(Histories::default().next_due(), None);
    }
}
