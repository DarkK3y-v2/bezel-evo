import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CARD_TABS, HISTORY_MAX, HISTORY_MIN, OBJECT_TABS, QUICK_DURATIONS, appChips, appName, arcDrawing, createTabMemory, durationParts, layerFacts, quickDurations, tabAfterKey, tabsOf } from '../../src/inspector-tabs.js';

test('a card has faces, motion, triggers and look; every other object data and look', () => {
  assert.deepEqual(tabsOf('card'), ['faces', 'motion', 'triggers', 'look']);
  assert.equal(tabsOf('card'), CARD_TABS);
  for (const kind of ['ring', 'graph', 'text', 'group', 'shape']) assert.equal(tabsOf(kind), OBJECT_TABS);
  assert.deepEqual(OBJECT_TABS, ['data', 'look']);
  assert.ok(Object.isFrozen(CARD_TABS) && Object.isFrozen(OBJECT_TABS));
});

test('a kind opens on its first offered tab until one is chosen', () => {
  const memory = createTabMemory();
  assert.equal(memory.current('ring', OBJECT_TABS), 'data');
  assert.equal(memory.current('shape', ['look']), 'look');
  assert.equal(memory.current('card', CARD_TABS), 'faces');
  assert.equal(memory.current('ring', []), null);
});

test('the chosen tab stays open for its kind only, through any number of renders', () => {
  const memory = createTabMemory();
  memory.choose('ring', 'look');
  for (let i = 0; i < 3; i++) assert.equal(memory.current('ring', OBJECT_TABS), 'look');
  assert.equal(memory.current('graph', OBJECT_TABS), 'data');
  memory.choose('card', 'triggers');
  assert.equal(memory.current('card', CARD_TABS), 'triggers');
  assert.equal(memory.current('ring', OBJECT_TABS), 'look');
});

test('a chosen tab no longer offered falls back to the first, and comes back when offered again', () => {
  const memory = createTabMemory();
  memory.choose('shape', 'data');
  assert.equal(memory.current('shape', ['look']), 'look');
  assert.equal(memory.current('shape', OBJECT_TABS), 'data');
});

test('arrow keys step through the tabs and wrap; Home and End go to the ends', () => {
  assert.equal(tabAfterKey(CARD_TABS, 'faces', 'ArrowRight'), 'motion');
  assert.equal(tabAfterKey(CARD_TABS, 'look', 'ArrowRight'), 'faces');
  assert.equal(tabAfterKey(CARD_TABS, 'faces', 'ArrowLeft'), 'look');
  assert.equal(tabAfterKey(CARD_TABS, 'triggers', 'ArrowLeft'), 'motion');
  assert.equal(tabAfterKey(CARD_TABS, 'triggers', 'Home'), 'faces');
  assert.equal(tabAfterKey(CARD_TABS, 'motion', 'End'), 'look');
  assert.equal(tabAfterKey(OBJECT_TABS, 'unknown', 'ArrowRight'), 'look');
});

test('other keys and an empty tab list move nowhere', () => {
  for (const key of ['ArrowUp', 'ArrowDown', 'Enter', 'Tab', 'a']) assert.equal(tabAfterKey(OBJECT_TABS, 'data', key), null);
  assert.equal(tabAfterKey([], 'data', 'ArrowRight'), null);
});

const theme = {
  elements: [
    { id: 1, name: 'Background' },
    { id: 2, name: 'Net', isGroup: true },
    { id: 3, name: 'Download', groupParent: 2 },
    { id: 4, name: 'Faces', card: {} },
    { id: 5, name: 'Title', cardMember: { parent: 4, face: 0 } },
    { id: 6, name: 'Lost', groupParent: 99 },
  ],
};

test('the head tells the level among all objects, back to front, and the group or card', () => {
  assert.deepEqual(layerFacts(theme, theme.elements[0]), { level: 1, total: 6, group: null });
  assert.deepEqual(layerFacts(theme, theme.elements[2]), { level: 3, total: 6, group: 'Net' });
  assert.deepEqual(layerFacts(theme, theme.elements[4]), { level: 5, total: 6, group: 'Faces' });
  assert.deepEqual(layerFacts(theme, theme.elements[5]), { level: 6, total: 6, group: null });
});

