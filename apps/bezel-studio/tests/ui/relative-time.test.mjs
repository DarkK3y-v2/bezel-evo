import { test } from 'node:test';
import assert from 'node:assert/strict';
import { elapsed, timeAgo } from '../../src/relative-time.js';

const NOW = Date.UTC(2026, 9, 9, 10, 0, 0);
const ago = (seconds) => NOW - seconds * 1000;

test('elapsed takes the largest whole unit', () => {
  assert.deepEqual(elapsed(ago(0), NOW), { value: 0, unit: 'second' });
  assert.deepEqual(elapsed(ago(59), NOW), { value: 59, unit: 'second' });
  assert.deepEqual(elapsed(ago(60), NOW), { value: 1, unit: 'minute' });
  assert.deepEqual(elapsed(ago(4 * 60 + 59), NOW), { value: 4, unit: 'minute' });
  assert.deepEqual(elapsed(ago(3600), NOW), { value: 1, unit: 'hour' });
  assert.deepEqual(elapsed(ago(23 * 3600 + 3599), NOW), { value: 23, unit: 'hour' });
  assert.deepEqual(elapsed(ago(3 * 86400), NOW), { value: 3, unit: 'day' });
  assert.deepEqual(elapsed(ago(400 * 86400), NOW), { value: 400, unit: 'day' });
});

test('a moment in the future counts as now', () => {
  assert.deepEqual(elapsed(NOW + 5000, NOW), { value: 0, unit: 'second' });
});

test('timeAgo speaks the UI language', () => {
  const sameEn = new Intl.RelativeTimeFormat('en', { numeric: 'auto', style: 'short' });
  assert.equal(timeAgo(ago(4 * 60), NOW, 'en'), sameEn.format(-4, 'minute'));
  assert.equal(timeAgo(ago(12), NOW, 'it'), new Intl.RelativeTimeFormat('it', { numeric: 'auto', style: 'short' }).format(-12, 'second'));
  assert.equal(timeAgo(ago(86400), NOW, 'pt-BR'), new Intl.RelativeTimeFormat('pt-BR', { numeric: 'auto', style: 'short' }).format(-1, 'day'));
  assert.notEqual(timeAgo(ago(4 * 60), NOW, 'it'), timeAgo(ago(4 * 60), NOW, 'en'));
});
