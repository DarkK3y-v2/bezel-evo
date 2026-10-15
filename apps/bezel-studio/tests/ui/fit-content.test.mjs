import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canFitContent, createFitContent } from '../../src/editor/fit-content.js';
import { createStore } from '../../src/editor/store.js';

const element = { id: 1, frame: { x: 10, y: 20, width: 100, height: 40 }, kind: { type: 'text' } };
const theme = () => ({ elements: [structuredClone(element)] });
test('only supported, unlocked leaves can fit; container locks propagate', () => {
  const t = theme();
  assert.equal(canFitContent(t, 1), true);
  assert.equal(canFitContent(t, 9), false);
  for (const patch of [{ locked: true }, { isGroup: true }, { card: {} }, { kind: { type: 'ring' } }]) {
    assert.equal(canFitContent({ elements: [{ ...element, ...patch }] }, 1), false);
  }
  t.elements[0].groupParent = 2;
  assert.equal(canFitContent(t, 1), false);
  t.elements.push({ id: 2, locked: true });
  assert.equal(canFitContent(t, 1), false);
  t.elements[1].locked = false;
  assert.equal(canFitContent(t, 1), true);
});
test('fit is one undo step and ignores stale, absent and invalid measurements', async () => {
  const store = createStore(theme());
  const frame = { x: 10, y: 20, width: 55, height: 24 };
  const run = createFitContent({ store, bridge: { measureElement: async () => frame } });
  await run(1);
  assert.deepEqual(store.getState().theme.elements[0].frame, frame);
  store.undo();
  assert.deepEqual(store.getState().theme.elements[0].frame, element.frame);
  assert.equal(store.canUndo(), false);
  for (const result of [null, { ...frame, width: NaN }, { ...frame, height: 0 }]) {
    await createFitContent({ store, bridge: { measureElement: async () => result } })(1);
    assert.equal(store.canUndo(), false);
  }
  let resolve;
  const pending = createFitContent({ store, bridge: { measureElement: () => new Promise(r => { resolve = r; }) } })(1);
  store.dispatch('setFrame', { id: 1, frame: { ...element.frame, x: 99 } });
  resolve(frame); await pending;
  assert.equal(store.getState().theme.elements[0].frame.x, 99);
});
test('errors report through the host and locked objects never request measurement', async () => {
  const store = createStore(theme()); let error;
  const run = createFitContent({ store, bridge: { measureElement: async () => { throw new Error('missing'); } }, onError: e => { error = e; } });
  await run(1); assert.equal(error.message, 'missing');
  store.load({ elements: [{ ...element, locked: true }] }); error = null;
  await run(1); assert.equal(error, null);
});
