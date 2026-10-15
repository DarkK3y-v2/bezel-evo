import test from 'node:test';
import assert from 'node:assert/strict';
import { CORNERS, LEAST_DRAWN, coverBox, cornerDrawing, cornerMode, cornerValue, drawnShare, radiiOf, withCorner, withCornerMode, withRadius } from '../../src/corner-radii.js';

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

test('the drawn share is the square root of the real one, from 0 to 1 and never decreasing', () => {
  assert.equal(drawnShare(0), 0);
  assert.equal(drawnShare(1), 1);
  assert.equal(drawnShare(0.25), 0.5);
  assert.equal(drawnShare(-1), 0);
  assert.equal(drawnShare(4), 1);
  let last = -1;
  for (let i = 0; i <= 100; i++) { const d = drawnShare(i / 100); assert.ok(d >= last); assert.ok(d >= i / 100, 'a small radius is drawn larger, never smaller'); last = d; }
});

test('without a size the drawing is a square standing for the object, a pill at half its side', () => {
  assert.deepEqual(cornerDrawing({ radius: 0, corners: null }), { width: 72, height: 72, radii: [0, 0, 0, 0] });
  assert.deepEqual(cornerDrawing({ radius: 9, corners: null }), { width: 72, height: 72, radii: [18, 18, 18, 18] });
  assert.deepEqual(cornerDrawing({ radius: 0, corners: [0, 50, 20, 36] }), { width: 72, height: 72, radii: [0, 36, 20, 36] });
  assert.deepEqual(cornerDrawing({ radius: 4, corners: null }, { width: 0, height: 10 }, { width: 40, height: 30 }).width, 30);
});

test('a small radius on a large object stays visible (D-24: 24 px on 342×432 is not square)', () => {
  const same = { width: 56, height: 40 };
  const big = cornerDrawing({ radius: 24, corners: null }, { width: 342, height: 432 }, same);
  assert.deepEqual([big.width, big.height], [32, 40]);
  assert.deepEqual(big.radii, [6, 6, 6, 6]);
  assert.ok(big.radii[0] > 24 * (32 / 342) * 2, 'more than twice the strict scale');
  // Any radius above 0 is drawn at least LEAST_DRAWN.
  assert.deepEqual(cornerDrawing({ radius: 1, corners: null }, { width: 342, height: 432 }, same).radii, Array(4).fill(LEAST_DRAWN));
  assert.deepEqual(cornerDrawing({ radius: 0.2, corners: [0, 0.2, 0, 0] }, { width: 342, height: 432 }, same).radii, [0, LEAST_DRAWN, 0, 0]);
});

test('the drawing never shrinks when a radius grows, and stops at a pill', () => {
  const box = { width: 342, height: 432 }, frame = { width: 56, height: 40 };
  let last = -1;
  for (let r = 0; r <= 200; r += 1) {
    const drawn = cornerDrawing({ radius: r, corners: null }, box, frame).radii[0];
    assert.ok(drawn >= last, `radius ${r}`);
    last = drawn;
  }
  assert.equal(last, 16, 'half the drawing’s shorter side');
  assert.deepEqual(cornerDrawing({ radius: 171, corners: null }, box, frame).radii, [16, 16, 16, 16]);
});

test('corners set one by one keep their proportions, so their differences show', () => {
  const each = { width: 88, height: 72 };
  const d = cornerDrawing({ radius: 0, corners: [0, 8, 16, 24] }, { width: 342, height: 432 }, each);
  assert.deepEqual([d.width, d.height], [57, 72]);
  assert.deepEqual(d.radii, [0, 3.6, 7.1, 10.7]);
  for (let i = 1; i < 4; i++) assert.ok(d.radii[i] - d.radii[i - 1] >= 3, 'every 8 px step is visible');
  // Ratios between corners are the object's (beyond its most a radius counts as the most).
  assert.deepEqual(cornerDrawing({ radius: 0, corners: [10, 0, 0, 100] }, { width: 50, height: 100 }, { width: 96, height: 72 }), { width: 36, height: 72, radii: [7.2, 0, 0, 18] });
  // Raising one corner never shrinks it, only the others relative to it.
  let last = -1;
  for (let r = 0; r <= 60; r += 2) {
    const drawn = cornerDrawing({ radius: 0, corners: [r, 20, 20, 20] }, { width: 342, height: 432 }, each).radii[0];
    assert.ok(drawn >= last, `corner ${r}`); last = drawn;
  }
});

test('with a size the drawing keeps the proportions, and a pill stays a pill', () => {
  // A 200×20 bar in a 96×72 frame: drawn 96×10, a pill when the radius is 10.
  assert.deepEqual(cornerDrawing({ radius: 10, corners: null }, { width: 200, height: 20 }, { width: 96, height: 72 }), { width: 96, height: 10, radii: [5, 5, 5, 5] });
  // A thin line is drawn 8px thick, and a pill stays a pill.
  assert.deepEqual(cornerDrawing({ radius: 2, corners: null }, { width: 1000, height: 1 }, { width: 96, height: 72 }).height, 8);
  assert.deepEqual(cornerDrawing({ radius: 10, corners: null }, { width: 384, height: 20 }, { width: 56, height: 40 }), { width: 56, height: 8, radii: [4, 4, 4, 4] });
  // Half the most is drawn at 71% of it: rounder than before, still short of a pill.
  assert.deepEqual(cornerDrawing({ radius: 5, corners: null }, { width: 384, height: 20 }, { width: 56, height: 40 }).radii, [2.8, 2.8, 2.8, 2.8]);
});

test('the same radius share is drawn the same on any object: shape, bar or cover', () => {
  const frame = { width: 56, height: 40 };
  // 12 px on a 96-px cover and 48 px on a 384-px square: both a quarter of their most.
  const cover = cornerDrawing({ radius: 12, corners: null }, { width: 96, height: 96 }, frame);
  const shape = cornerDrawing({ radius: 48, corners: null }, { width: 384, height: 384 }, frame);
  assert.deepEqual(cover, shape);
  assert.deepEqual(cover.radii, [10, 10, 10, 10]);
});

test('the player cover box is the renderers’ square: the height, 40% of the width, what the gap leaves', () => {
  assert.deepEqual(coverBox({ width: 400, height: 96 }, 6), { width: 96, height: 96 });
  assert.deepEqual(coverBox({ width: 200, height: 96 }, 6), { width: 80, height: 80 });
  assert.deepEqual(coverBox({ width: 50, height: 96 }, 40), { width: 10, height: 10 });
  assert.deepEqual(coverBox({ width: 50, height: 96 }, 80), { width: 0, height: 0 });
  assert.deepEqual(coverBox({ width: 100, height: 30 }, -5), { width: 30, height: 30 });
});
