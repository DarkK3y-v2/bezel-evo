import { sourceProgram } from './libre-status.js';

/** Stable probe identity shared by summaries, counts and library filters. */
export function probeOf(sensor) {
  const program = sourceProgram(sensor.source);
  return program === 'sysinfo' || program === 'Windows' ? 'Windows' : program ?? 'unassigned';
}

/** Not requested/read yet is different from a reading that explicitly failed. */
export function readingState(sensor, readings, error = false) {
  if (error) return 'unavailable';
  const reading = readings?.[sensor.key];
  if (!reading) return 'pending';
  if (reading.unavailable) return 'unavailable';
  return Number.isFinite(reading.value) || typeof reading.text === 'string'
    || (sensor.quantity === 'text' && typeof reading.display === 'string') ? 'available' : 'unavailable';
}

export function probeRows(catalog, readings, error = false) {
  const rows = new Map();
  for (const sensor of catalog) {
    const id = probeOf(sensor);
    if (!rows.has(id)) rows.set(id, { id, total: 0, available: 0, unavailable: 0, pending: 0 });
    const row = rows.get(id);
    row.total++;
    row[readingState(sensor, readings, error)]++;
  }
  return [...rows.values()].map(row => ({ ...row, state: row.unavailable
    ? row.available || row.pending ? 'partial' : 'error'
    : row.pending && !row.available ? 'pending' : 'ok' }));
}

export function probeTotals(rows) {
  return rows.reduce((total, row) => Object.fromEntries(Object.keys(total).map(key => [key, total[key] + row[key]])),
    { total: 0, available: 0, unavailable: 0, pending: 0 });
}

export function matchesSensor(sensor, { probe = 'all', status = 'all', readings = null, error = false } = {}) {
  return (probe === 'all' || probeOf(sensor) === probe)
    && (status === 'all' || readingState(sensor, readings, error) === status);
}
