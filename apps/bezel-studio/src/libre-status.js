/** Physical Libre hardware id, or the provider's category fallback. */
const hardwareGroup = (sensor) => sensor.key.startsWith('lhm.')
  ? sensor.key.split('.').slice(0, -2).join('.')
  : sensor.category;

/** Reading health, grouped by hardware so one healthy CPU cannot hide a failed PSU.
 * Optional sensors may be missing; a hardware group needs one physical reading.
 * Corsair's composite Total Output can report zero when every rail is missing.
 * `hardware` lists every group, in catalog order, with its category and
 * whether it reads; `failed` names the ones that do not.
 */
export function libreStatus(catalog, readings) {
  const sensors = catalog.filter((s) => s.source.startsWith('LibreHardwareMonitor'));
  if (!sensors.length) return null;
  const groups = new Map();
  for (const sensor of sensors) {
    const group = hardwareGroup(sensor);
    if (!groups.has(group)) groups.set(group, []);
    // The PSU's physical voltage/current/temperature readings establish health,
    // rather than a synthetic power total that can disguise missing USB replies.
    if (sensor.key.startsWith('lhm.psu.corsair.') && sensor.quantity === 'watts') continue;
    groups.get(group).push(sensor);
  }
  const hardware = [...groups].map(([group, entries]) => ({
    id: group,
    name: entries[0]?.label ?? group,
    category: entries[0]?.category ?? null,
    ok: entries.some((s) => readable(readings?.[s.key])),
  }));
  const failed = hardware.filter((h) => !h.ok).map((h) => h.name);
  return { state: !failed.length ? 'ok' : failed.length === groups.size ? 'error' : 'partial', failed, hardware };
}

/** Whether a reading holds a value now. */
const readable = (reading) => Boolean(reading) && !reading.unavailable && Number.isFinite(reading.value);

/**
 * What the statusbar's sensors chip says (artboard SensorStatus): green with
 * the last sample's time, amber with how many hardware groups do not read,
 * red when nothing reads (the sample failed, or Libre reads nothing) and
 * blue while the Libre reader restarts. `quickRestart` asks for the restart
 * beside the chip: only when Libre is the reader that stopped
 * (D-2026-10-09-studio-redesign-10).
 * @param {{health: {state: string, failed: string[]}|null, error?: unknown, restarting?: boolean, sampleMillis?: number}} sample
 * @returns {{state: 'ok'|'partial'|'error'|'restarting', key: string, params: object, quickRestart: boolean}}
 */
export function sensorChip({ health, error = null, restarting = false, sampleMillis = 0 }) {
  if (restarting) return { state: 'restarting', key: 'sensorChip.restarting', params: {}, quickRestart: false };
  if (error || health?.state === 'error') return { state: 'error', key: 'sensorChip.stopped', params: {}, quickRestart: Boolean(health) };
  if (health?.state === 'partial') {
    const count = health.failed.length;
    return { state: 'partial', key: count === 1 ? 'sensorChip.missingOne' : 'sensorChip.missingMany', params: { count }, quickRestart: false };
  }
  return { state: 'ok', key: 'sensorChip.ok', params: { ms: Math.round(sampleMillis ?? 0) }, quickRestart: false };
}

/** The quantities that best say a hardware is read, in order. */
const SHOWN_FIRST = Object.freeze(['celsius', 'percent', 'watts']);
const rank = (sensor) => (SHOWN_FIRST.includes(sensor.quantity) ? SHOWN_FIRST.indexOf(sensor.quantity) : SHOWN_FIRST.length);

/**
 * One row per hardware of the catalog, in catalog order (artboard
 * SensorStatus): the sources that read it, the value that best shows it is
 * read (a temperature, else a share, else a power, else any) and the Libre
 * groups of that category that do not read (`missing`).
 * @param {{key: string, category: string, source: string, quantity: string}[]} catalog
 * @param {Record<string, {value?: number, display?: string, unavailable?: string}>|null} readings
 * @param {{hardware?: {name: string, category: string|null, ok: boolean}[]}|null} health
 * @returns {{category: string, sources: string[], value: string|null, missing: string[], name?: string}[]}[]}
 */
export function hardwareRows(catalog, readings, health) {
  const rows = new Map();
  const firstHardware = new Map();
  for (const sensor of catalog) {
    const physical = sensor.source.startsWith('LibreHardwareMonitor');
    const group = physical ? hardwareGroup(sensor) : null;
    if (physical && !firstHardware.has(sensor.category)) firstHardware.set(sensor.category, group);
    // Other providers and the first Libre group share the category row.
    // A second physical device gets its own row, so a healthy board/PSU
    // never supplies the value or warning of another device.
    const extra = physical && firstHardware.get(sensor.category) !== group;
    const id = extra ? `${sensor.category}|${group}` : sensor.category;
    if (!rows.has(id)) rows.set(id, { category: sensor.category, sources: [], sensors: [], ...(extra ? { name: sensor.label ?? group } : {}) });
    const row = rows.get(id);
    if (!row.sources.includes(sensor.source)) row.sources.push(sensor.source);
    row.sensors.push(sensor);
  }
  const failed = (health?.hardware ?? []).filter((h) => !h.ok);
  return [...rows.values()].map(({ category, sources, sensors, name }) => {
    const best = sensors.filter((s) => readable(readings?.[s.key])).sort((a, b) => rank(a) - rank(b))[0];
    const reading = best ? readings[best.key] : null;
    return {
      category,
      sources,
      value: reading ? reading.display ?? String(reading.value) : null,
      missing: failed.filter((h) => h.category === category && sensors.some((s) => h.id ? hardwareGroup(s) === h.id : s.label === h.name || hardwareGroup(s) === h.name)).map((h) => h.name),
      ...(name ? { name } : {}),
    };
  });
}
