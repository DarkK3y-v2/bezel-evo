import { owners } from './cards.js';

export function canFitContent(theme, id) {
  const e = theme.elements.find(e => e.id === id);
  return !!e && e.kind.content?.type !== 'spectrum' && !e.isGroup && !e.card && ['text', 'image'].includes(e.kind.type) &&
    owners(theme, e).length > 0 && !owners(theme, e).some(e => e.locked);
}

/** One asynchronous measurement, one existing setFrame command (one Undo). */
export function createFitContent({ store, bridge, onError = () => {} }) {
  let request = 0;
  return async id => {
    const theme = store.getState().theme;
    if (!canFitContent(theme, id)) return;
    const token = ++request;
    try {
      const frame = await bridge.measureElement(theme, id);
      if (token !== request || store.getState().theme !== theme || !frame) return;
      if (!['x', 'y', 'width', 'height'].every(k => Number.isFinite(frame[k])) || frame.width <= 0 || frame.height <= 0) return;
      store.dispatch('setFrame', { id, frame });
    } catch (error) { onError(error); }
  };
}
