//! Optional step colours for an element's sensor value.
use super::frame::Rgba;
use super::sensor::SensorKey;
use super::theme::{Element, ElementKind, TextContent};

/// One inclusive lower bound, in the sensor's native units.
#[derive(Debug, Clone, PartialEq)]
pub struct ColorThreshold {
    /// Start using this colour at this value.
    pub value: f64,
    /// Colour of the reached step.
    pub color: Rgba,
}

/// Absent on legacy themes, which keep their fixed paint.
#[derive(Debug, Clone, PartialEq)]
pub struct ColorByValue {
    /// Used by unbound text, shapes and SVG icons; bound objects use their own key.
    pub sensor: Option<SensorKey>,
    /// Below all thresholds, or when the reading is unavailable.
    pub base: Rgba,
    /// Presentation order. Highest reached bound wins; equal bounds use the last row.
    pub thresholds: Vec<ColorThreshold>,
}

impl ColorByValue {
    /// Resolve a step without interpolating colours or depending on row order.
    pub fn color(&self, value: Option<f64>) -> Rgba {
        let Some(value) = value.filter(|v| v.is_finite()) else {
            return self.base;
        };
        self.thresholds
            .iter()
            .filter(|t| t.value.is_finite() && value >= t.value)
            .max_by(|a, b| {
                a.value
                    .partial_cmp(&b.value)
                    .unwrap_or(std::cmp::Ordering::Equal)
            })
            .map_or(self.base, |t| t.color)
    }
}

impl Element {
    /// Colour for the current drawing. Unavailable samples never retain a stale
    /// eased value; gauges use their clamped target when no tween is active.
    pub fn value_color(
        &self,
        snapshot: &super::sensor::Snapshot,
        shown: &super::transition::ShownValues,
    ) -> Option<Rgba> {
        if matches!(
            &self.kind,
            ElementKind::Text {
                content: TextContent::Spectrum(_),
                ..
            }
        ) {
            return None;
        }
        if !self.supports_value_color() {
            return None;
        }
        let rule = self.color_by_value.as_ref()?;
        let value = self
            .color_sensor()
            .and_then(|key| snapshot.get(key).value())
            .filter(|v| v.is_finite())
            .map(|reading| {
                if self.bound_sensor().is_some() {
                    shown
                        .get(self.id)
                        .or_else(|| super::transition::target(self, snapshot))
                        .unwrap_or(reading)
                } else {
                    reading
                }
            });
        Some(rule.color(value))
    }

    /// Key read by the object itself, before any optional colour rule sensor.
    pub fn bound_sensor(&self) -> Option<&SensorKey> {
        match &self.kind {
            ElementKind::Text {
                content: TextContent::Sensor { key, .. },
                ..
            } => Some(key),
            ElementKind::Bar { binding, .. }
            | ElementKind::Ring { binding, .. }
            | ElementKind::Needle { binding, .. }
            | ElementKind::Graph { binding, .. } => Some(&binding.key),
            _ => None,
        }
    }

    /// Whether this kind can draw a value colour (SVG images are icons).
    pub fn supports_value_color(&self) -> bool {
        !self.is_group
            && self.card.is_none()
            && match &self.kind {
                ElementKind::Text {
                    content:
                        TextContent::Static(_) | TextContent::Sensor { .. } | TextContent::Spectrum(_),
                    ..
                }
                | ElementKind::Bar { .. }
                | ElementKind::Ring { .. }
                | ElementKind::Needle { .. }
                | ElementKind::Graph { .. } => true,
                ElementKind::Shape { video_window, .. } => !video_window,
                ElementKind::Image { asset, .. } => asset.0.to_ascii_lowercase().ends_with(".svg"),
                _ => false,
            }
    }

    /// Sensor wanted by an enabled rule; unsupported kinds ignore the field.
    pub fn color_sensor(&self) -> Option<&SensorKey> {
        if matches!(
            &self.kind,
            ElementKind::Text {
                content: TextContent::Spectrum(_),
                ..
            }
        ) {
            return None;
        }
        if !self.supports_value_color() {
            return None;
        }
        let rule = self.color_by_value.as_ref()?;
        self.bound_sensor().or(rule.sensor.as_ref())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn boundaries_unavailable_unsorted_and_equal_thresholds() {
        let green = Rgba::opaque(0, 200, 0);
        let orange = Rgba::opaque(255, 150, 0);
        let red = Rgba::opaque(255, 0, 0);
        let mut rule = ColorByValue {
            sensor: None,
            base: green,
            thresholds: vec![
                ColorThreshold {
                    value: 80.,
                    color: red,
                },
                ColorThreshold {
                    value: 60.,
                    color: orange,
                },
            ],
        };
        for (v, color) in [
            (None, green),
            (Some(f64::NAN), green),
            (Some(59.999), green),
            (Some(60.), orange),
            (Some(79.999), orange),
            (Some(80.), red),
            (Some(500.), red),
        ] {
            assert_eq!(rule.color(v), color);
        }
        rule.thresholds.push(ColorThreshold {
            value: 80.,
            color: green,
        });
        assert_eq!(rule.color(Some(80.)), green);
    }
}
