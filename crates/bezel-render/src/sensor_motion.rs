//! Time-based rotors; rendering never changes the stored element or sample.
use bezel_core::domain::sensor_motion::SensorMotion;
use std::time::Duration;

pub(crate) struct Rotor {
    settings: SensorMotion,
    at: Duration,
    speed: f64,
    phase: f64,
}

impl Rotor {
    pub(crate) fn new(settings: &SensorMotion, at: Duration) -> Self {
        Self {
            settings: settings.clone(),
            at,
            speed: 0.,
            phase: 0.,
        }
    }

    pub(crate) fn step(
        &mut self,
        settings: &SensorMotion,
        at: Duration,
        value: Option<f64>,
    ) -> (f32, bool) {
        if self.settings != *settings || at < self.at {
            *self = Self::new(settings, at);
        }
        let dt = at.saturating_sub(self.at).as_secs_f64().min(0.25);
        self.at = at;
        let target = value.filter(|v| v.is_finite()).unwrap_or(0.).max(0.) / settings.reference;
        let target =
            target.min(1.) * settings.turns_per_second * if settings.reverse { -1. } else { 1. };
        let tau = f64::from(settings.inertia_ms) / 1000.;
        let distance = if tau > 0. {
            let decay = (-dt / tau).exp();
            let distance = target * dt + (self.speed - target) * tau * (1. - decay);
            self.speed = target + (self.speed - target) * decay;
            distance
        } else {
            self.speed = target;
            target * dt
        };
        self.phase = (self.phase + distance * 360.).rem_euclid(360.);
        if target == 0. && self.speed.abs() < 0.001 {
            self.speed = 0.;
        }
        (self.phase as f32, target != 0. || self.speed != 0.)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    fn settings() -> SensorMotion {
        SensorMotion {
            sensor: bezel_core::domain::sensor::SensorKey::new("gpu.fan").unwrap(),
            reference: 3000.,
            turns_per_second: 1.,
            inertia_ms: 600,
            reverse: false,
        }
    }
    #[test]
    fn inertia_zero_stop_missing_and_frame_rate_independence() {
        let s = settings();
        let advance = |step: u64| {
            let mut r = Rotor::new(&s, Duration::ZERO);
            for t in (step..=1000).step_by(step as usize) {
                r.step(&s, Duration::from_millis(t), Some(3000.));
            }
            r
        };
        let mut fast = advance(20);
        let slow = advance(100);
        assert!((fast.phase - slow.phase).abs() < 1e-8);
        assert!(fast.speed > 0.8 && fast.speed < 1.);
        let before = fast.speed;
        fast.step(&s, Duration::from_millis(1020), Some(0.));
        assert!(fast.speed > 0. && fast.speed < before);
        for t in (1040..=10_000).step_by(20) {
            fast.step(&s, Duration::from_millis(t), None);
        }
        let stopped = fast.phase;
        assert!(!fast.step(&s, Duration::from_millis(10020), Some(0.)).1);
        assert_eq!(fast.phase, stopped);
        let mut immediate = s.clone();
        immediate.inertia_ms = 0;
        immediate.reverse = true;
        let mut r = Rotor::new(&immediate, Duration::ZERO);
        let (phase, active) = r.step(&immediate, Duration::from_millis(100), Some(1500.));
        assert!(active && (phase - 342.).abs() < 0.01);
        assert!(
            !r.step(&immediate, Duration::from_millis(200), Some(f64::NAN))
                .1
        );
    }
}

