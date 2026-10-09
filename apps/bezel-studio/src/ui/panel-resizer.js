// The separators between the side panels and the stage
// (D-2026-10-09-studio-redesign-fidelity-7): drag one, or focus it and use
// the arrow keys (Shift for bigger steps), Home and End; a double click
// gives the panel its starting width. The widths live in the workspace's
// --library-w and --inspector-w and are remembered (panel-sizes.js).
import { PANELS, clampWidth, fitWidths, initialWidths, readWidths, widthAfterDrag, widthAfterKey, writeWidths } from '../panel-sizes.js';

/** The rail's width, outside the library panel's. */
const RAIL = 64;

/**
 * @param {{ workspace: HTMLElement, storage: Storage|null }} deps
 * @returns {{ widths: () => {library: number, inspector: number} }}
 */
export function wirePanelResizers({ workspace, storage }) {
  let widths = readWidths(storage);
  const separators = [...workspace.querySelectorAll('.panel-resizer[data-panel]')];

  /** Shows `widths` as fitted to the window, on the grid and on each separator. */
  function apply() {
    const shown = fitWidths(widths, workspace.clientWidth - RAIL);
    workspace.style.setProperty('--library-w', `${shown.library}px`);
    workspace.style.setProperty('--inspector-w', `${shown.inspector}px`);
    for (const separator of separators) {
      const { min, max } = PANELS[separator.dataset.panel];
      separator.setAttribute('aria-valuemin', String(min));
      separator.setAttribute('aria-valuemax', String(max));
      separator.setAttribute('aria-valuenow', String(shown[separator.dataset.panel]));
    }
  }

  function set(panel, width, { remember = true } = {}) {
    widths = { ...widths, [panel]: clampWidth(panel, width) };
    apply();
    if (remember) writeWidths(storage, widths);
  }

  for (const separator of separators) {
    const panel = separator.dataset.panel;
    separator.addEventListener('keydown', (evt) => {
      const next = widthAfterKey(panel, widths[panel], evt.key, evt.shiftKey);
      if (next === null) return;
      evt.preventDefault();
      set(panel, next);
    });
    separator.addEventListener('dblclick', () => set(panel, initialWidths()[panel]));
    separator.addEventListener('pointerdown', (evt) => {
      if (evt.button !== 0) return;
      evt.preventDefault();
      separator.setPointerCapture(evt.pointerId);
      separator.focus({ preventScroll: true });
      const start = { x: evt.clientX, width: widths[panel] };
      separator.classList.add('dragging');
      document.body.classList.add('resizing');
      const drag = new AbortController();
      const move = (e) => set(panel, widthAfterDrag(panel, start.width, e.clientX - start.x), { remember: false });
      const end = () => {
        drag.abort();
        separator.classList.remove('dragging');
        document.body.classList.remove('resizing');
        writeWidths(storage, widths);
      };
      separator.addEventListener('pointermove', move, { signal: drag.signal });
      separator.addEventListener('pointerup', end, { signal: drag.signal });
      separator.addEventListener('pointercancel', end, { signal: drag.signal });
    });
  }
  window.addEventListener('resize', apply);
  apply();
  return { widths: () => ({ ...widths }) };
}
