// Corner radii as one value `{radius, corners}` (D-2026-10-15-studio-redesign-fidelity-22):
// `corners` null means every corner takes `radius`; an array is
// [top-left, top-right, bottom-right, bottom-left], each its own. The
// inspector edits a shape's, a bar's and a player cover's corners through
// these, whatever their fields are called in the theme.

/** The corners in drawing order around the box, with the i18n names of their fields. */
export const CORNERS = Object.freeze(['topLeft', 'topRight', 'bottomRight', 'bottomLeft']);

const radiusOf = (r) => (Number.isFinite(r) ? Math.max(0, r) : 0);

/** The value read from a theme's fields (a missing radius is 0; anything but four corners is none). */
export function cornerValue(radius, corners = null) {
  const each = Array.isArray(corners) && corners.length === 4;
  return { radius: radiusOf(radius), corners: each ? corners.map(radiusOf) : null };
}

/** `'each'` when the corners are set one by one, else `'same'`. */
export const cornerMode = (value) => (value.corners ? 'each' : 'same');

/** The value in `mode`: going to `each` starts every corner at the radius, back to `same` keeps the top-left one. */
export function withCornerMode(value, mode) {
  if (mode === cornerMode(value)) return value;
  if (mode === 'each') return { radius: value.radius, corners: Array(4).fill(value.radius) };
  return { radius: value.corners[0], corners: null };
}

/** The value with every corner at `r` (never below 0). */
export const withRadius = (value, r) => ({ radius: radiusOf(r), corners: null });

/** The value with corner `index` (CORNERS order) at `r`, the others unchanged. */
export function withCorner(value, index, r) {
  const corners = value.corners ?? Array(4).fill(value.radius);
  return { radius: value.radius, corners: corners.map((c, i) => (i === index ? radiusOf(r) : c)) };
}

/** The four radii, whatever the mode. */
export const radiiOf = (value) => value.corners ?? Array(4).fill(value.radius);

/**
 * The drawing of the corners: a box fitted in `frame` (CSS px) with the
 * object's proportions when its size `box` is known (never thinner than
 * 8px), and each radius keeping its share of the shorter side, none beyond
 * half of it. Without `box`, a square whose radii are drawn as they are.
 * @param {{radius: number, corners: number[]|null}} value
 * @param {{width: number, height: number}|null} box
 * @param {{width: number, height: number}} frame
 */
export function cornerDrawing(value, box = null, frame = { width: 72, height: 72 }) {
  const known = box && box.width > 0 && box.height > 0;
  const scale = known ? Math.min(frame.width / box.width, frame.height / box.height) : 1;
  const width = known ? Math.max(8, Math.round(box.width * scale)) : Math.min(frame.width, frame.height);
  const height = known ? Math.max(8, Math.round(box.height * scale)) : width;
  const most = Math.min(width, height) / 2;
  // Radii keep their share of the shorter side, also when a thin box is drawn thicker.
  const factor = known ? Math.min(width, height) / Math.min(box.width, box.height) : 1;
  const radii = radiiOf(value).map((r) => Math.round(Math.min(most, r * factor) * 10) / 10);
  return { width, height, radii };
}
