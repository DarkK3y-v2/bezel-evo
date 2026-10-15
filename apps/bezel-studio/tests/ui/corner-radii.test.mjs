import test from 'node:test';
import assert from 'node:assert/strict';
import { CORNERS, cornerDrawing, cornerMode, cornerValue, radiiOf, withCorner, withCornerMode, withRadius } from '../../src/corner-radii.js';

test('the corners go around the box from the top left', () => {
  assert.deepEqual(CORNERS, ['topLeft', 'topRight', 'bottomRight', 'bottomLeft']);
});

test('a value reads a radius and four corners, anything else as none', () => {
  assert.deepEqual(cornerValue(6), { radius: 6, corners: null });
  assert.deepEqual(cornerValue(undefined), { radius: 0, corners: null });
  assert.deepEqual(cornerValue(-3, [1, -2, 3, 4]), { radius: 0, corners: [1, 0, 3, 4] });
  assert.deepEqual(cornerValue(5, [1, 2]), { radius: 5, corners: null });
  assert.deepEqual(cornerValue(5, null), { radius: 5, corners: null });
  assert.deepEqual(cornerValue(Number.NaN, [Number.NaN, 1, 2, 3]), { radius: 0, corners: [0, 1, 2, 3] });
});

test('the mode follows the corners', () => {
  assert.equal(cornerMode({ radius: 4, corners: null }), 'same');
  assert.equal(cornerMode({ radius: 4, corners: [4, 4, 4, 4] }), 'each');
});

test('going to individual corners starts them at the radius, back keeps the top-left one', () => {
  const same = { radius: 8, corners: null };
  const each = withCornerMode(same, 'each');
  assert.deepEqual(each, { radius: 8, corners: [8, 8, 8, 8] });
  assert.deepEqual(withCornerMode({ radius: 8, corners: [3, 9, 9, 9] }, 'same'), { radius: 3, corners: null });
  assert.equal(withCornerMode(same, 'same'), same);
  assert.equal(withCornerMode(each, 'each'), each);
});

test('one radius for all, or one corner at a time, never below zero', () => {
  assert.deepEqual(withRadius({ radius: 2, corners: [1, 2, 3, 4] }, 12), { radius: 12, corners: null });
  assert.deepEqual(withRadius({ radius: 2, corners: null }, -5), { radius: 0, corners: null });
  assert.deepEqual(withCorner({ radius: 2, corners: [1, 2, 3, 4] }, 2, 30), { radius: 2, corners: [1, 2, 30, 4] });
  assert.deepEqual(withCorner({ radius: 2, corners: [1, 2, 3, 4] }, 0, -1), { radius: 2, corners: [0, 2, 3, 4] });
  assert.deepEqual(withCorner({ radius: 5, corners: null }, 1, 9), { radius: 5, corners: [5, 9, 5, 5] });
});

test('the four radii, whatever the mode', () => {
  assert.deepEqual(radiiOf({ radius: 7, corners: null }), [7, 7, 7, 7]);
  assert.deepEqual(radiiOf({ radius: 7, corners: [1, 2, 3, 4] }), [1, 2, 3, 4]);
});

test('without a size the drawing is a square with the radii as they are, up to half its side', () => {
  assert.deepEqual(cornerDrawing({ radius: 10, corners: null }), { width: 72, height: 72, radii: [10, 10, 10, 10] });
  assert.deepEqual(cornerDrawing({ radius: 0, corners: [0, 50, 20, 36] }), { width: 72, height: 72, radii: [0, 36, 20, 36] });
  assert.deepEqual(cornerDrawing({ radius: 4, corners: null }, { width: 0, height: 10 }, { width: 40, height: 30 }).width, 30);
});

test('with a size the drawing keeps the proportions and each radius its share of the shorter side', () => {
  // A 200×20 bar in a 96×72 frame: drawn 96×10, a pill when the radius is 10.
  assert.deepEqual(cornerDrawing({ radius: 10, corners: null }, { width: 200, height: 20 }, { width: 96, height: 72 }), { width: 96, height: 10, radii: [5, 5, 5, 5] });
  // A tall 50×100 box in the same frame: scale 0.72.
  assert.deepEqual(cornerDrawing({ radius: 0, corners: [10, 0, 0, 100] }, { width: 50, height: 100 }, { width: 96, height: 72 }), { width: 36, height: 72, radii: [7.2, 0, 0, 18] });
  // A thin line is drawn 8px thick, and a pill stays a pill.
  assert.deepEqual(cornerDrawing({ radius: 2, corners: null }, { width: 1000, height: 1 }, { width: 96, height: 72 }).height, 8);
  assert.deepEqual(cornerDrawing({ radius: 10, corners: null }, { width: 384, height: 20 }, { width: 56, height: 40 }), { width: 56, height: 8, radii: [4, 4, 4, 4] });
  assert.deepEqual(cornerDrawing({ radius: 5, corners: null }, { width: 384, height: 20 }, { width: 56, height: 40 }).radii, [2, 2, 2, 2]);
});
