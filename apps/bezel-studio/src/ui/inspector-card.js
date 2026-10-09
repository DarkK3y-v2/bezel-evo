// The card's tabs in the inspector (artboards CardFaces, CardMotion,
// CardTriggers): its faces, how they change, and the rules that bring one
// forward. The inspector draws the rest (head, preview, Look, position).
import { el, icon } from './dom.js';
import { ICONS } from './icons.js';
import { checkField, numberField, rangeField, selectField, textField } from './fields.js';


/** The tabs of a card this module draws, in order. */
export const CARD_TABS = Object.freeze(['faces', 'motion', 'triggers']);

/** The faces of a card as chips: the one in view is pressed and says so; "+" adds one. */
function faceChips({ element: e, t, store }) {
  const c = e.card;
  const chips = c.faces.map((name, i) => {
    const active = i === c.activeFace;
    return el('button', {
      type: 'button', class: 'face-chip', dataset: { face: String(i) }, 'aria-pressed': String(active), 'aria-current': active ? 'true' : null,
      title: active ? t('layers.inViewHint') : null, onclick: () => !active && store.dispatch('cardFace', { id: e.id, face: i }),
    }, [
      el('span', { class: 'face-chip-name', text: name }),
      active && el('span', { class: 'face-badge', 'aria-hidden': 'true', text: t('layers.inView') }),
    ]);
  });
  const add = el('button', {
    type: 'button', class: 'face-chip face-add', 'aria-label': t('card.addFace'), title: t('card.addFace'), disabled: c.faces.length >= 16,
    onclick: () => store.dispatch('addCardFace', { id: e.id, name: t('card.faceName', { number: c.faces.length + 1 }) }),
  }, [icon(ICONS.plus, 18)]);
  return el('div', { class: 'face-chips', role: 'group', 'aria-label': t('card.activeFace') }, [...chips, add]);
}

/** A card's rule list: when an app runs, plays or comes forward, show a face (no "active now": the Studio cannot know). */
function triggerForm({ element: e, t, update, section }) {
  const c = e.card;
  const rules = c.triggers ?? [];
  const change = (i, patch) => update(e.id, { card: { triggers: rules.map((r, n) => n === i ? { ...r, ...patch } : r) } });
  const faceOptions = c.faces.map((name, n) => [String(n), name]);
  const rule = (r, i) => el('div', { class: 'trigger-rule', role: 'group', 'aria-label': t('trigger.rule', { value: i + 1 }) }, [
    el('div', { class: 'trigger-rule-head' }, [
      el('h4', { text: t('trigger.rule', { value: i + 1 }) }),
      el('button', { type: 'button', class: 'icon-button danger', 'aria-label': t('trigger.remove'), title: t('trigger.remove'), onclick: () => update(e.id, { card: { triggers: rules.filter((_, n) => n !== i) } }) }, [icon(ICONS.trash, 16)]),
    ]),
    selectField(t('trigger.condition'), r.source, ['process', 'processClosed', 'foreground', 'mediaPlaying'].map(v => [v, t(`trigger.${v}`)]), source => change(i, { source, app: r.app || (source === 'mediaPlaying' ? '' : 'Spotify') })),
    textField(t('trigger.app'), r.app, app => { if (app.trim() || r.source === 'mediaPlaying') change(i, { app: app.slice(0, 160) }); }),
    selectField(t('trigger.face'), String(r.face), faceOptions, face => change(i, { face: Number(face) })),
    el('div', { class: 'field-row' }, [
      numberField(t('trigger.priority'), r.priority ?? 0, priority => change(i, { priority: Math.max(0, Math.min(100, Math.round(priority))) }), { min: 0, max: 100 }),
      numberField(t('trigger.return'), r.returnSeconds ?? 0, returnSeconds => change(i, { returnSeconds: Math.max(0, Math.min(300, Math.round(returnSeconds))) }), { min: 0, max: 300 }),
    ]),
    selectField(t('trigger.returnFace'), r.returnFace == null ? 'previous' : String(r.returnFace), [['previous', t('trigger.previous')], ...faceOptions], v => change(i, { returnFace: v === 'previous' ? null : Number(v) })),
  ]);
  const add = () => update(e.id, { card: { triggers: [...rules, { source: 'mediaPlaying', app: 'Spotify', face: c.activeFace, priority: 0, returnSeconds: 3 }] } });
  return [
    section('triggers', t('trigger.title'), [
      el('p', { class: 'hint', text: t('trigger.help') }),
      ...rules.map(rule),
      el('button', { type: 'button', class: 'text-button trigger-add', disabled: rules.length >= 32 || c.faces.length < 2, onclick: add }, [icon(ICONS.plus, 16), t('trigger.add')]),
    ]),
  ];
}

