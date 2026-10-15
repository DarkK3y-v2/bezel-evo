//! Rolling sample histories for graph elements.

use std::collections::{BTreeMap, VecDeque};

use super::sensor::{SensorKey, Snapshot};

/// The fewest points a graph draws.
pub const GRAPH_POINTS_MIN: u16 = 2;

/// The most points a graph draws, and the most a history keeps: every
/// tracked series keeps this many whatever its graphs show now, so a window
/// cut short and widened again (each preview of an edit swaps the theme in)
/// gets its older points back instead of losing them.
pub const GRAPH_POINTS_MAX: u16 = 3600;

/// The last [`GRAPH_POINTS_MAX`] values of each tracked sensor, oldest
/// first. Unavailable readings are kept as gaps (`None`) so time stays
/// evenly spaced. A graph draws its own window of it ([`Self::points`]).
#[derive(Debug, Clone, Default, PartialEq)]
pub struct Histories {
    series: BTreeMap<SensorKey, VecDeque<Option<f64>>>,
}

impl Histories {
    /// Tracks each key of `wanted` (the lengths its graphs show; a history
    /// keeps [`GRAPH_POINTS_MAX`] values whatever they are).
    pub fn new(wanted: &[(SensorKey, usize)]) -> Self {
        let series = wanted
            .iter()
            .map(|(key, _)| (key.clone(), VecDeque::new()))
            .collect();
        Self { series }
    }

    /// Appends the snapshot's value of every tracked key.
    pub fn push(&mut self, snapshot: &Snapshot) {
        for (key, values) in &mut self.series {
            values.push_back(snapshot.get(key).value());
            while values.len() > usize::from(GRAPH_POINTS_MAX) {
                values.pop_front();
            }
        }
    }

    /// Copies the values of keys both histories track (after a theme edit).
    pub fn adopt(&mut self, previous: &Histories) {
        for (key, values) in &mut self.series {
            if let Some(old) = previous.series.get(key) {
                values.extend(old.iter().copied());
            }
        }
    }

    /// The whole history of `key`, oldest first (empty when untracked).
    pub fn get(&self, key: &SensorKey) -> Vec<Option<f64>> {
        self.points(key, usize::from(GRAPH_POINTS_MAX))
    }

    /// The newest `count` values of `key`, oldest first: what a graph of
    /// `count` points draws (fewer while the history is shorter).
    pub fn points(&self, key: &SensorKey, count: usize) -> Vec<Option<f64>> {
        self.series
            .get(key)
            .map(|v| {
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

    fn reading(k: &SensorKey, v: f64) -> Snapshot {
        let mut s = Snapshot::default();
        s.insert(k.clone(), Reading::Value(v));
        s
    }

    #[test]
    fn keeps_the_values_with_gaps_and_gives_each_graph_its_window() {
        let k = SensorKey::new("cpu.usage").expect("key");
        let other = SensorKey::new("gpu.usage").expect("key");
        let mut h = Histories::new(&[(k.clone(), 2), (k.clone(), 3)]);
        for v in [1.0, 2.0, 3.0, 4.0] {
            h.push(&reading(&k, v));
        }
        h.push(&Snapshot::default());
        assert_eq!(h.points(&k, 3), vec![Some(3.0), Some(4.0), None]);
        assert_eq!(h.points(&k, 2), vec![Some(4.0), None]);
        assert_eq!(h.get(&k).len(), 5, "kept whatever the graphs show");
        assert!(h.get(&other).is_empty());

        let mut shorter = Histories::new(&[(k.clone(), 2), (other.clone(), 5)]);
        shorter.adopt(&h);
        assert_eq!(shorter.get(&k), h.get(&k), "a shorter window cuts nothing");
        assert!(shorter.get(&other).is_empty());
    }

    #[test]
    fn keeps_at_most_the_longest_window() {
        let k = SensorKey::new("cpu.usage").expect("key");
        let mut h = Histories::new(&[(k.clone(), 2)]);
        for v in 0..=GRAPH_POINTS_MAX {
            h.push(&reading(&k, f64::from(v)));
        }
        let kept = h.get(&k);
        assert_eq!(kept.len(), usize::from(GRAPH_POINTS_MAX));
        assert_eq!(kept[0], Some(1.0), "the oldest went");
    }
}
