//! Object rotation around the unrotated frame center.
use super::theme::{BoxF, Element, ElementKind};

/// Normalizes finite degrees to (-180, 180], including positive zero.
pub fn normalize_degrees(degrees: f32) -> f32 {
    if !degrees.is_finite() {
        return 0.0;
    }
    let angle = degrees.rem_euclid(360.0);
    if angle > 180.0 {
        angle - 360.0
    } else if angle == 0.0 {
        0.0
    } else {
        angle
    }
}

/// Axis-aligned bounds of a frame rotated clockwise around its center.
pub fn rotated_bounds(frame: BoxF, degrees: f32) -> BoxF {
    let angle = normalize_degrees(degrees);
    if angle == 0.0 {
        return frame;
    }
    let (sin, cos) = angle.to_radians().sin_cos();
    let width = frame.width * cos.abs() + frame.height * sin.abs();
    let height = frame.width * sin.abs() + frame.height * cos.abs();
    let (cx, cy) = frame.center();
    BoxF::new(cx - width / 2.0, cy - height / 2.0, width, height)
}

impl Element {
    /// Effective angle; containers, their members and video windows stay upright.
    pub fn applied_rotation(&self) -> f32 {
        if self.is_group
            || self.group_parent.is_some()
            || self.card.is_some()
            || self.card_member.is_some()
            || matches!(
                self.kind,
                ElementKind::Shape {
                    video_window: true,
                    ..
                }
            )
        {
            0.0
        } else {
            normalize_degrees(self.rotation)
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn normalization_and_bounds() {
        for (input, expected) in [
            (180., 180.),
            (-180., 180.),
            (540., 180.),
            (190., -170.),
            (-0., 0.),
        ] {
            assert_eq!(normalize_degrees(input), expected);
        }
        assert!(!normalize_degrees(-0.).is_sign_negative());
        let frame = BoxF::new(50., 45., 60., 30.);
        assert_eq!(rotated_bounds(frame, 0.), frame);
        let b = rotated_bounds(frame, 90.);
        assert!((b.width - 30.).abs() < 1e-3 && (b.height - 60.).abs() < 1e-3);
        let b = rotated_bounds(frame, 45.);
        assert!((b.width - 90. / 2_f32.sqrt()).abs() < 1e-3);
        // Shared fixture is also read by JS and renderer tests.
        let fixture: serde_json::Value =
            serde_json::from_str(include_str!("../../tests/fixtures/rotation-parity.json"))
                .unwrap();
        let b = rotated_bounds(frame, fixture["rotation"].as_f64().unwrap() as f32);
        for (name, value) in [
            ("x", b.x),
            ("y", b.y),
            ("width", b.width),
            ("height", b.height),
        ] {
            assert!((value - fixture["bounds"][name].as_f64().unwrap() as f32).abs() < 1e-3);
        }
    }
}
