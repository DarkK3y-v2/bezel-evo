// Canonical Card data shared by editor commands, playback and controls.
export function normalizeCard(card) {
  if (card.rotationSeconds == null) return card;
  const { rotationSeconds, ...rest } = card;
  return { ...rest, triggers: [...(card.triggers ?? []), {
    source: 'timer', intervalSeconds: rotationSeconds, nextFace: true,
    app: '', face: 0, priority: 0, returnSeconds: 0, returnFace: null,
  }] };
}

export function normalizeCardTheme(theme) {
  const elements = theme.elements.map(e => {
    if (!e.card) return e;
    const card = normalizeCard(e.card);
    return card === e.card ? e : { ...e, card };
  });
  return elements.every((e, i) => e === theme.elements[i]) ? theme : { ...theme, elements };
}

export function transitionFor(card, from, to) {
  return card.pairTransitions?.find(p => p.from === from && p.to === to)?.transition ?? card.transition ?? null;
}

export function withPairTransition(card, from, to, transition) {
  const pairs = (card.pairTransitions ?? []).filter(p => p.from !== from || p.to !== to);
  return transition == null ? pairs : [...pairs, { from, to, transition }];
}

/** Keep face identities when their indices move; discard deleted edges. */
export function remapPairs(card, map) {
  return (card.pairTransitions ?? []).filter(p => map(p.from) != null && map(p.to) != null)
    .map(p => ({ ...p, from: map(p.from), to: map(p.to) }));
}
