// Native visualization presets; all settings remain editable theme data.
export const VISUAL_STYLES = Object.freeze({ bar: ['standard', 'matrix'], ring: ['standard', 'pixel', 'dial'], graph: ['standard', 'rounded', 'mirrored'] });
export function visualization(style, previous = {}) {
  if (style === 'standard') return null;
  return { columns: 16, rows: 6, gap: 3, radius: 2, ticks: 31, marker: true, secondary: null, secondaryColor: '#e879a4ff', ...previous, style };
}
export function visualStyles(kind) { return VISUAL_STYLES[kind] ?? []; }
