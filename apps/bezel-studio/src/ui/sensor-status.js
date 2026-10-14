// The sensors chip in the statusbar (artboard SensorStatus): one pill that
// says how the readings are doing in four states (green with the last
// sample's time, amber with how many hardware groups do not read, red when
// nothing reads, blue while the reader restarts). It opens a small dialog
// with a row per hardware (its value and its sources), when the last reading
// came and "Restart", which restarts only the LibreHardwareMonitor reader
// (D-2026-10-09-studio-redesign-10). When Libre stopped, the restart sits
// beside the chip too. Escape or a click outside closes the dialog; Escape
// gives the focus back to the chip.
import { el, icon } from './dom.js';
import { ICONS } from './icons.js';
import { pill } from './fields.js';
import { hardwareRows, libreStatus, sensorChip } from '../libre-status.js';
import { timeAgo } from '../relative-time.js';

/** The pill's tone of each state (`.pill[data-tone]`). */
const TONES = Object.freeze({ ok: 'ok', partial: 'warn', error: 'danger', restarting: 'info' });

/**
 * @param {{
 *   t: (k: string, p?: object) => string,
 *   bridge: { restartLibre: () => Promise<unknown> },
 *   notify: (message: string) => void,
 *   fail: (error: unknown) => void,
 *   root: HTMLElement,
 *   onOpenSensors: () => void,
 * }} deps `root` is `#status-libre`, the chip's wrapper
 * @returns {{ update: (sample: {health: {state: string, failed: string[], hardware?: {name: string, category: string|null, ok: boolean}[]} | null, sampleMillis?: number, sampledAt?: number, readings?: object|null, catalog?: object[], error?: unknown}) => void, close: () => void }}
 */
