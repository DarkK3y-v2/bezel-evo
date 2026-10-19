// Sensor-driven visual rotation. Angles are presentation state, never edits.
export const supportsSensorMotion = e => !!e && !e.isGroup && !e.card
  && !(e.kind?.type === 'shape' && e.kind.videoWindow);

export function defaultSensorMotion(catalog, e) {
  const sensor = catalog.find(s => s.quantity === 'rpm') ?? catalog.find(s => s.quantity !== 'text');
  return { sensor: sensor?.key ?? 'gpu.fan', reference: sensor?.quantity === 'rpm' ? 3000 : 100,
    turnsPerSecond: 1, inertiaMs: 600, reverse: false };
}

export function stepRotor(previous, settings, at, value) {
  const signature = JSON.stringify(settings);
  const state = previous?.signature === signature && at >= previous.at ? { ...previous } : { signature, at, speed: 0, phase: 0 };
  const dt = Math.min(.25, Math.max(0, at - state.at));
  const ratio = Number.isFinite(value) && settings.reference > 0 ? Math.min(1, Math.max(0, value) / settings.reference) : 0;
  const target = ratio * settings.turnsPerSecond * (settings.reverse ? -1 : 1);
  const tau = settings.inertiaMs / 1000;
  let distance;
  if (tau > 0) {
    const decay = Math.exp(-dt / tau);
    distance = target * dt + (state.speed - target) * tau * (1 - decay);
    state.speed = target + (state.speed - target) * decay;
  } else { state.speed = target; distance = target * dt; }
  state.phase = ((state.phase + distance * 360) % 360 + 360) % 360;
  if (!target && Math.abs(state.speed) < .001) state.speed = 0;
  return { ...state, at, active: !!target || !!state.speed };
}

/** One animator per backend, with independent scenes and inspector state. */
export function createSensorMotion() {
  const states = new Map();
  return (theme, at, read, allowed = true, scene = 'preview') => {
    let active = false;
    const elements = theme.elements.map(e => {
      if (!allowed || !supportsSensorMotion(e) || !e.sensorMotion) return e;
      const key = `${scene}:${e.id}`;
      const state = stepRotor(states.get(key), e.sensorMotion, at, read(e.sensorMotion.sensor));
      states.set(key, state);
      active ||= state.active;
      return { ...e, rotation: (e.rotation ?? 0) + state.phase };
    });
    if (states.size > 4096) states.clear();
    return { theme: { ...theme, elements }, nextMs: active ? 20 : null };
  };
}
