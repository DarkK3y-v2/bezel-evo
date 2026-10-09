// How long ago something happened, in the UI's language: "4 min fa",
// "12 s ago", "ontem". Pure: the clock is passed in. Used by the statusbar
// ("last saved …") and the sensor status ("last reading …").

const UNITS = Object.freeze([
  ['second', 60],
  ['minute', 60],
  ['hour', 24],
  ['day', Infinity],
]);

/**
 * The largest whole unit of the time between `fromMs` and `nowMs`.
 * A moment in the future counts as now.
 * @param {number} fromMs
 * @param {number} nowMs
 * @returns {{ value: number, unit: 'second'|'minute'|'hour'|'day' }}
 */
export function elapsed(fromMs, nowMs) {
  let value = Math.max(0, Math.floor((nowMs - fromMs) / 1000));
  for (const [unit, size] of UNITS) {
    if (value < size) return { value, unit };
    value = Math.floor(value / size);
  }
  return { value, unit: 'day' };
}

/**
 * `fromMs` as a time ago in `locale`, short style ("4 min ago").
 * @param {number} fromMs
 * @param {number} nowMs
 * @param {string} locale e.g. `it`, `pt-BR`, `en`
 * @returns {string}
 */
export function timeAgo(fromMs, nowMs, locale) {
  const { value, unit } = elapsed(fromMs, nowMs);
  return new Intl.RelativeTimeFormat(locale, { numeric: 'auto', style: 'short' }).format(-value, unit);
}
