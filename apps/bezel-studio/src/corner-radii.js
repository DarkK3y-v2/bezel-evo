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

/** The least a radius above 0 is drawn, CSS px: a rounded corner never looks square. */
export const LEAST_DRAWN = 2;

/**
 * How much of its most a radius is drawn, from how much of its most it is
 * (both 0..1): the square root, so a small radius on a large object stays
 * visible (24 px on a 342-px side, 14%, is drawn at 37%) while a pill or a
 * circle stays one. Increasing: a larger radius is never drawn smaller.
 */
export const drawnShare = (share) => Math.sqrt(Math.min(1, Math.max(0, share)));

/**
 * The drawing of the corners: a box fitted in `frame` (CSS px) with the
 * object's proportions when its size `box` is known (never thinner than
 * 8px; without `box`, a square standing for the object). The largest
 * radius is drawn at drawnShare() of the most the drawing allows (half its
 * shorter side), for the share it is of the object's most (half of the
 * object's shorter side), and at least LEAST_DRAWN; the other corners keep
 * their proportion to it, so corners set one by one differ as they do on
 * the object. A radius beyond the object's most counts as the most.
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
  const limit = known ? Math.min(box.width, box.height) / 2 : most;
  const radii = radiiOf(value).map((r) => Math.min(r, limit));
  const top = Math.max(...radii);
  if (top <= 0) return { width, height, radii: [0, 0, 0, 0] };
  const drawnTop = Math.min(most, Math.max(LEAST_DRAWN, drawnShare(top / limit) * most));
  return { width, height, radii: radii.map((r) => Math.round((r / top) * drawnTop * 10) / 10) };
}

/**
 * The box of a player's cover, its corners' reference (as both renderers
 * lay it out, bezel-render TextFurniture::layout and the demo's): a square
 * as tall as the player, at most 40% of its width and what the gap leaves.
 * @param {{width: number, height: number}} frame the player's
 * @param {number} gap between the cover and the text, px
 */
export function coverBox(frame, gap) {
  const room = Math.max(0, frame.width - Math.min(Math.max(0, gap), Math.max(0, frame.width)));
  const side = Math.max(0, Math.min(frame.height, frame.width * 0.4, room));
  return { width: side, height: side };
}
