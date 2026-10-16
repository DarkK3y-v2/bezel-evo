import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRecents, pushRecent } from '../../src/recents.js';

const memoryStorage = (initial = {}) => {
  const data = { ...initial };
  return { data, getItem: (k) => data[k] ?? null, setItem: (k, v) => { data[k] = v; } };
};

test('the latest pick goes first, once, and the list stays short', () => {
  assert.deepEqual(pushRecent(['a', 'b', 'c'], 'b', 3), ['b', 'a', 'c']);
  assert.deepEqual(pushRecent(['a', 'b', 'c'], 'd', 3), ['d', 'a', 'b']);
  assert.deepEqual(pushRecent(['A'], 'a', 3, (x, y) => x.toLowerCase() === y.toLowerCase()), ['a']);
});

test('recents are stored per user and survive a new list over the same storage', () => {
  const storage = memoryStorage({ r: JSON.stringify(['#FFF', 'nope', 3, '#000000ff']) });
  const accept = (x) => x.startsWith('#');
  const normalize = (x) => x.toLowerCase();
  const recents = createRecents(storage, 'r', { max: 3, accept, normalize });
  assert.deepEqual(recents.list(), ['#fff', '#000000ff']);
  recents.push('#ABC');
  assert.deepEqual(createRecents(storage, 'r', { max: 3, accept, normalize }).list(), ['#abc', '#fff', '#000000ff']);
  assert.deepEqual(recents.push('#111'), ['#111', '#abc', '#fff']);
});

test('a storage that refuses or holds junk keeps the list for the session', () => {
  const refusing = { getItem: () => { throw new Error('denied'); }, setItem: () => { throw new Error('full'); } };
  const recents = createRecents(refusing, 'r');
  assert.deepEqual(recents.list(), []);
  assert.deepEqual(recents.push('Inter'), ['Inter']);
  assert.deepEqual(recents.list(), ['Inter']);
  assert.deepEqual(createRecents(memoryStorage({ r: '{oops' }), 'r').list(), []);
  assert.deepEqual(createRecents(memoryStorage({ r: '{"a":1}' }), 'r').list(), []);
  assert.deepEqual(createRecents(null, 'r').push('x'), ['x']);
});
