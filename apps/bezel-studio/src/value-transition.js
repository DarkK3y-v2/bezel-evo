// Smooth and inertial value transitions, the
// UI's side: what an element's `valueTransition` says, the patch a control
// makes, and the demo's mirror of the runtime (crates/bezel-core
// domain::transition): cubic easing or damped motion, a frame every 50 ms at most while a
// value moves, none once it lands, and a snap when motion is reduced.

/** Duration of the transition of an object made in the Studio, ms. */
export const TRANSITION_DEFAULT_MS = 400;
/** The shortest and longest transition the backend keeps, ms. */
export const TRANSITION_BOUNDS = Object.freeze({ min: 50, max: 5000 });
/** The durations the inspector offers, ms. */
export const TRANSITION_RANGE = Object.freeze({ min: 100, max: 2000, step: 50 });
/** Shortest time between two frames drawn while a value moves, ms (20 fps). */
export const TRANSITION_STEP_MS = 50;
/** The modes, in the inspector's order. */
export const TRANSITION_MODES = Object.freeze(['none', 'smooth', 'inertia']);

/** The transition of an object made in the Studio. */
export const defaultTransition = () => ({ mode: 'smooth', durationMs: TRANSITION_DEFAULT_MS });

/** Whether `element` shows a value that can ease: a bar, a ring, a needle or a sensor text. */
export function easesValue(element) {
  const k = element?.kind;
  if (!k || element.isGroup || element.card) return false;
  if (k.type === 'text') return k.content?.type === 'sensor';
  return ['bar', 'ring', 'needle'].includes(k.type);
}

/**
 * The element's transition as the inspector shows it: `none` when absent
 * (a theme written before it), with the duration it keeps for when it is
 * turned on.
 * @returns {{mode: 'none'|'smooth'|'inertia', durationMs: number}}
 */
export function transitionOf(element) {
  const t = element?.valueTransition;
  const mode = t?.mode === 'inertia' || (t?.mode === 'smooth' && t.inertia) ? 'inertia' : t?.mode === 'smooth' ? 'smooth' : 'none';
  const ms = Number(t?.durationMs);
  return { mode, durationMs: Number.isFinite(ms) && ms > 0 ? ms : TRANSITION_DEFAULT_MS };
}

/**
 * The whole `valueTransition` after a change of `mode` or `durationMs`
 * (always both fields: a merge never leaves a smooth transition without
 * its duration). The duration is held within the inspector's range.
 */
export function transitionPatch(element, change) {
  const next = { ...transitionOf(element), ...change };
  const mode = TRANSITION_MODES.includes(next.mode) ? next.mode : 'none';
  const ms = Math.round(Number(next.durationMs));
  const durationMs = Number.isFinite(ms) ? Math.min(TRANSITION_RANGE.max, Math.max(TRANSITION_RANGE.min, ms)) : TRANSITION_DEFAULT_MS;
  return { mode: mode === 'inertia' ? 'smooth' : mode, durationMs,
    ...(mode === 'inertia' || element?.valueTransition?.inertia ? { inertia: mode === 'inertia' } : {}) };
}

/** How long a change lasts, ms, like the backend's; null when it jumps. */
export function transitionLength(element) {
  const t = element?.valueTransition;
  if (!['smooth', 'inertia'].includes(t?.mode) || !(t.durationMs > 0)) return null;
  return Math.min(TRANSITION_BOUNDS.max, Math.max(TRANSITION_BOUNDS.min, t.durationMs));
}

/** Ease-out cubic: the share done at `progress` (0..1); the end outside it. */
export function ease(progress) {
  if (Number.isNaN(progress)) return 1;
  const p = Math.min(1, Math.max(0, progress));
  return 1 - (1 - p) ** 3;
}

/** Critically damped motion, with position and velocity continuous on retarget. */
export function inertiaAt(from, to, velocity, elapsed, length) {
  if (!(length > 0) || elapsed >= length) return { value: to, velocity: 0 };
  const time = Math.max(0, elapsed), omega = 8 / length;
  const displacement = from - to, b = velocity + omega * displacement, decay = Math.exp(-omega * time);
  return { value: to + (displacement + b * time) * decay, velocity: (velocity - omega * b * time) * decay };
}

/** Milliseconds from the last sample (every `every` s) to `t` s, to the microsecond. */
const sinceSample = (t, every) => Math.round((t - Math.floor(t / every) * every) * 1e6) / 1e3;

/** `n` written as milliseconds ("400 ms"), as the card's transition writes it. */
export const formatMs = (n) => `${n} ms`;

/**
 * The demo's value of an element at `t` seconds. The demo samples every
 * `refresh` seconds: `fractionAt(s)` is the reading of the sample taken at
 * `s`. An element with a transition eases from the previous sample to the
 * last one for its length after it; without one (or with `motion` off) it
 * shows the last sample.
 * @param {(seconds: number) => number} fractionAt
 */
export function easedDemoValue(element, fractionAt, t, refresh, motion = true) {
  const every = refresh > 0 ? refresh : 1;
  const sampled = Math.floor(t / every) * every;
  const to = fractionAt(sampled);
  const length = motion ? transitionLength(element) : null;
  if (length === null) return to;
  if (element.valueTransition?.mode === 'inertia' || element.valueTransition?.inertia) {
    // A deterministic bounded history keeps the browser preview independent of
    // render frequency, including readings arriving before settling completes.
    const seconds = length / 1000;
    const count = Math.min(128, Math.ceil(seconds / every) * 4 + 4);
    let start = sampled - count * every;
    let from = fractionAt(start), target = from, velocity = 0;
    for (let n = count - 1; n >= 0; n--) {
      const at = sampled - n * every, current = fractionAt(at);
      if (!Number.isFinite(target) || !Number.isFinite(current)) { start = at; velocity = 0; from = current; target = current; continue; }
      if (current !== target) {
        const state = inertiaAt(from, target, velocity, at - start, seconds);
        from = state.value; velocity = state.velocity; target = current; start = at;
      }
    }
    return inertiaAt(from, target, velocity, t - start, seconds).value;
  }
  const since = sinceSample(t, every);
  if (since >= length) return to;
  const from = fractionAt(sampled - every);
  return from + (to - from) * ease(since / length);
}

/**
 * When the demo's next sample is due, ms from `t` seconds, for a preview
 * that eases a shown element (a transition starts there), like the
 * backend's; null without one or with reduced motion.
 * @param {(e: object) => boolean} shown whether the element is drawn
 */
export function demoSampleDue(elements, t, refresh, { motion = true, shown = () => true } = {}) {
  if (!motion || !elements.some((e) => easesValue(e) && shown(e) && transitionLength(e) !== null)) return null;
  const every = refresh > 0 ? refresh : 1;
  return Math.max(1, every * 1000 - sinceSample(t, every));
}

/**
 * When the demo's next frame is due for its moving values, ms from `t`
 * seconds: a step later (or when the last one lands, if sooner) while a
 * shown element eases; null when none moves or motion is reduced.
 * @param {(e: object) => boolean} shown whether the element is drawn
 */
export function demoTransitionDue(elements, t, refresh, { motion = true, shown = () => true } = {}) {
  if (!motion) return null;
  const since = sinceSample(t, refresh > 0 ? refresh : 1);
  const left = elements
    .filter((e) => easesValue(e) && shown(e))
    .map(transitionLength)
    .filter((length) => length !== null && since < length)
    .map((length) => length - since);
  if (!left.length) return null;
  return Math.max(1, Math.min(TRANSITION_STEP_MS, ...left));
}
