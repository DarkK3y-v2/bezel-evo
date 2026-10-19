//! Sensor-driven rotation, independently of sensor refresh and output pace.
use super::sensor::SensorKey;

/// A visual rotor driven by a non-negative sensor reading.
#[derive(Debug, Clone, PartialEq)]
pub struct SensorMotion {
    /// Sensor in its native unit, commonly fan RPM.
    pub sensor: SensorKey,
    /// Reading at which the maximum visual speed is reached.
    pub reference: f64,
    /// Maximum visual revolutions per second, not physical fan revolutions.
    pub turns_per_second: f64,
    /// Exponential response time, milliseconds; zero changes speed immediately.
    pub inertia_ms: u32,
    /// Rotate counterclockwise instead of clockwise.
    pub reverse: bool,
}

impl SensorMotion {
    /// Whether settings have finite, bounded values suitable for rendering.
    pub fn is_valid(&self) -> bool {
        self.reference.is_finite()
            && self.reference > 0.
            && self.reference <= 1e12
            && self.turns_per_second.is_finite()
            && self.turns_per_second > 0.
            && self.turns_per_second <= 10.
            && self.inertia_ms <= 10_000
    }
}
