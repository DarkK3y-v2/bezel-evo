// Card content only: the inspector owns header, tabs, geometry and preview.
import { el, icon } from './dom.js';
import { ICONS } from './icons.js';
import { chipButton, dashedHint, fieldGrid, iconButton, listCard, prefixedField, rangeField, screenThumb, segmented, selectField, sentence as sentenceOfParts, switchRow, textField } from './fields.js';
import { widgetOf } from '../editor/widgets.js';
import { selectionRoots } from '../editor/cards.js';
import { MAX_RULES, ROTATION_MIN, ROTATION_MAX, TRIGGER_SOURCES, appSuggestions, clampPriority, clampReturn, commonReturn, moveRule, newRule, newTimedRule, timedParts, timedSeconds, sentenceOf, withApp, withReturn, withSource, dropIndex } from '../card-rules.js';

import { transitionFor, withPairTransition } from '../card-config.js';
import { CARD_TABS as ALL_CARD_TABS } from '../inspector-tabs.js';
export const CARD_TABS = Object.freeze(ALL_CARD_TABS.slice(0, -1));
const baseViews = new WeakMap();
const pairViews = new WeakMap();
const tool = (label, name, onclick, disabled = false, extra = '') => iconButton(label, ICONS[name], onclick, { size: 16, disabled, class: extra });

// Card content uses the same section contract as every inspector property.
function cardSection(ctx, key, label, nodes, total = null) {
  const node = ctx.section(key, label, nodes, { count: total });
  node.classList.add('card-section');
  return node;
}
const members = (ctx, face) => {
  const theme = ctx.store.getState().theme;
  return selectionRoots(theme, theme.elements.filter(e => e.cardMember?.parent === ctx.element.id && e.cardMember.face === face).map(e => e.id));
};

