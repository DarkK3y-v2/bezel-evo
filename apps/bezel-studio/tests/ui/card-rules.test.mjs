import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  FALLBACK_APP, MAX_APP, ROTATION_PRESETS, TRIGGER_SOURCES, appSuggestions, clampPriority, clampReturn, clampRotation,
  commonReturn, dropIndex, durationParts, isMedia, moveRule, newRule, sentenceOf, withApp, withReturn, withSource,
} from '../../src/card-rules.js';

const activity = {
  available: true,
  foreground: 'chrome',
  applications: ['Chrome', 'obs64', 'explorer'],
  media: [{ source: 'Spotify', title: 'a', artist: 'b', playing: true }, { source: 'firefox', title: 'c', artist: 'd', playing: false }],
};

test('a rule reads as a sentence; music adds "in" before the app', () => {
  assert.deepEqual(sentenceOf({ source: 'foreground' }), [{ word: 'when' }, { token: 'source' }, { token: 'app' }, { word: 'show' }, { token: 'face' }]);
  assert.deepEqual(sentenceOf({ source: 'mediaPlaying' }).map((p) => p.word ?? p.token), ['when', 'source', 'in', 'app', 'show', 'face']);
  assert.deepEqual(TRIGGER_SOURCES, ['foreground', 'process', 'processClosed', 'mediaPlaying']);
  assert.equal(isMedia('mediaPlaying'), true);
  assert.equal(isMedia('process'), false);
});

test('app suggestions come from the sample: front app first, no duplicates, the rule\'s own kept', () => {
  assert.deepEqual(appSuggestions(activity, 'foreground'), ['chrome', 'obs64', 'explorer']);
  assert.deepEqual(appSuggestions(activity, 'process', 'Steam'), ['Steam', 'chrome', 'obs64', 'explorer']);
  assert.deepEqual(appSuggestions(activity, 'mediaPlaying'), ['Spotify', 'firefox']);
  assert.deepEqual(appSuggestions(null, 'process', ' vlc '), ['vlc']);
  assert.deepEqual(appSuggestions(null, 'mediaPlaying'), []);
  assert.deepEqual(appSuggestions({ applications: ['a', 'b', 'c'] }, 'process', '', 2), ['a', 'b']);
});

test('changing the condition gives an app to the conditions that need one', () => {
  const music = { source: 'mediaPlaying', app: '', face: 1, priority: 0, returnSeconds: 3 };
  assert.equal(withSource(music, 'foreground', activity).app, 'chrome');
  assert.equal(withSource(music, 'process', { applications: ['obs64'] }).app, 'obs64');
  assert.equal(withSource(music, 'process', { media: [{ source: 'vlc' }] }).app, 'vlc');
  assert.equal(withSource(music, 'processClosed', null).app, FALLBACK_APP);
  assert.equal(withSource({ ...music, source: 'process', app: 'obs64' }, 'mediaPlaying').app, 'obs64');
  assert.equal(withSource({ ...music, app: 'Steam' }, 'process', activity).app, 'Steam');
  assert.equal(withSource(music, 'nonsense'), music);
  assert.equal(withSource({ source: 'process' }, 'mediaPlaying').app, '');
});

test('an app name is trimmed and bounded; empty only for music', () => {
  const rule = { source: 'process', app: 'obs64' };
  assert.equal(withApp(rule, '  vlc ').app, 'vlc');
  assert.equal(withApp(rule, ''), rule);
  assert.equal(withApp({ source: 'mediaPlaying', app: 'x' }, '   ').app, '');
  assert.equal(withApp(rule, 'x'.repeat(200)).app.length, MAX_APP);
  assert.equal(withApp({ source: 'mediaPlaying', app: 'x' }, null).app, '');
});

test('the return of every rule reads as one value and is set on all at once', () => {
  assert.equal(commonReturn([]), null);
  assert.equal(commonReturn([{ returnFace: null }, {}]), 'previous');
  assert.equal(commonReturn([{ returnFace: 1 }, { returnFace: 1 }]), 1);
  assert.equal(commonReturn([{ returnFace: 1 }, { returnFace: null }]), 'mixed');
  assert.deepEqual(withReturn([{ face: 0, returnFace: 1 }, { face: 1 }], 'previous'), [{ face: 0, returnFace: null }, { face: 1, returnFace: null }]);
  assert.deepEqual(withReturn([{ face: 0 }], 2), [{ face: 0, returnFace: 2 }]);
});

test('a new rule shows the face in view and returns like the others', () => {
  assert.deepEqual(newRule({ activeFace: 1 }), { source: 'mediaPlaying', app: '', face: 1, priority: 0, returnSeconds: 3, returnFace: null });
  assert.equal(newRule({ activeFace: 0, triggers: [{ returnFace: 2 }] }).returnFace, 2);
  assert.equal(newRule({ activeFace: 0, triggers: [{ returnFace: 2 }, { returnFace: null }] }).returnFace, null);
});

test('rules reorder within bounds; a drop lands before the first middle below the pointer', () => {
  const rules = ['a', 'b', 'c'];
  assert.deepEqual(moveRule(rules, 0, 2), ['b', 'c', 'a']);
  assert.deepEqual(moveRule(rules, 2, 0), ['c', 'a', 'b']);
  assert.equal(moveRule(rules, 1, 1), rules);
  assert.equal(moveRule(rules, -1, 1), rules);
  assert.equal(moveRule(rules, 0, 3), rules);
  assert.equal(dropIndex([10, 50], 5), 0);
  assert.equal(dropIndex([10, 50], 30), 1);
  assert.equal(dropIndex([10, 50], 90), 2);
});

test('numbers are clamped to what the theme accepts', () => {
  assert.equal(clampPriority(120), 100);
  assert.equal(clampPriority(-3), 0);
  assert.equal(clampPriority(7.6), 8);
  assert.equal(clampReturn(999), 300);
  assert.equal(clampReturn('x'), 0);
  assert.equal(clampRotation(1), 5);
  assert.equal(clampRotation(9999), 3600);
  assert.equal(clampRotation(12), 12);
  assert.deepEqual(ROTATION_PRESETS, [5, 10, 15, 30, 60]);
});

test('a quick duration reads in seconds or whole minutes', () => {
  assert.deepEqual(durationParts(30), { value: 30, unit: 's' });
  assert.deepEqual(durationParts(60), { value: 1, unit: 'min' });
  assert.deepEqual(durationParts(90), { value: 90, unit: 's' });
});
