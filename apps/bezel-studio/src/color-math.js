// Colour maths of the colour picker (D-2026-10-16-studio-redesign-fidelity-29):
// the theme's `#rrggbbaa`, the picker's hue/saturation/value and opacity,
// and what a user types in its hex field. Pure, no DOM.

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const byte = (v) => clamp(Math.round(v), 0, 255);
const hex2 = (v) => byte(v).toString(16).padStart(2, '0');

/**
 * Reads `#rgb`, `#rgba`, `#rrggbb` or `#rrggbbaa` (the `#` optional, any
 * case, spaces around ignored) as bytes; `null` for anything else.
 * @returns {{r: number, g: number, b: number, a: number}|null}
 */
export function parseHex(text) {
  if (typeof text !== 'string') return null;
  const raw = text.trim().replace(/^#/, '');
  if (!/^(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(raw)) return null;
  const full = raw.length <= 4 ? [...raw].map((c) => c + c).join('') : raw;
  const at = (i) => parseInt(full.slice(i, i + 2), 16);
  return { r: at(0), g: at(2), b: at(4), a: full.length === 8 ? at(6) : 255 };
}

/** `{r, g, b, a}` (bytes; `a` 255 when absent) as the theme's `#rrggbbaa`. */
export const toHex = ({ r, g, b, a = 255 }) => `#${hex2(r)}${hex2(g)}${hex2(b)}${hex2(a)}`;

/** The theme colour `hex`, read leniently: white when it is not one. */
export const colorOf = (hex) => parseHex(hex) ?? { r: 255, g: 255, b: 255, a: 255 };

/** `#rrggbbaa` normalised (lower case, 8 digits), `null` when not a colour. */
export function normalizeHex(text) {
  const c = parseHex(text);
  return c ? toHex(c) : null;
}

/** Splits `#rrggbbaa` into `#rrggbb` and an alpha percentage. */
export function splitColor(hex) {
  const { r, g, b, a } = colorOf(hex);
  return { rgb: `#${hex2(r)}${hex2(g)}${hex2(b)}`, alpha: Math.round((a / 255) * 100) };
}

/** Joins `#rrggbb` and an alpha percentage into `#rrggbbaa`. */
export function joinColor(rgb, alphaPercent) {
  const { r, g, b } = colorOf(rgb);
  return toHex({ r, g, b, a: (clamp(alphaPercent, 0, 100) / 100) * 255 });
}

/**
 * RGB bytes as hue (0..360), saturation and value (0..1). A grey has hue
 * 0 and saturation 0.
 */
export function rgbToHsv({ r, g, b }) {
  const [rr, gg, bb] = [r / 255, g / 255, b / 255];
  const max = Math.max(rr, gg, bb), min = Math.min(rr, gg, bb), d = max - min;
  let h = 0;
  if (d > 0) {
    if (max === rr) h = ((gg - bb) / d) % 6;
    else if (max === gg) h = (bb - rr) / d + 2;
    else h = (rr - gg) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return { h, s: max === 0 ? 0 : d / max, v: max };
}

/** Hue (any number of degrees), saturation and value (clamped 0..1) as RGB bytes. */
export function hsvToRgb({ h, s, v }) {
  const hh = ((h % 360) + 360) % 360 / 60;
  const ss = clamp(s, 0, 1), vv = clamp(v, 0, 1);
  const c = vv * ss, x = c * (1 - Math.abs((hh % 2) - 1)), m = vv - c;
  const [r, g, b] = hh < 1 ? [c, x, 0] : hh < 2 ? [x, c, 0] : hh < 3 ? [0, c, x] : hh < 4 ? [0, x, c] : hh < 5 ? [x, 0, c] : [c, 0, x];
  return { r: byte((r + m) * 255), g: byte((g + m) * 255), b: byte((b + m) * 255) };
}

/**
 * The picker's state of `hex`: hue, saturation, value and opacity (0..1).
 * `hue` is kept when the colour has none (a grey, black): dragging the
 * value down to black and back keeps the hue the user chose.
 * @returns {{h: number, s: number, v: number, a: number}}
 */
export function hsvaOf(hex, hue = 0) {
  const c = colorOf(hex);
  const hsv = rgbToHsv(c);
  return { h: hsv.s === 0 || hsv.v === 0 ? hue : hsv.h, s: hsv.s, v: hsv.v, a: c.a / 255 };
}

/** The `#rrggbbaa` of the picker's state. */
export const hexOfHsva = ({ h, s, v, a }) => toHex({ ...hsvToRgb({ h, s, v }), a: clamp(a, 0, 1) * 255 });

/**
 * One keyboard step on a picker control: `axis` is `s`, `v`, `h` or `a`,
 * `delta` in steps (1 %, or 1° of hue; Shift gives 10). Clamped; the hue
 * wraps around.
 */
export function stepHsva(hsva, axis, delta) {
  if (axis === 'h') return { ...hsva, h: (((hsva.h + delta) % 360) + 360) % 360 };
  return { ...hsva, [axis]: clamp(Math.round(hsva[axis] * 100 + delta) / 100, 0, 1) };
}

/** Opacity as a whole percentage. */
export const alphaPercent = (hex) => Math.round((colorOf(hex).a / 255) * 100);

/** `hex` with its opacity set to `percent` (clamped 0..100). */
export const withAlphaPercent = (hex, percent) => toHex({ ...colorOf(hex), a: (clamp(Number(percent) || 0, 0, 100) / 100) * 255 });

/**
 * What the hex field means: a colour typed with its own opacity
 * (`#rrggbbaa`, `#rgba`) keeps it, one without takes `alpha` (0..255, the
 * colour's current opacity); `null` when it is not a colour.
 */
export function readHexInput(text, alpha = 255) {
  const raw = typeof text === 'string' ? text.trim().replace(/^#/, '') : '';
  const c = parseHex(raw);
  if (!c) return null;
  return toHex(raw.length === 8 || raw.length === 4 ? c : { ...c, a: alpha });
}

/** The 6-digit `#rrggbb` shown in the hex field. */
export const rgbText = (hex) => splitColor(hex).rgb;