function facesForm(ctx) {
  const { element: e, t, store, update } = ctx, c = e.card;
  const theme = store.getState().theme;
  if (!baseViews.has(store)) baseViews.set(store, new Map());
  const views = baseViews.get(store);
  const base = views.get(e.id) === c.activeFace;
  if (!pairViews.has(store)) pairViews.set(store, new Map());
  const pairs = pairViews.get(store);
  const choose = (face) => {
    pairs.delete(e.id);
    views.delete(e.id);
    if (face === c.activeFace) store.select([e.id]);
    else store.dispatch('cardFace', { id: e.id, face });
  };
  const thumbs = [];
  const makeThumb = (face) => {
    const thumb = screenThumb(theme.canvas);
    thumb.title = t('cardInsp.layout');
    // An explicitly labelled layout diagram until the host supplies bridge.
    for (const item of [...members(ctx, null), ...(face === null ? [] : members(ctx, face))]) {
      const f = item.frame;
      thumb.append(el('span', { class: 'face-mark', title: item.name, style: { left: `${f.x / theme.canvas.width * 100}%`, top: `${f.y / theme.canvas.height * 100}%`, width: `${f.width / theme.canvas.width * 100}%`, height: `${f.height / theme.canvas.height * 100}%` } }));
    }
    thumbs.push({ thumb, face });
    return thumb;
  };
  const chips = c.faces.map((name, i) => {
    const thumb = makeThumb(i);
    const active = i === c.activeFace;
    return el('button', { type: 'button', class: 'face-chip', dataset: { face: String(i) }, 'aria-pressed': String(active), 'aria-current': active ? 'true' : null, 'aria-label': t('cardInsp.editFace', { name }), title: t('cardInsp.editFace', { name }), onclick: () => choose(i) }, [thumb, el('span', { class: 'face-chip-name', text: name }), active && el('span', { class: 'face-badge', 'aria-hidden': 'true', text: t('layers.inView') })]);
  });
  const baseButton = listCard({ icon: 'layers', title: t('cardInsp.base'), subtitle: t('cardInsp.sharedHint'),
    label: t('cardInsp.base'), pressed: base, onClick: () => { pairs.delete(e.id); views.set(e.id, c.activeFace); store.select([e.id]); } });
  baseButton.classList.add('shared-background');
  baseButton.setAttribute('aria-description', t('cardInsp.sharedHint'));
  baseButton.prepend(makeThumb(null));
  const pairNodes = [];
  for (let i = 0; i < chips.length; i++) {
    pairNodes.push(chips[i]);
    if (chips.length > 1) {
      const to = (i + 1) % chips.length, settings = transitionFor(c, i, to);
      const key = `${i}:${to}`, label = t('cardInsp.changeBetween', { from: c.faces[i], to: c.faces[to] });
      const button = chipButton(`${t(`card.effect.${settings?.effect ?? 'none'}`)}${settings?.effect && settings.effect !== 'none' ? ` ${settings.durationMs} ms` : ''}`, pairs.get(e.id) === key,
        () => { pairs.set(e.id, pairs.get(e.id) === key ? null : key); store.select([e.id]); },
        { class: 'chip face-transition', 'aria-label': label, title: label, 'aria-expanded': String(pairs.get(e.id) === key), 'aria-controls': `card-pair-${e.id}`, dataset: { pair: key } });
      button.prepend(icon(ICONS.arrowRight, 14));
      if (settings && ['slide','flip'].includes(settings.effect)) button.append(icon(ICONS[{ left: 'arrowLeft', right: 'arrowRight', up: 'up', down: 'down' }[settings.direction]], 14));
      pairNodes.push(button);
    }
  }
  const faces = el('div', { class: 'face-chips', role: 'group', 'aria-label': t('card.activeFace') }, [...pairNodes,
    el('button', { type: 'button', class: 'face-chip face-add', 'aria-label': t('card.addFace'), title: t('card.addFace'), disabled: c.faces.length >= 16, onclick: () => { pairs.delete(e.id); views.delete(e.id); store.dispatch('addCardFace', { id: e.id, name: t('card.faceName', { number: c.faces.length + 1 }) }); } }, [icon(ICONS.plus, 28)]),
  ]);
  const selectedPair = pairs.get(e.id)?.split(':').map(Number);
  let pairEditor = el('div', { id: `card-pair-${e.id}`, hidden: true });
  if (selectedPair && selectedPair.every(i => i < c.faces.length)) {
    const [from, to] = selectedPair, own = c.pairTransitions?.find(p => p.from === from && p.to === to);
    const set = patch => update(e.id, { card: { pairTransitions: withPairTransition(c, from, to, { ...(transitionFor(c, from, to) ?? {}), ...patch }) } });
    pairEditor = cardSection(ctx, 'pair-transition', t('cardInsp.changeBetween', { from: c.faces[from], to: c.faces[to] }), [
      chipButton(t('cardInsp.useGeneral'), !own, () => update(e.id, { card: { pairTransitions: withPairTransition(c, from, to, null) } }), { disabled: !own }),
      ...transitionControls(ctx, transitionFor(c, from, to), set, `pair-${from}-${to}`),
    ]);
    pairEditor.id = `card-pair-${e.id}`;
  }
  // The real renderer draws the card with each face, without changing the document.
  if (ctx.bridge) queueMicrotask(async () => {
    for (const { thumb, face } of thumbs) {
      if (!faces.isConnected) return;
      const isolated = { ...theme, elements: theme.elements.filter(item => face !== null || item.cardMember?.parent !== e.id || item.cardMember.face === null).map(item => item.id === e.id ? { ...item, card: { ...c, activeFace: face ?? c.activeFace } } : item) };
      try {
        const frame = await ctx.bridge.renderElement(isolated, e.id, { max: 128, motion: false });
        if (!faces.isConnected) return;
        const canvas = el('canvas', { width: frame.width, height: frame.height, class: 'face-render', 'aria-hidden': 'true', style: { left: `${e.frame.x / theme.canvas.width * 100}%`, top: `${e.frame.y / theme.canvas.height * 100}%`, width: `${e.frame.width / theme.canvas.width * 100}%`, height: `${e.frame.height / theme.canvas.height * 100}%` } });
        canvas.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(frame.pixels ?? frame.rgba), frame.width, frame.height), 0, 0);
        thumb.append(canvas);
        thumb.classList.add('rendered');
        thumb.title = face === null ? t('cardInsp.base') : c.faces[face];
      } catch { /* The real member layout remains visible if rendering fails. */ }
    }
  });
  const face = base ? null : c.activeFace;
  const objects = members(ctx, face);
  const name = base ? t('cardInsp.base') : c.faces[face];
  const command = (action, args = {}) => () => { pairs.delete(e.id); views.delete(e.id); store.dispatch(action, { id: e.id, ...args }); };
  const editor = base ? null : el('div', { class: 'face-editor' }, [
    textField(t('card.faceTitle'), name, value => {
      const clean = Array.from(value.trim()).slice(0, 32).join('');
      if (!clean) return;
      const names = [...c.faces]; names[face] = clean; update(e.id, { card: { faces: names } });
    }),
    el('div', { class: 'face-tools' }, [tool(t('card.previous'), 'chevronLeft', command('reorderCardFace', { direction: -1 }), face === 0), tool(t('card.next'), 'chevronRight', command('reorderCardFace', { direction: 1 }), face === c.faces.length - 1), el('button', { type: 'button', class: 'text-button', disabled: c.faces.length >= 16, onclick: command('duplicateCardFace') }, [icon(ICONS.copy, 16), t('card.duplicateFace')]), tool(t('card.removeFace'), 'trash', command('removeCardFace'), c.faces.length <= 1, 'danger')]),
  ]);
  const rows = objects.map(item => {
    const card = listCard({ icon: widgetOf(item), title: item.name, subtitle: t(`widget.${widgetOf(item)}`), label: t('cardInsp.selectObject', { name: item.name }), onClick: () => store.select([item.id]) });
    card.querySelector('.list-card-chevron').remove();
    const move = selectField(t('cardInsp.moveObject', { name: item.name }), face === null ? 'base' : String(face), [['base', t('cardInsp.base')], ...c.faces.map((n, i) => [String(i), n])], value => store.dispatch('attachCard', { ids: [item.id], parent: e.id, face: value === 'base' ? null : Number(value) }));
    move.querySelector('select').setAttribute('aria-label', t('cardInsp.moveObject', { name: item.name }));
    return el('div', { class: 'face-object' }, [card, move]);
  });
  return [cardSection(ctx, 'faces', t('card.tab.faces'), [baseButton, faces, el('p', { class: 'hint', text: t('cardInsp.editFaceHint') }), el('p', { class: 'hint face-layout-note', text: t('cardInsp.layoutHint') })], c.faces.length), pairEditor, editor,
    cardSection(ctx, 'objects', t('cardInsp.objectsIn', { face: name }), rows.length ? rows : [el('p', { class: 'hint', text: t('cardInsp.emptyFace') })], objects.length), dashedHint([t('cardInsp.dropHint')])];
}

