import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PALETTE_MAX, SWATCH_NAME_MAX, USED_MAX, addSwatch, moveSwatch, paletteOf, removeSwatch, renameSwatch, usedColors } from '../../src/palette.js';

test('the theme palette is read leniently and only valid swatches stay', () => {
  assert.deepEqual(paletteOf({}), []);
  assert.deepEqual(paletteOf({ palette: 'x' }), []);
  assert.deepEqual(paletteOf({ palette: [{ color: '#F80' }, { name: '  Brand ', color: '#112233ff' }, { color: 'nope' }, null, { name: '', color: '#000' }] }),
    [{ color: '#ff8800ff' }, { name: 'Brand', color: '#112233ff' }, { color: '#000000ff' }]);
  const many = Array.from({ length: PALETTE_MAX + 5 }, () => ({ color: '#000000ff' }));
  assert.equal(paletteOf({ palette: many }).length, PALETTE_MAX);
});

test('a swatch is added at the end, named, moved and deleted, each a new list', () => {
  const empty = [];
  const one = addSwatch(empty, '#FF0000', ' Red ');
  assert.deepEqual(one, [{ name: 'Red', color: '#ff0000ff' }]);
  assert.deepEqual(empty, [], 'never mutated');
  assert.equal(addSwatch(one, 'nope'), one);
  const two = addSwatch(one, '#00ff0080');
  assert.deepEqual(two[1], { color: '#00ff0080' });
  const full = Array.from({ length: PALETTE_MAX }, () => ({ color: '#000000ff' }));
  assert.equal(addSwatch(full, '#ffffff'), full);
  assert.deepEqual(renameSwatch(two, 1, 'Green'), [{ name: 'Red', color: '#ff0000ff' }, { name: 'Green', color: '#00ff0080' }]);
  assert.deepEqual(renameSwatch(two, 0, '  '), [{ color: '#ff0000ff' }, { color: '#00ff0080' }], 'a blank name removes it');
  assert.equal(renameSwatch(two, 9, 'x'), two);
  assert.equal(renameSwatch(two, 0, 'x'.repeat(99))[0].name.length, SWATCH_NAME_MAX);
  const three = addSwatch(two, '#0000ff');
  assert.deepEqual(moveSwatch(three, 2, 0).map((s) => s.color), ['#0000ffff', '#ff0000ff', '#00ff0080']);
  assert.deepEqual(moveSwatch(three, 0, 99).map((s) => s.color), ['#00ff0080', '#0000ffff', '#ff0000ff']);
  assert.equal(moveSwatch(three, 1, 1), three);
  assert.equal(moveSwatch(three, 7, 0), three);
  assert.deepEqual(removeSwatch(three, 1).map((s) => s.color), ['#ff0000ff', '#0000ffff']);
  assert.equal(removeSwatch(three, 5), three);
});

test('used colours come from every element and the background, most used first', () => {
  const theme = {
    background: { type: 'color', color: '#0C0E16FF' },
    palette: [{ color: '#123456ff' }],
    elements: [
      { name: '#ffffffff', kind: { type: 'text', style: { paint: '#ffffffff' }, content: { type: 'static', text: '#abcdef00' } } },
      { kind: { type: 'ring', fill: { start: '#38bdf8ff', end: '#ffffffff' }, track: '#ffffff26' } },
      { kind: { type: 'bar', fill: '#38bdf8ff' }, colorByValue: { base: '#00c800ff', thresholds: [{ value: 1, color: '#ff0000ff' }] } },
    ],
  };
  assert.deepEqual(usedColors(theme), ['#ffffffff', '#38bdf8ff', '#0c0e16ff', '#ffffff26', '#00c800ff', '#ff0000ff']);
  assert.deepEqual(usedColors(theme, 2), ['#ffffffff', '#38bdf8ff']);
  assert.deepEqual(usedColors({}), []);
  const lots = { background: {}, elements: Array.from({ length: 40 }, (_, i) => ({ kind: { fill: `#0000${i.toString(16).padStart(2, '0')}ff` } })) };
  assert.equal(usedColors(lots).length, USED_MAX);
});
