import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeCard, normalizeCardTheme, transitionFor, withPairTransition, remapPairs } from '../../src/card-config.js';
import { newTimedRule, sentenceOf, timedParts, timedSeconds, triggerMatches, withSource } from '../../src/card-rules.js';
import { createCardTimers } from '../../src/editor/card-timer.js';
import { createCardMotion } from '../../src/editor/card-motion.js';
import { createStore } from '../../src/editor/store.js';
import { DEMO_THEME } from '../../src/demo-theme.js';

const fade = { effect: 'fade', durationMs: 650, direction: 'left', includeBase: true };
const slide = { effect: 'slide', durationMs: 400, direction: 'up', includeBase: false };
const card = () => ({ faces: ['A', 'B', 'C'], activeFace: 0, transition: fade, triggers: [] });
const scene = c => ({ ...DEMO_THEME, elements: [{ id: 1, visible: true, frame: { x: 0, y: 0, width: 100, height: 100 }, kind: { type: 'shape' }, card: c }] });

test('legacy rotation migrates once, retaining app rules and general transition', () => {
  const c = { ...card(), rotationSeconds: 10, triggers: [{ source: 'foreground', app: 'game', face: 2, priority: 7 }] };
  const normalized = normalizeCard(c);
  assert.equal(normalized.rotationSeconds, undefined);
  assert.deepEqual(normalized.triggers[0], c.triggers[0]);
  assert.deepEqual(normalized.triggers[1], { source: 'timer', intervalSeconds: 10, nextFace: true, app: '', face: 0, priority: 0, returnSeconds: 0, returnFace: null });
  assert.equal(normalizeCard(normalized), normalized);
  assert.equal(c.rotationSeconds, 10);
  const store = createStore(scene(c));
  assert.deepEqual(store.getState().theme.elements[0].card, normalized);
  store.load(scene(c)); assert.deepEqual(store.getState().theme.elements[0].card, normalized);
  const plain = { elements: [{ id: 2 }, { id: 1, card: normalized }] };
  assert.equal(normalizeCardTheme(plain), plain);
  assert.equal(normalizeCard({ ...c, rotationSeconds: null }).rotationSeconds, null);
});

test('directed pairs fall back; edits, deletion and reordering preserve identities and Undo', () => {
  const c = card();
  c.triggers = [newTimedRule(c)];
  assert.equal(transitionFor(c, 0, 1), fade);
  assert.equal(transitionFor({ faces: [] }, 0, 1), null);
  c.pairTransitions = withPairTransition(c, 0, 1, slide);
  assert.equal(transitionFor(c, 0, 1), slide);
  assert.equal(transitionFor(c, 1, 0), fade);
  assert.deepEqual(withPairTransition(c, 0, 1, null), []);
  assert.deepEqual(remapPairs({}, i => i), []);
  const store = createStore(scene(c));
  store.dispatch('reorderCardFace', { id: 1, direction: 1 });
  assert.deepEqual(store.getState().theme.elements[0].card.pairTransitions, [{ from: 1, to: 0, transition: slide }]);
  store.undo(); assert.deepEqual(store.getState().theme.elements[0].card, c);
  store.dispatch('removeCardFace', { id: 1 });
  assert.deepEqual(store.getState().theme.elements[0].card.pairTransitions, []);
  assert.equal(store.getState().theme.elements[0].card.triggers.length, 1, 'next-face timer survives deleting face zero');
  store.undo(); assert.deepEqual(store.getState().theme.elements[0].card, c);
});

test('the motion tracker chooses each directed change and keeps general fallback', () => {
  const c = card(); c.pairTransitions = [{ from: 0, to: 1, transition: slide }];
  const theme = scene(c), motion = createCardMotion();
  motion.update(theme, 0);
  c.activeFace = 1;
  assert.deepEqual(motion.update(theme, 10).get(1).settings, slide);
  assert.equal(motion.update(theme, 410).size, 0);
  c.activeFace = 0;
  assert.deepEqual(motion.update(theme, 500).get(1).settings, fade);
  assert.equal(motion.update(theme, 550, false).size, 0);
});

test('timed sentences, units and condition changes use one canonical rule', () => {
  const timer = newTimedRule(card());
  assert.equal(timer.nextFace, true); assert.equal(timer.intervalSeconds, 10);
  assert.deepEqual(sentenceOf(timer), [{ token: 'source' }, { token: 'interval' }, { token: 'unit' }, { word: 'thenShow' }, { token: 'face' }]);
  assert.deepEqual(timedParts(timer), { value: 10, unit: 's' });
  assert.deepEqual(timedParts({ intervalSeconds: 120 }), { value: 2, unit: 'min' });
  assert.equal(timedSeconds(1, 'min'), 60); assert.equal(timedSeconds(2, 's'), 5);
  assert.equal(timedSeconds(999, 'min'), 3600);
  const app = withSource(timer, 'process', { foreground: 'game' });
  assert.equal(app.intervalSeconds, undefined); assert.equal(app.nextFace, undefined); assert.equal(app.app, 'game');
  assert.equal(triggerMatches(timer, null), false);
  assert.equal(triggerMatches({ source: 'foreground', app: 'GAME.exe' }, { foreground: 'game' }), true);
  assert.equal(triggerMatches({ source: 'processClosed', app: 'game' }, { available: false }), false);
  assert.equal(triggerMatches({ source: 'process', app: 'game' }, { available: true, applications: ['Game.exe'] }), true);
  assert.equal(triggerMatches({ source: 'processClosed', app: 'game' }, { available: true }), true);
  assert.equal(triggerMatches({ source: 'mediaPlaying', app: '' }, { media: [{ source: 'music', playing: true }] }), true);
});

test('timers advance or select a face, pause during app overrides and restart after return', () => {
  const c = card(), timer = { ...newTimedRule(c), intervalSeconds: 5 };
  c.triggers = [timer, { source: 'foreground', app: 'game', face: 2, priority: 5, returnSeconds: 3 }];
  const theme = scene(c), tracker = createCardTimers();
  tracker.update(theme, 0);
  assert.equal(tracker.update(theme, 5000).theme.elements[0].card.activeFace, 1);
  assert.equal(tracker.update(theme, 6000, true, { foreground: 'game' }).theme.elements[0].card.activeFace, 2);
  assert.equal(tracker.update(theme, 7000).theme.elements[0].card.activeFace, 2);
  assert.equal(tracker.update(theme, 10000).theme.elements[0].card.activeFace, 1);
  assert.equal(tracker.update(theme, 15000).theme.elements[0].card.activeFace, 2);
  c.triggers = [{ ...timer, nextFace: false, face: 1 }];
  tracker.update(theme, 16000);
  assert.equal(tracker.update(theme, 21000).theme.elements[0].card.activeFace, 1);
  assert.equal(theme.elements[0].card.activeFace, 0);
});
