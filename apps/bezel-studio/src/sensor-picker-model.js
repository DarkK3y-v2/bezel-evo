// Shared catalog search for every sensor chooser. Never changes the catalog.
import { matchesQuery } from './library-model.js';
import { probeOf, readingState } from './sensor-probes.js';

export const SENSOR_CATEGORY_ICONS = Object.freeze({ cpu: 'chip', gpu: 'monitor', memory: 'chip', board: 'chip', network: 'download', disk: 'sdCard' });
const CATEGORIES = ['cpu', 'gpu', 'memory', 'disk', 'network', 'board', 'system'];

export function sensorChoices(catalog, query, { numeric = false, categoryLabel = c => c, probeLabel = p => p } = {}) {
  const groups = new Map();
  for (const sensor of catalog) {
    if (numeric && sensor.quantity === 'text') continue;
    const probe = probeOf(sensor, catalog);
    if (!matchesQuery(query, sensor.label, sensor.key, categoryLabel(sensor.category), probeLabel(probe), sensor.quantity)) continue;
    if (!groups.has(sensor.category)) groups.set(sensor.category, []);
    groups.get(sensor.category).push({ ...sensor, probe });
  }
  const rank = c => CATEGORIES.includes(c) ? CATEGORIES.indexOf(c) : CATEGORIES.length;
  return [...groups].sort(([a], [b]) => rank(a) - rank(b) || a.localeCompare(b));
}

export function sensorChoiceReading(sensor, readings) {
  return { state: readingState(sensor, readings), value: readings?.[sensor.key]?.display ?? '—', reason: readings?.[sensor.key]?.unavailable ?? '' };
}

/** Native units of the reference value, without scaling the stored number. */
export const sensorNativeUnit = quantity => ({ percent: '%', rpm: 'RPM', celsius: '°C', megahertz: 'MHz', watts: 'W', volts: 'V', amperes: 'A', bytes: 'B', bytesPerSecond: 'B/s', seconds: 's', milliseconds: 'ms' })[quantity] ?? '';
