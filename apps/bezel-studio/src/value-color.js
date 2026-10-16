import { boundKey, textStyle } from './editor/widgets.js';

export const MAX_COLOR_THRESHOLDS = 32;

export function supportsValueColor(e) {
  if (!e || e.isGroup || e.card) return false;
  const k = e.kind;
  if (k.type === 'text') return ['static', 'sensor', 'spectrum'].includes(k.content.type);
  if (k.type === 'shape') return !k.videoWindow;
  if (k.type === 'image') return k.asset.toLowerCase().endsWith('.svg');
  return ['ring', 'bar', 'needle', 'graph'].includes(k.type);
}

/** Inclusive lower bounds; highest reached wins, the last row breaks ties. */
export function colorAt(rule, value) {
  if (!Number.isFinite(value)) return rule.base;
  let reached = -Infinity, result = rule.base;
  for (const threshold of rule.thresholds) {
    if (Number.isFinite(threshold.value) && value >= threshold.value && threshold.value >= reached) {
      reached = threshold.value; result = threshold.color;
    }
  }
  return result;
}

export function defaultValueColor(e, sensor, iconColor) {
  const k = e.kind;
  const paint = ['graph', 'needle'].includes(k.type) ? k.color : k.style?.paint ?? k.fill;
  const base = iconColor ?? (typeof paint === 'string' ? paint : paint?.stops?.[0]?.[1] ?? paint?.start) ?? textStyle(1).paint;
  return { ...(boundKey(e) || !sensor ? {} : { sensor }), base, thresholds: [] };
}

export function addColorThreshold(rule) {
  if (rule.thresholds.length >= MAX_COLOR_THRESHOLDS) return rule;
  const last = rule.thresholds.at(-1);
  return { ...rule, thresholds: [...rule.thresholds, { value: last ? last.value + 10 : 0, color: last?.color ?? rule.base }] };
}

/** Demo value uses the same fraction as its drawn gauge/text. */
export function demoColorValue(e, fraction, reading) {
  if (boundKey(e)) {
    if (!Number.isFinite(reading(boundKey(e)))) return null;
    const binding = e.kind.binding;
    return binding ? binding.min + fraction * (binding.max - binding.min) : fraction * 100;
  }
  return reading(e.colorByValue?.sensor);
}

/** Resolve only the supported paint; tracks and outlines keep their paint. */
export function withValueColor(e, value) {
  if (!e.colorByValue || !supportsValueColor(e)) return e;
  const color = colorAt(e.colorByValue, value), k = e.kind;
  let patch;
  if (k.type === 'text') patch = { style: { ...k.style, paint: color } };
  else if (['shape', 'ring', 'bar'].includes(k.type)) patch = { fill: color };
  else patch = { color };
  return { ...e, kind: { ...k, ...patch } };
}
