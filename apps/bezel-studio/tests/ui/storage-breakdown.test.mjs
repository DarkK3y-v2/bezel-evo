import test from 'node:test';
import assert from 'node:assert/strict';
import { BAR_KINDS, PLACES, bootFile, breakdown, mediaShown, placeCounts } from '../../src/storage-breakdown.js';

const files = [
  { path: 'internal/video/a.mp4', medium: 'internal', kind: 'video', size: 300 },
  { path: 'internal/image/b.png', medium: 'internal', kind: 'image', size: 100 },
  { path: 'internal/image/c.png', medium: 'internal', kind: 'image', size: null },
  { path: 'sd/video/d.mp4', medium: 'sd', kind: 'video', size: 2000, protected: 'boot' },
  { path: 'sd/video/e.mp4', medium: 'sd', kind: 'video', size: 500, protected: 'themeVideo' },
];

test('the bar parts are videos, pictures and the rest, as shares of the medium', () => {
  assert.deepEqual(BAR_KINDS, ['video', 'image', 'other']);
  assert.deepEqual(breakdown(files, { used: 500, total: 1000 }, 'internal'), [
    { kind: 'video', bytes: 300, fraction: 0.3 },
    { kind: 'image', bytes: 100, fraction: 0.1 },
    { kind: 'other', bytes: 100, fraction: 0.1 },
  ]);
});

test('the parts never sum to more than what the medium uses', () => {
  // A listing newer than the capacity: the files outgrow it.
  const parts = breakdown(files, { used: 2200, total: 4000 }, 'sd');
  assert.deepEqual(parts.map((p) => p.bytes), [2200, 0, 0]);
  assert.equal(parts.reduce((sum, p) => sum + p.fraction, 0), 0.55);
  // Used beyond the total is the whole medium.
  assert.deepEqual(breakdown([], { used: 50, total: 10 }, 'sd').map((p) => p.bytes), [0, 0, 10]);
});

test('no capacity, no bar', () => {
  assert.deepEqual(breakdown(files, null, 'sd'), []);
  assert.deepEqual(breakdown(files, { used: 0, total: 0 }, 'sd'), []);
  assert.deepEqual(breakdown(files, { total: 100 }, 'sd').map((p) => p.bytes), [0, 0, 0]);
});

test('the place filter counts each place and picks its media', () => {
  assert.deepEqual(PLACES, ['all', 'sd', 'internal']);
  assert.deepEqual(placeCounts(files), { all: 5, sd: 2, internal: 3 });
  assert.deepEqual(placeCounts([]), { all: 0, sd: 0, internal: 0 });
  const media = ['internal', 'sd'];
  assert.deepEqual(mediaShown('all', media), ['internal', 'sd']);
  assert.deepEqual(mediaShown('sd', media), ['sd']);
  assert.deepEqual(mediaShown('internal', media), ['internal']);
  assert.deepEqual(mediaShown('elsewhere', media), ['internal', 'sd']);
});

test('the boot file is the one Bezel set, else none', () => {
  assert.equal(bootFile(files).path, 'sd/video/d.mp4');
  assert.equal(bootFile(files.filter((f) => f.protected !== 'boot')), null);
});
