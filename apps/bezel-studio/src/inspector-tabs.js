// The inspector's tabs and forms, without the DOM: which tabs an object has,
// which one is open for each kind of object (kept through edits, re-renders
// and Undo), where the arrow keys move, what the head says of an object, the
// graph's quick durations, the ring's arc drawing and the player's app chips.
import { widgetOf } from './editor/widgets.js';

/** Extra sampling is needed only while an activity editor is actually shown. */
export function shownSensorKeys(keys, { theme, selection }, visible = true, inspectorShown = true) {
  if (!visible) return [];
  const element = selection.length === 1 ? theme.elements.find(e => e.id === selection[0]) : null;
  const activity = inspectorShown && element && (widgetOf(element) === 'player' || element.card?.triggers?.length > 0);
  return [...new Set([...keys, ...(activity ? ['activity.processes', 'media.sessions'] : [])])].sort();
}

/** A card's tabs: its faces, how they change, what brings one forward, and how it looks. */
export const CARD_TABS = Object.freeze(['faces', 'motion', 'triggers', 'look']);

/** Every other object's tabs: what it shows and how it looks. */
export const OBJECT_TABS = Object.freeze(['data', 'look']);

/** The tabs of an object of `kind` (`card` or any widget name), in order. */
export function tabsOf(kind) {
  return kind === 'card' ? CARD_TABS : OBJECT_TABS;
}

/**
 * The tab open for each kind of object. A kind remembers the tab last chosen
 * for it; one never chosen, or no longer offered, opens the first offered.
 */
export function createTabMemory() {
  const chosen = new Map();
  return {
    /** The tab to open for `kind` among the `offered` ones (null when none is). */
    current(kind, offered) {
      const tab = chosen.get(kind);
      return offered.includes(tab) ? tab : offered[0] ?? null;
    },
    /** Remembers `tab` as the one open for `kind`. */
    choose(kind, tab) {
      chosen.set(kind, tab);
    },
  };
}

/**
 * The tab a key moves to from `current` (ARIA tabs pattern): ←/→ step and
 * wrap around, Home and End go to the ends. Null for any other key.
 */
export function tabAfterKey(tabs, current, key) {
  if (!tabs.length) return null;
  const at = Math.max(0, tabs.indexOf(current));
  if (key === 'ArrowRight') return tabs[(at + 1) % tabs.length];
  if (key === 'ArrowLeft') return tabs[(at - 1 + tabs.length) % tabs.length];
  if (key === 'Home') return tabs[0];
  if (key === 'End') return tabs[tabs.length - 1];
  return null;
}

/**
 * What the inspector's head says of `element`: its level among the theme's
 * objects (1 = the one at the back) out of how many, and the group or card
 * it belongs to, when it does.
 * @returns {{level: number, total: number, group: string|null}}
 */
export function layerFacts(theme, element) {
  const total = theme.elements.length;
  const level = theme.elements.findIndex((e) => e.id === element.id) + 1;
  const parentId = element.groupParent ?? element.cardMember?.parent ?? null;
  const parent = parentId === null ? null : theme.elements.find((e) => e.id === parentId);
  return { level, total, group: parent?.name ?? null };
}

/** The graph's quick durations, seconds (artboard GraphData). */
export const QUICK_DURATIONS = Object.freeze([30, 60, 300, 900, 3600]);

/** The fewest and most samples a graph keeps (the store's bounds). */
export const HISTORY_MIN = 2;
export const HISTORY_MAX = 3600;

/**
 * A duration as its largest whole unit: `{value, unit}` with `unit` one of
 * `s`, `min`, `h` (90 s stays `90 s`).
 */
export function durationParts(seconds) {
  if (seconds >= 3600 && seconds % 3600 === 0) return { value: seconds / 3600, unit: 'h' };
  if (seconds >= 60 && seconds % 60 === 0) return { value: seconds / 60, unit: 'min' };
  return { value: Math.round(seconds * 100) / 100, unit: 's' };
}

/**
 * The quick durations of a graph refreshed every `refreshSeconds` that
 * keeps `history` samples: how many samples each takes, whether that is
 * the graph's window now, and whether the graph can keep that many.
 * @returns {{seconds: number, samples: number, pressed: boolean, disabled: boolean}[]}
 */
export function quickDurations(refreshSeconds, history) {
  const refresh = refreshSeconds > 0 ? refreshSeconds : 1;
  return QUICK_DURATIONS.map((seconds) => {
    const samples = Math.round(seconds / refresh);
    return { seconds, samples, pressed: samples === history, disabled: samples < HISTORY_MIN || samples > HISTORY_MAX };
  });
}

/**
 * The ring's arc drawn small (artboard Main, "Arco"): an SVG path on a
 * `size` square, angles as the renderer reads them (0° at twelve o'clock,
 * clockwise), and where it starts (the handle). A sweep of a whole turn or
 * more is drawn as a full circle.
 * @returns {{d: string, start: {x: number, y: number}, full: boolean}}
 */
export function arcDrawing(startAngle, sweep, clockwise = true, { size = 64, radius = 24 } = {}) {
  const c = size / 2;
  const point = (degrees) => {
    const a = ((degrees - 90) * Math.PI) / 180;
    return { x: round2(c + radius * Math.cos(a)), y: round2(c + radius * Math.sin(a)) };
  };
  const span = Math.min(Math.abs(Number(sweep) || 0), 360);
  const start = point(startAngle);
  if (span >= 360) {
    const opposite = point(startAngle + 180);
    return { d: `M${start.x} ${start.y}A${radius} ${radius} 0 1 1 ${opposite.x} ${opposite.y}A${radius} ${radius} 0 1 1 ${start.x} ${start.y}`, start, full: true };
  }
  const end = point(startAngle + (clockwise ? span : -span));
  const large = span > 180 ? 1 : 0;
  return { d: `M${start.x} ${start.y}A${radius} ${radius} 0 ${large} ${clockwise ? 1 : 0} ${end.x} ${end.y}`, start, full: false };
}

const round2 = (n) => Math.round(n * 100) / 100;

/** An application's name as people read it: no `.exe`, no folder. */
export const appName = (source) => String(source ?? '').split(/[\\/]/).pop().replace(/\.exe$/i, '').trim();

const sameApp = (a, b) => appName(a).toLowerCase() === appName(b).toLowerCase();

/**
 * The player's app chips (artboard PlayerData) from the last sample's
 * `activity`: one per application with a media session (playing ones
 * first, then by name), the one the player follows pressed. `custom` is
 * the source the player follows when no chip names it (typed by hand).
 * @param {{media?: {source: string, playing: boolean}[]}|null} activity
 * @param {string} source the player's `source` (empty: automatic)
 * @returns {{chips: {name: string, playing: boolean, pressed: boolean}[], custom: string|null}}
 */
export function appChips(activity, source = '') {
  const chips = [];
  for (const session of activity?.media ?? []) {
    const name = appName(session.source);
    if (!name) continue;
    const known = chips.find((c) => sameApp(c.name, name));
    if (known) known.playing ||= Boolean(session.playing);
    else chips.push({ name, playing: Boolean(session.playing), pressed: false });
  }
  chips.sort((a, b) => Number(b.playing) - Number(a.playing) || a.name.localeCompare(b.name));
  const wanted = String(source ?? '').trim();
  for (const chip of chips) chip.pressed = wanted !== '' && sameApp(chip.name, wanted);
  return { chips, custom: wanted !== '' && !chips.some((c) => c.pressed) ? wanted : null };
}