const EFFECT_ART = { none: ['M3 5h7v14H3z', 'M14 5h7v14h-7z'], fade: ['M3 5h10v14H3z', 'M10 5h11v14H10z'], slide: ['M3 5h7v14H3z', 'M17 5h4v14h-4z', 'M11 12h5', 'M14 10l2 2-2 2'], flip: ['M7 5h10v14H7z', 'M3 9v6', 'M21 9v6', 'M10 3h4', 'M10 21h4'] };
function transitionControls(ctx, settings, set, scope) {
  const { element: e, t } = ctx;
  const transition = settings?.effect !== 'none' ? settings : null;
  const effects = el('div', { class: 'card-effects', role: 'radiogroup', 'aria-label': t('card.effect') }, Object.keys(EFFECT_ART).map(value => {
    const label = el('label', { class: 'card-effect', dataset: { checked: String((settings?.effect ?? 'none') === value) } });
    const input = el('input', { type: 'radio', name: `card-effect-${e.id}-${scope}`, checked: (settings?.effect ?? 'none') === value, 'aria-label': t(`card.effect.${value}`) });
    input.addEventListener('change', () => input.checked && set({ effect: value, direction: settings?.direction ?? 'left', durationMs: settings?.durationMs ?? 650, includeBase: settings?.includeBase ?? true }));
    const art = icon(EFFECT_ART[value], 44); art.classList.add('effect-art');
    label.append(input, art, el('span', { text: t(`card.effect.${value}`) })); return label;
  }));
  const directions = transition && segmented(t('common.direction'), transition.direction, ['left', 'right', 'up', 'down'].map(value => [value, t(`card.direction.${value}`)]), direction => set({ direction }), { bare: true });
  if (directions) Array.from(directions.children).forEach((button, i) => { button.setAttribute('aria-label', button.textContent); button.title = button.textContent; button.replaceChildren(icon(ICONS[['arrowLeft', 'arrowRight', 'up', 'down'][i]], 18)); });
  return [effects,
    transition && rangeField(t('card.duration'), transition.durationMs, durationMs => set({ durationMs }), { min: 150, max: 1500, step: 50, format: value => `${value} ms` }),
    transition && el('div', { class: 'card-scale' }, [el('span', { text: t('cardInsp.fast') }), el('span', { text: t('cardInsp.slow') })]), directions,
    transition && switchRow(t('cardInsp.animateShared'), transition.includeBase, includeBase => set({ includeBase })),
  ];
}
function motionForm(ctx) {
  const { element: e, t, store, update } = ctx;
  return [cardSection(ctx, 'animation', t('cardInsp.generalTransition'), [
    el('p', { class: 'hint', text: t('cardInsp.fallbackHint') }),
    ...transitionControls(ctx, e.card.transition, patch => update(e.id, { card: { transition: patch } }), 'general'),
    el('button', { type: 'button', class: 'text-button play-button', disabled: e.card.faces.length < 2, onclick: () => store.dispatch('cardFace', { id: e.id, face: (e.card.activeFace + 1) % e.card.faces.length }) }, [icon(ICONS.play, 16), t('card.animateNext')]),
    dashedHint([t('card.animationHelp')], { iconName: 'info' }),
  ])];
}