export function createSensorStatus({ t, bridge, notify, fail, root, onOpenSensors }) {
  const wrap = root;
  const toggle = document.getElementById('status-libre-toggle');
  const dot = document.getElementById('status-libre-dot');
  const label = document.getElementById('status-libre-label');
  const popover = document.getElementById('libre-popover');
  const list = document.getElementById('libre-hardware');
  const restartButton = document.getElementById('restart-libre');
  // The chip is the pill primitive; the old timing pill gives its place to it.
  toggle.className = 'pill sensor-chip';
  const spinner = icon(ICONS.spinner, 13);
  spinner.classList.add('sensor-spinner');
  toggle.insertBefore(spinner, label);
  const quick = pill('', { as: 'button', tone: 'danger', attrs: { id: 'status-libre-restart', hidden: true } });
  quick.classList.add('sensor-chip-restart');
  quick.append(icon(ICONS.refresh, 13));
  wrap.append(quick);
  popover.querySelector('.libre-popover-close').classList.add('quiet');
  const lastReading = el('span', { class: 'libre-popover-age mono' });
  popover.querySelector('.libre-popover-actions').prepend(lastReading);

  let restarting = false;
  // The last sample as it was read: what the chip and the dialog draw.
  let last = { health: null, error: null, sampleMillis: 0, sampledAt: null, readings: null, catalog: [] };

  const isOpen = () => !popover.hidden;
  const locale = () => document.documentElement.lang || 'en';

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
    const usable = !restartButton.disabled && !restartButton.hidden;
    (usable ? restartButton : popover.querySelector('.libre-popover-close')).focus();
  }

  function close({ refocus = false } = {}) {
    if (!isOpen()) return;
    popover.hidden = true;
    toggle.setAttribute('aria-expanded', 'false');
    if (refocus) toggle.focus();
  }

  /** One hardware: its dot, its name over its sources, and its value (or what is missing). */
  function row({ category, sources, value, missing, name }) {
    const ok = !missing.length;
    return el('li', { class: 'libre-row', dataset: { state: ok ? 'ok' : 'missing' } }, [
      el('span', { class: 'status-dot', dataset: { state: ok ? 'ok' : 'partial' }, 'aria-hidden': 'true' }),
      el('span', { class: 'libre-row-name' }, [
        el('span', { text: name ? `${t(`category.${category}`)} / ${name}` : t(`category.${category}`) }),
        el('span', { class: 'libre-row-via', text: sources.join(' · ') }),
      ]),
      el('span', { class: 'libre-row-value', text: ok ? value ?? '—' : t('sensorStatus.missing') }),
    ]);
  }

  /** The state shown: the chip's, with the health kept while the reader restarts. */
  const chip = () => sensorChip({ health: last.health, error: last.error, restarting, sampleMillis: last.sampleMillis });

  function popoverTitle(state) {
    if (state.state !== 'partial') return t(`sensorChip.title.${state.state}`);
    return t(state.params.count === 1 ? 'sensorChip.title.partialOne' : 'sensorChip.title.partialMany', state.params);
  }

  function render() {
    const state = chip();
    const { health } = last;
    document.getElementById('libre-popover-dot').dataset.state = state.state;
    document.getElementById('libre-popover-title').textContent = popoverTitle(state);
    list.setAttribute('aria-label', t('sensorChip.hardware'));
    list.replaceChildren(...hardwareRows(last.catalog, last.readings, health).map(row));
    const failed = health?.failed ?? [];
    const note = document.getElementById('libre-popover-note');
    note.hidden = !failed.length;
    note.textContent = failed.length ? t('sensorStatus.hint', { hardware: failed.join(', ') }) : '';
    lastReading.textContent = last.sampledAt === null ? '' : t('sensorChip.lastReading', { ago: timeAgo(last.sampledAt, Date.now(), locale()) });
    // Only the Libre reader restarts from here (D-2026-10-09-studio-redesign-10).
    restartButton.hidden = !health;
  }

  /** The chip, its dot, its title and the restarts. */
  function paint() {
    const state = chip();
    wrap.hidden = false;
    document.getElementById('status-sensors').textContent = '';
    toggle.dataset.tone = TONES[state.state];
    toggle.dataset.state = state.state;
    dot.dataset.state = state.state;
    label.textContent = t(state.key, state.params);
    const failed = last.health?.failed ?? [];
    toggle.title = failed.length ? t('status.libreMissing', { hardware: failed.join(', ') }) : label.textContent;
    restartButton.disabled = restarting;
    quick.hidden = !state.quickRestart;
    quick.title = t('status.libreRestart');
    quick.setAttribute('aria-label', t('status.libreRestart'));
    if (isOpen()) render();
  }

  async function restart() {
    if (restarting) return;
    restarting = true;
    // While the reader restarts there are no readings: the dialog keeps the last ones.
    paint();
    try {
      await bridge.restartLibre();
      notify(t('status.libreRestarted'));
    } catch (e) {
      fail(e);
    } finally {
      restarting = false;
      paint();
    }
  }

  toggle.addEventListener('click', () => (isOpen() ? close() : open()));
  popover.querySelector('.libre-popover-close').addEventListener('click', () => close({ refocus: true }));
  document.getElementById('libre-open-sensors').addEventListener('click', () => {
    close();
    onOpenSensors();
  });
  restartButton.addEventListener('click', restart);
  quick.addEventListener('click', restart);
  // Escape closes it from inside, from the chip, or when the focus was lost
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

  return {
    /** A sample was read (or failed: `error`): the chip and the dialog follow it. */
    update({ health, sampleMillis = 0, sampledAt = null, readings = null, catalog: entries, error = null }) {
      const catalog = entries ?? last.catalog;
      last = {
        health: health === undefined ? libreStatus(catalog, error ? null : readings) : health,
        error,
        sampleMillis,
        // A failed sample keeps when the last one came, and its readings.
        sampledAt: error ? last.sampledAt : sampledAt ?? Date.now(),
        readings: error ? last.readings : readings,
        catalog,
      };
      paint();
    },
    close,
  };
}
