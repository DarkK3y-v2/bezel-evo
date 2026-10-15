import { normalizeCard } from '../card-config.js';
import { triggerMatches } from '../card-rules.js';
// Demo playback mirrors the native runtime, outside the document/store.
export function createCardTimers() {
  const states = new Map();
  let last = 0;
  return {
    update(theme, now, enabled = true, activity = null) {
      if (!enabled || now < last) states.clear();
      last = now;
      let due = null;
      const valid = theme.elements.filter(e => enabled && e.visible !== false && e.card?.faces.length > 1 && (e.card.rotationSeconds != null || e.card.triggers?.length));
      const ids = new Set(valid.map(e => e.id));
      for (const id of states.keys()) if (!ids.has(id)) states.delete(id);
      for (const e of valid) {
        const card = normalizeCard(e.card), rules = card.triggers ?? [];
        const signature = JSON.stringify(card);
        const deadlines = () => rules.map(r => r.source === 'timer' && r.intervalSeconds >= 5 && r.intervalSeconds <= 3600 ? now + r.intervalSeconds * 1000 : null);
        let state = states.get(e.id);
        if (!state || state.signature !== signature) state = { signature, face: card.activeFace, base: card.activeFace, override: null, release: null, due: deadlines() };
        const winner = rules.map((r, i) => ({ r, i })).filter(({ r }) => r.face < card.faces.length && triggerMatches(r, activity))
          .sort((a, b) => (b.r.priority ?? 0) - (a.r.priority ?? 0) || a.i - b.i)[0]?.i;
        if (winner != null) {
          if (state.override == null) state.base = state.face;
          state.override = winner; state.release = null; state.face = rules[winner].face;
        } else if (state.override != null) {
          const r = rules[state.override];
          state.release ??= now + (r.returnSeconds ?? 0) * 1000;
          if (now >= state.release) {
            state.face = r.returnFace ?? state.base; state.override = null; state.release = null; state.due = deadlines();
          }
        } else {
          const timed = rules.map((r, i) => ({ r, i })).filter(({ i }) => state.due[i] != null && now >= state.due[i])
            .sort((a, b) => (b.r.priority ?? 0) - (a.r.priority ?? 0) || a.i - b.i)[0];
          if (timed) {
            state.face = timed.r.nextFace ? (state.face + 1) % card.faces.length : timed.r.face;
            state.due = state.due.map((d, i) => d != null && now >= d ? now + rules[i].intervalSeconds * 1000 : d);
          }
        }
        states.set(e.id, state);
        const next = state.override != null ? state.release : state.due.filter(d => d != null).sort((a,b) => a-b)[0];
        if (next != null) due = due == null ? next : Math.min(due, next);
      }
      const elements = theme.elements.map(e => {
        const face = states.get(e.id)?.face;
        return face == null || face === e.card?.activeFace ? e : { ...e, card: { ...e.card, activeFace: face } };
      });
      return { theme: elements.some((e, i) => e !== theme.elements[i]) ? { ...theme, elements } : theme, nextMs: due === null ? null : Math.max(0, due - now) };
    },
  };
}