test('a duration is told in its largest whole unit', () => {
  assert.deepEqual(durationParts(30), { value: 30, unit: 's' });
  assert.deepEqual(durationParts(60), { value: 1, unit: 'min' });
  assert.deepEqual(durationParts(900), { value: 15, unit: 'min' });
  assert.deepEqual(durationParts(3600), { value: 1, unit: 'h' });
  assert.deepEqual(durationParts(90), { value: 90, unit: 's' });
  assert.deepEqual(durationParts(7200), { value: 2, unit: 'h' });
  assert.deepEqual(durationParts(1.256), { value: 1.26, unit: 's' });
});

test('quick durations turn into samples at the theme refresh, the current one pressed', () => {
  assert.deepEqual(QUICK_DURATIONS, [30, 60, 300, 900, 3600]);
  assert.deepEqual(quickDurations(1, 60).map((d) => [d.samples, d.pressed, d.disabled]),
    [[30, false, false], [60, true, false], [300, false, false], [900, false, false], [3600, false, false]]);
  assert.deepEqual(quickDurations(0.5, 120).map((d) => [d.samples, d.pressed, d.disabled]),
    [[60, false, false], [120, true, false], [600, false, false], [1800, false, false], [7200, false, true]]);
  assert.equal(quickDurations(0, 30)[0].samples, 30);
  assert.equal(quickDurations(40, 2)[0].disabled, true);
  assert.equal(HISTORY_MIN, 2);
  assert.equal(HISTORY_MAX, 3600);
});

test('the arc drawing starts where the renderer starts and turns its way', () => {
  const ring = arcDrawing(-135, 270, true);
  assert.deepEqual(ring.start, { x: 15.03, y: 48.97 });
  assert.equal(ring.d, 'M15.03 48.97A24 24 0 1 1 48.97 48.97');
  assert.equal(ring.full, false);
  assert.equal(arcDrawing(0, 90, false).d, 'M32 8A24 24 0 0 0 8 32');
  assert.equal(arcDrawing(0, 90, true).d, 'M32 8A24 24 0 0 1 56 32');
  const full = arcDrawing(0, 400);
  assert.equal(full.full, true);
  assert.equal(full.d, 'M32 8A24 24 0 1 1 32 56A24 24 0 1 1 32 8');
  assert.equal(arcDrawing(0, 'x').d, 'M32 8A24 24 0 0 1 32 8');
  assert.deepEqual(arcDrawing(90, 90, true, { size: 20, radius: 10 }).start, { x: 20, y: 10 });
});

test('an application name drops its folder and .exe', () => {
  assert.equal(appName('Spotify.exe'), 'Spotify');
  assert.equal(appName('C:\\Program Files\\VLC\\vlc.EXE'), 'vlc');
  assert.equal(appName('/usr/bin/firefox'), 'firefox');
  assert.equal(appName(null), '');
});

test('the app chips list each media app once, playing ones first, the followed one pressed', () => {
  const activity = {
    media: [
      { source: 'chrome', playing: false },
      { source: 'Spotify.exe', playing: true },
      { source: 'spotify', playing: false },
      { source: 'vlc.exe', playing: false },
      { source: '', playing: true },
    ],
  };
  assert.deepEqual(appChips(activity, ''), {
    chips: [
      { name: 'Spotify', playing: true, pressed: false },
      { name: 'chrome', playing: false, pressed: false },
      { name: 'vlc', playing: false, pressed: false },
    ],
    custom: null,
  });
  assert.deepEqual(appChips(activity, 'SPOTIFY').chips.map((c) => c.pressed), [true, false, false]);
  assert.equal(appChips(activity, ' Foobar ').custom, 'Foobar');
  assert.deepEqual(appChips(null, 'foobar'), { chips: [], custom: 'foobar' });
  assert.deepEqual(appChips({ media: [{ source: 'chrome', playing: false }, { source: 'Chrome.exe', playing: true }] }).chips,
    [{ name: 'chrome', playing: true, pressed: false }]);
  assert.deepEqual(appChips(undefined), { chips: [], custom: null });
});
