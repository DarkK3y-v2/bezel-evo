// Spectrum configuration shared by the palette, inspector and explicit demo.
export const SPECTRUM_DEFAULTS = Object.freeze({ player: null, bands: 32, low: 60, high: 16000, motion: 'balanced', peaks: true, demo: false, thickness: 12, gap: 3, corners: Object.freeze([2,2,2,2]), centre: true });
export function spectrumOf(content) { return { ...SPECTRUM_DEFAULTS, ...content }; }
export function followedPlayer(theme, content) {
  const players = theme.elements.filter(e => e.kind.type === 'text' && e.kind.content.type === 'player');
  return content.player == null ? (players.length === 1 ? players[0] : null) : players.find(e => e.id === content.player) ?? null;
}
export function spectrumPatch(content, patch) {
  const c = { ...spectrumOf(content), ...patch };
  const clamp = (n, low, high, fallback) => Number.isFinite(n) ? Math.max(low, Math.min(high, n)) : fallback;
  c.bands = Math.round(clamp(c.bands, 8, 64, 32));
  c.low = clamp(c.low, 20, 23999, 60); c.high = clamp(c.high, c.low + 1, 24000, 16000);
  c.thickness = clamp(c.thickness, 1, 256, 12); c.gap = clamp(c.gap, 0, 128, 3);
  if (!['smooth','balanced','snappy'].includes(c.motion)) c.motion = 'balanced';
  c.corners = (Array.isArray(c.corners) && c.corners.length === 4 ? c.corners : SPECTRUM_DEFAULTS.corners).map(v => clamp(v, 0, 256, 2));
  return c;
}
export function demoSpectrum(content, seconds) {
  const c = spectrumOf(content);
  return Array.from({ length: c.bands }, (_, i) => 0.45 + 0.25 * Math.sin(seconds * 2 + i * 0.37));
}