function triggerForm(ctx) {
  const { element: e, t, store, update } = ctx, c = e.card;
  const rules = c.triggers ?? [];
  const activity = () => ctx.host?.lastSample()?.activity ?? null;
  const set = next => update(e.id, { card: { triggers: next } });
  const change = (i, next) => set(rules.map((r, n) => n === i ? next : r));
  const faceOptions = c.faces.map((name, i) => [String(i), name]);
  const list = el('div', { class: 'trigger-list' });
  const refreshers = [];
  const reorder = (from, to) => {
    const next = moveRule(rules, from, to);
    if (next === rules) return;
    set(next);
    queueMicrotask(() => document.querySelector(`[data-card-id="${e.id}"][data-rule-index="${to}"] .rule-handle`)?.focus());
  };
  rules.forEach((rule, i) => {
    const handle = tool(t('cardInsp.reorder', { value: i + 1 }), 'drag', () => {});
    handle.classList.add('rule-handle');
    handle.addEventListener('keydown', evt => {
      if (!['ArrowUp', 'ArrowDown', 'Home', 'End'].includes(evt.key)) return;
      evt.preventDefault(); evt.stopPropagation(); reorder(i, evt.key === 'Home' ? 0 : evt.key === 'End' ? rules.length - 1 : i + (evt.key === 'ArrowUp' ? -1 : 1));
    });
    handle.addEventListener('pointerdown', evt => {
      if (evt.button !== 0) return;
      evt.preventDefault(); handle.setPointerCapture(evt.pointerId);
      const row = handle.closest('.trigger-rule'); row.classList.add('dragging');
      const finish = end => {
        handle.removeEventListener('pointerup', finish); handle.removeEventListener('pointercancel', cancel);
        row.classList.remove('dragging');
        const mids = Array.from(list.children).filter(node => node !== row).map(node => { const b = node.getBoundingClientRect(); return b.y + b.height / 2; });
        reorder(i, dropIndex(mids, end.clientY));
      };
      const cancel = () => { handle.removeEventListener('pointerup', finish); handle.removeEventListener('pointercancel', cancel); row.classList.remove('dragging'); };
      handle.addEventListener('pointerup', finish); handle.addEventListener('pointercancel', cancel);
    });
    const sourceField = selectField(t('trigger.condition'), rule.source, TRIGGER_SOURCES.map(value => [value, t(value === 'timer' ? 'inspector.refreshSeconds' : `trigger.${value}`)]), value => change(i, withSource(rule, value, activity())));
    const source = sourceField.querySelector('select');
    source.setAttribute('aria-label', t('trigger.condition'));
    const suggestions = el('datalist', { id: `card-app-${e.id}-${i}` });
    const appField = textField(t('trigger.app'), rule.app ?? '', value => { const next = withApp(rule, value); if (next !== rule) change(i, next); }, { list: suggestions.id, placeholder: t('cardInsp.anyApp') });
    const input = appField.querySelector('input');
    input.setAttribute('aria-label', t('trigger.app'));
    const refresh = () => suggestions.replaceChildren(...appSuggestions(activity(), rule.source, rule.app).map(value => el('option', { value })));
    refresh(); refreshers.push(refresh);
    const faceField = selectField(t('trigger.face'), rule.nextFace ? 'next' : String(rule.face), [...(rule.source === 'timer' ? [['next', t('cardInsp.nextFace')]] : []), ...faceOptions], value => change(i, { ...rule, face: value === 'next' ? 0 : Number(value), ...(rule.source === 'timer' ? { nextFace: value === 'next' } : {}) }));
    const face = faceField.querySelector('select'); face.setAttribute('aria-label', t('trigger.face'));
    const timing = timedParts(rule);
    const intervalField = prefixedField('', t('cardInsp.interval'), timing.value, value => change(i, { ...rule, intervalSeconds: timedSeconds(value, timing.unit) }), { min: timing.unit === 'min' ? ROTATION_MIN / 60 : ROTATION_MIN, max: timing.unit === 'min' ? ROTATION_MAX / 60 : ROTATION_MAX, step: timing.unit === 's' ? 1 : 'any' });
    const unitField = selectField(t('cardInsp.intervalUnit'), timing.unit, ['s','min'].map(unit => [unit, t(`unit.${unit === 'min' ? 'minutes' : 'seconds'}`, { value: '' }).trim()]), unit => change(i, { ...rule, intervalSeconds: timedSeconds(timing.value, unit) }));
    unitField.querySelector('select').setAttribute('aria-label', t('cardInsp.intervalUnit'));
    const tokens = { source: sourceField, app: appField, face: faceField, interval: intervalField, unit: unitField };
    const sentence = sentenceOfParts(sentenceOf(rule).map(part => part.word ? t(`cardInsp.${part.word}`) : tokens[part.token]));
    list.append(el('div', { class: 'trigger-rule', role: 'group', 'aria-label': t('trigger.rule', { value: i + 1 }), dataset: { ruleIndex: String(i), cardId: String(e.id) } }, [
      el('div', { class: 'trigger-rule-head' }, [handle, el('span', { class: 'mono', text: t('trigger.rule', { value: i + 1 }) }), tool(t('trigger.remove'), 'trash', () => set(rules.filter((_, n) => n !== i)), false, 'danger')]), sentence, rule.source !== 'timer' && suggestions,
      rule.source !== 'timer' && fieldGrid([prefixedField(t('cardInsp.priority'), t('trigger.priority'), rule.priority ?? 0, value => change(i, { ...rule, priority: clampPriority(value) }), { min: 0, max: 100 }), prefixedField(t('cardInsp.return'), t('trigger.return'), rule.returnSeconds ?? 0, value => change(i, { ...rule, returnSeconds: clampReturn(value) }), { min: 0, max: 300, unit: 's' })]),
    ]));
  });
  // Stop polling when this render is replaced; no synthetic application names.
  if (ctx.host) queueMicrotask(function refreshActivity() { if (!list.isConnected) return; refreshers.forEach(refresh => refresh()); setTimeout(refreshActivity, 1000); });
  const appRules = rules.filter(r => r.source !== 'timer');
  const common = commonReturn(appRules);
  const returnTo = selectField(t('trigger.returnFace'), common === null ? 'previous' : String(common), [['previous', t('trigger.previous')], ...(common === 'mixed' ? [['mixed', t('cardInsp.mixed')]] : []), ...faceOptions], value => value !== 'mixed' && set(withReturn(rules, value === 'previous' ? value : Number(value))));
  returnTo.querySelector('select').disabled = !appRules.length;
  return [cardSection(ctx, 'triggers', t('cardInsp.triggersTitle'), [el('p', { class: 'hint', text: t('cardInsp.triggersIntro') }), list,
    el('button', { type: 'button', class: 'text-button trigger-add', disabled: rules.length >= MAX_RULES || c.faces.length < 2, onclick: () => set([...rules, newRule(c)]) }, [icon(ICONS.plus, 16), t('trigger.add')]),
    el('button', { type: 'button', class: 'text-button trigger-add', disabled: rules.length >= MAX_RULES || c.faces.length < 2, onclick: () => set([...rules, newTimedRule(c)]) }, [icon(ICONS.plus, 16), t('cardInsp.addTimed')]),
    rules.some(r => r.source === 'timer') && el('p', { class: 'hint', text: t('cardInsp.paused') }),
    c.faces.length < 2 && el('p', { class: 'hint', text: t('cardInsp.needsFaces') }), el('p', { class: 'hint', text: t('cardInsp.priorityHint') }),
  ], rules.length), cardSection(ctx, 'return', t('cardInsp.whenEnds'), [returnTo, el('p', { class: 'hint', text: t('cardInsp.appHint') })])];
}

export function renderCardPanel(tab, ctx) {
  if (tab === 'faces') return facesForm(ctx);
  if (tab === 'motion') return motionForm(ctx);
  if (tab === 'triggers') return triggerForm(ctx);
  return [];
}