/** How a card's faces change: timed rotation and the transition, with a try on the next face. */
function motionForm({ element: e, t, store, update, section }) {
  const c = e.card;
  const transition = c.transition && c.transition.effect !== 'none' ? c.transition : null;
  const effect = value => update(e.id, { card: { transition: { effect: value, direction: c.transition?.direction ?? 'left', durationMs: c.transition?.durationMs ?? 650, includeBase: c.transition?.includeBase ?? true } } });
  return [
    section('rotation', t('card.rotation'), [
      checkField(t('card.autoRotate'), c.rotationSeconds != null, enabled => update(e.id, { card: { rotationSeconds: enabled ? 10 : null } })),
      c.rotationSeconds != null && numberField(t('card.rotationSeconds'), c.rotationSeconds, value => update(e.id, { card: { rotationSeconds: Math.max(5, Math.min(3600, Math.round(value))) } }), { min: 5, max: 3600, step: 1 }),
      c.rotationSeconds != null && el('p', { class: 'hint', text: t('card.rotationHelp') }),
    ]),
    section('animation', t('card.animation'), [
      selectField(t('card.effect'), c.transition?.effect ?? 'none', ['none', 'fade', 'slide', 'flip'].map(value => [value, t(`card.effect.${value}`)]), effect),
      transition && rangeField(t('card.duration'), transition.durationMs, durationMs => update(e.id, { card: { transition: { durationMs } } }), { min: 150, max: 1500, step: 50, format: value => `${value} ms` }),
      transition && selectField(t('card.direction'), transition.direction, ['left', 'right', 'up', 'down'].map(value => [value, t(`card.direction.${value}`)]), direction => update(e.id, { card: { transition: { direction } } })),
      transition && checkField(t('card.includeBase'), transition.includeBase, includeBase => update(e.id, { card: { transition: { includeBase } } })),
      el('button', { type: 'button', class: 'text-button play-button', disabled: c.faces.length < 2, onclick: () => store.dispatch('cardFace', { id: e.id, face: (c.activeFace + 1) % c.faces.length }) }, [icon(ICONS.play, 16), t('card.animateNext')]),
      el('p', { class: 'hint', text: t('card.animationHelp') }),
    ]),
  ];
}

/** The Faces tab: the faces as chips and the face being edited. */
function facesForm(ctx) {
  const { element: e, t, store, update, section } = ctx;
  const c = e.card;
  const command = (name, args = {}) => () => store.dispatch(name, { id: e.id, ...args });
  const tool = (key, paths, onclick, disabled, extra = '') => el('button', { type: 'button', class: `icon-button ${extra}`.trim(), 'aria-label': t(key), title: t(key), disabled, onclick }, [icon(paths, 16)]);
  return [
    section('faces', t('card.faces'), [faceChips(ctx), el('p', { class: 'hint', text: t('card.facesHint') })]),
    el('div', { class: 'face-editor' }, [
      textField(t('card.faceTitle'), c.faces[c.activeFace], name => {
        if (!name.trim()) return;
        const names = [...c.faces]; names[c.activeFace] = name.trim().slice(0, 32);
        update(e.id, { card: { faces: names } });
      }),
      el('div', { class: 'face-tools' }, [
        tool('card.previous', ICONS.chevronLeft, command('reorderCardFace', { direction: -1 }), c.activeFace === 0),
        tool('card.next', ICONS.chevronRight, command('reorderCardFace', { direction: 1 }), c.activeFace === c.faces.length - 1),
        el('button', { type: 'button', class: 'text-button', disabled: c.faces.length >= 16, onclick: command('duplicateCardFace') }, [icon(ICONS.copy, 16), t('card.duplicateFace')]),
        tool('card.removeFace', ICONS.trash, command('removeCardFace'), c.faces.length <= 1, 'danger'),
      ]),
    ]),
    el('p', { class: 'hint', text: t('card.help') }),
  ];
}

/**
 * The nodes of one of a card's tabs.
 * @param {'faces'|'motion'|'triggers'} tab
 * @param {{element: object, t: (k: string, p?: object) => string, store: object, update: (id: string, patch: object) => void, section: (key: string, label: string, nodes: unknown[]) => HTMLElement|null}} ctx
 *   the card, the translator, the store, one-step update and the inspector's titled section
 */
export function renderCardPanel(tab, ctx) {
  if (tab === 'faces') return facesForm(ctx);
  if (tab === 'motion') return motionForm(ctx);
  if (tab === 'triggers') return triggerForm(ctx);
  return [];
}
