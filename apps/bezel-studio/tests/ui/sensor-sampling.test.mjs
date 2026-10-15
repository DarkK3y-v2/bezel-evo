import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sampledSensorKeys } from '../../src/sensor-sampling.js';

const theme = { elements: [
  { id: 1, kind: { type: 'text', content: { type: 'player' } } },
  { id: 2, card: { triggers: [] } },
  { id: 3, card: { triggers: [{}] } },
  { id: 4, kind: { type: 'ring' } },
] };
test('activity sampling follows only the visible inspector selection, preserving library requests', () => {
  const keys = ['cpu.usage', 'cpu.usage'];
  const activity = ['cpu.usage', 'activity.processes', 'media.sessions'];
  for (const selection of [[1], [3]]) {
    assert.deepEqual(sampledSensorKeys(keys, { theme, selection }), activity);
    assert.deepEqual(sampledSensorKeys(keys, { theme, selection }, true, false), ['cpu.usage']);
    assert.deepEqual(sampledSensorKeys(keys, { theme, selection }, false), []);
  }
  for (const selection of [[], [2], [4], [1, 3], [99]]) {
    assert.deepEqual(sampledSensorKeys(keys, { theme, selection }), ['cpu.usage']);
  }
  assert.deepEqual(sampledSensorKeys(['media.sessions'], { theme, selection: [] }), ['media.sessions']);
});
