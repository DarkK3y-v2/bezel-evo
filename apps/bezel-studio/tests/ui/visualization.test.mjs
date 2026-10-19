import { test } from 'node:test';
import assert from 'node:assert/strict';
import { visualization, visualStyles } from '../../src/visualization.js';
test('presets preserve edited settings and never invent a second source',()=>{
  assert.equal(visualization('standard'),null);
  const v=visualization('matrix');
  assert.equal(v.secondary,null);
  assert.equal(visualization('matrix',{...v,columns:12}).columns,12);
  assert.equal(visualization('mirrored',v).style,'mirrored');
  assert.deepEqual(visualStyles('text'),[]);
  assert.deepEqual(visualStyles('ring'),['standard','pixel','dial']);
});
