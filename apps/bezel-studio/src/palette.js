// The colours of a theme for the colour picker
// (D-2026-10-16-studio-redesign-fidelity-29): the theme's own swatches
// (`palette: [{name?, color}]`, saved in the theme, copied when picked and
// never linked to what was painted with them), the colours it already
// uses, and a short list of recent ones. Pure, no DOM.
import { normalizeHex } from './color-math.js';

/** Most swatches a theme keeps (bezel-core's PALETTE_MAX). */
export const PALETTE_MAX = 64;
/** Longest swatch name, characters (bezel-core's SWATCH_NAME_MAX). */
export const SWATCH_NAME_MAX = 40;
/** Most colours in "Used in this theme". */
export const USED_MAX = 24;

const cleanName = (name) => {
  const trimmed = typeof name === 'string' ? name.trim().slice(0, SWATCH_NAME_MAX) : '';
  return trimmed || null;
};
const swatch = (color, name) => (name ? { name, color } : { color });

/** The theme's swatches, read leniently (bad entries left out). */
export function paletteOf(theme) {
  const list = Array.isArray(theme?.palette) ? theme.palette : [];
  return list.flatMap((s) => {
    const color = normalizeHex(s?.color);
    return color ? [swatch(color, cleanName(s.name))] : [];
  }).slice(0, PALETTE_MAX);
}

/** `palette` with `color` saved at its end (unchanged when full or not a colour). */
export function addSwatch(palette, color, name = null) {
  const hex = normalizeHex(color);
  if (!hex || palette.length >= PALETTE_MAX) return palette;
  return [...palette, swatch(hex, cleanName(name))];
}

/** `palette` with swatch `index` named `name` (blank: no name). */
export function renameSwatch(palette, index, name) {
  if (!palette[index]) return palette;
  return palette.map((s, i) => (i === index ? swatch(s.color, cleanName(name)) : s));
}

/** `palette` with swatch `from` moved to `to` (clamped). */
export function moveSwatch(palette, from, to) {
  const target = Math.max(0, Math.min(palette.length - 1, to));
  if (!palette[from] || target === from) return palette;
  const next = palette.slice();
  const [moved] = next.splice(from, 1);
  next.splice(target, 0, moved);
  return next;
}

/** `palette` without swatch `index`. */
export function removeSwatch(palette, index) {
  return palette[index] ? palette.filter((_, i) => i !== index) : palette;
}

// Keys whose strings are words, never colours.
const WORDS = new Set(['name', 'text', 'pattern', 'prefix', 'suffix', 'asset', 'key', 'label', 'title', 'source']);

/** Every theme colour string under `value`, in reading order. */
function* colorsIn(value, key = '') {
  if (typeof value === 'string') {
    if (!WORDS.has(key) && /^#[0-9a-f]{8}$/i.test(value)) yield value.toLowerCase();
  } else if (Array.isArray(value)) {
    for (const item of value) yield* colorsIn(item, key);
  } else if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) yield* colorsIn(v, k);
  }
}

/**
 * The colours the theme already uses (every element and the background),
 * most used first, then in reading order, at most `max`.
 */
export function usedColors(theme, max = USED_MAX) {
  const counts = new Map();
  for (const color of colorsIn([theme?.background ?? null, theme?.elements ?? []])) counts.set(color, (counts.get(color) ?? 0) + 1);
  return [...counts.entries()].map(([color, n], order) => ({ color, n, order }))
    .sort((a, b) => b.n - a.n || a.order - b.order)
    .slice(0, max)
    .map((c) => c.color);
}
