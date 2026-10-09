// The LibreHardwareMonitor dot in the statusbar (artboard SensorStatus): a
// button whose label says how the reader is doing; it opens a small dialog
// with each hardware group's state and "Restart", which restarts only the
// Libre reader (D-2026-10-09-studio-redesign-10). Escape or a click outside
// closes it; Escape gives the focus back to the dot. It also owns the
// sensors' statusbar chip (how long a sample took) and the restart itself.
import { el } from './dom.js';
import { libreStatus } from '../libre-status.js';

/**
 * @param {{
 *   t: (k: string, p?: object) => string,
 *   bridge: { restartLibre: () => Promise<unknown> },
 *   notify: (message: string) => void,
 *   fail: (error: unknown) => void,
 *   root: HTMLElement,
 *   onOpenSensors: () => void,
 * }} deps `root` is `#status-libre`, the dot's wrapper
 * @returns {{ update: (sample: {health: {state: string, failed: string[], hardware?: {name: string, ok: boolean}[]} | null, sampleMillis?: number, sampledAt?: number, readings?: object|null, catalog?: object[], error?: unknown}) => void, close: () => void }}
 */
export function createSensorStatus({ t, bridge, notify, fail, root, onOpenSensors }) {
  const wrap = root;
  const toggle = document.getElementById('status-libre-toggle');
  const popover = document.getElementById('libre-popover');
  const list = document.getElementById('libre-hardware');
  let last = { health: null, restarting: false };

  const isOpen = () => !popover.hidden;

  function place() {
    const box = toggle.getBoundingClientRect();
    const right = Math.max(8, window.innerWidth - box.right);
    popover.style.right = `${right}px`;
    popover.style.bottom = `${window.innerHeight - box.top + 8}px`;
  }

  function open() {
    render();
    popover.hidden = false;
    toggle.setAttribute('aria-expanded', 'true');
    place();
    const restart = document.getElementById('restart-libre');
    (restart.disabled ? popover.querySelector('.libre-popover-close') : restart).focus();
  }

  function close({ refocus = false } = {}) {
    if (!isOpen()) return;
    popover.hidden = true;
    toggle.setAttribute('aria-expanded', 'false');
    if (refocus) toggle.focus();
  }

  function row({ name, ok }) {
    return el('li', { class: 'libre-row', dataset: { state: ok ? 'ok' : 'missing' } }, [
      el('span', { class: 'status-dot', dataset: { state: ok ? 'ok' : 'partial' }, 'aria-hidden': 'true' }),
      el('span', { class: 'libre-row-name' }, [
        el('span', { text: name }),
        el('span', { class: 'libre-row-via', text: t('sensorStatus.via') }),
      ]),
      el('span', { class: 'libre-row-value', text: t(ok ? 'sensorStatus.reading' : 'sensorStatus.missing') }),
    ]);
  }

  function render() {
    const { health, restarting } = last;
    if (!health) return;
    const status = restarting ? 'restarting' : health.state;
    document.getElementById('libre-popover-dot').dataset.state = status;
    document.getElementById('libre-popover-title').textContent = t(`status.libre.${status}`);
    list.replaceChildren(...(health.hardware ?? []).map(row));
    const note = document.getElementById('libre-popover-note');
    note.hidden = !health.failed.length;
    note.textContent = health.failed.length ? t('sensorStatus.hint', { hardware: health.failed.join(', ') }) : '';
  }

  toggle.addEventListener('click', () => (isOpen() ? close() : open()));
  popover.querySelector('.libre-popover-close').addEventListener('click', () => close({ refocus: true }));
  document.getElementById('libre-open-sensors').addEventListener('click', () => {
    close();
    onOpenSensors();
  });
  // Escape closes it from inside, from the dot, or when the focus was lost
  // (the restart button turns disabled while the reader restarts).
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || !isOpen()) return;
    const at = document.activeElement;
    if (at && at !== document.body && !popover.contains(at) && at !== toggle) return;
    e.preventDefault();
    e.stopPropagation();
    close({ refocus: true });
  }, true);
  document.addEventListener('pointerdown', (e) => {
    if (isOpen() && !popover.contains(e.target) && !toggle.contains(e.target)) close();
  });
  window.addEventListener('resize', () => isOpen() && place());

  /** The popover's state: the last health, kept while the reader restarts. */
  function show(health, restarting) {
    // While the reader restarts there are no readings: the list keeps the last one.
    last = { health: restarting && health && last.health ? last.health : health, restarting };
    wrap.hidden = !health;
    if (!health) {
      close();
      return;
    }
    if (isOpen()) render();
  }

  // The dot, its label and title, and the restart button.
  let restarting = false;
  let catalog = [];
  function paint(health) {
    show(health, restarting);
    if (!health) return;
    const status = restarting ? 'restarting' : health.state;
    document.getElementById('status-libre-dot').dataset.state = status;
    document.getElementById('status-libre-label').textContent = t(`status.libre.${status}`);
    toggle.title = health.failed.length
      ? t('status.libreMissing', { hardware: health.failed.join(', ') })
      : t('status.libre.ok');
    document.getElementById('restart-libre').disabled = restarting;
  }

  document.getElementById('restart-libre').addEventListener('click', async () => {
    if (restarting) return;
    restarting = true;
    paint(libreStatus(catalog, null));
    try {
      await bridge.restartLibre();
      notify(t('status.libreRestarted'));
    } catch (e) {
      fail(e);
    } finally {
      restarting = false;
    }
  });

  return {
    /** A sample was read (or failed: `error`): the sensors chip and the dot follow it. */
    update({ health, sampleMillis, readings = null, catalog: list, error = null }) {
      catalog = list ?? catalog;
      document.getElementById('status-sensors').textContent = error
        ? t('status.sensorsError')
        : t('status.sensors', { ms: Math.round(sampleMillis) });
      paint(health === undefined ? libreStatus(catalog, error ? null : readings) : health);
    },
    close,
  };
}
