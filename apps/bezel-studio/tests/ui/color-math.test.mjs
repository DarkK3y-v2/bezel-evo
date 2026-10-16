import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  alphaPercent, colorOf, hexOfHsva, hsvToRgb, hsvaOf, joinColor, normalizeHex, parseHex, readHexInput, rgbText,
  rgbToHsv, splitColor, stepHsva, toHex, withAlphaPercent,
} from '../../src/color-math.js';

test('hex in every short and long form, with or without # and spaces', () => {
  assert.deepEqual(parseHex('#ff8800'), { r: 255, g: 136, b: 0, a: 255 });
  assert.deepEqual(parseHex(' FF8800CC '), { r: 255, g: 136, b: 0, a: 204 });
  assert.deepEqual(parseHex('#f80'), { r: 255, g: 136, b: 0, a: 255 });
  assert.deepEqual(parseHex('f80c'), { r: 255, g: 136, b: 0, a: 204 });
  for (const bad of ['', '#ff888', '#ff8800c', 'red', '#gggggg', null, 12]) assert.equal(parseHex(bad), null, String(bad));
  assert.equal(toHex({ r: 255, g: 136, b: 0 }), '#ff8800ff');
  assert.equal(toHex({ r: 300, g: -4, b: 12.6, a: 127.5 }), '#ff000d80');
  assert.equal(normalizeHex('#F80'), '#ff8800ff');
  assert.equal(normalizeHex('nope'), null);
  assert.deepEqual(colorOf('nope'), { r: 255, g: 255, b: 255, a: 255 });
});

test("split and join keep the theme's #rrggbbaa", () => {
  assert.deepEqual(splitColor('#FF8800CC'), { rgb: '#ff8800', alpha: 80 });
  assert.deepEqual(splitColor('#102030'), { rgb: '#102030', alpha: 100 });
  assert.deepEqual(splitColor(undefined), { rgb: '#ffffff', alpha: 100 });
  assert.equal(joinColor('#FF8800', 80), '#ff8800cc');
  assert.equal(joinColor('#000000', 150), '#000000ff');
  assert.equal(joinColor('#000000', -5), '#00000000');
  assert.equal(rgbText('#ABCDEF80'), '#abcdef');
});

test('rgb and hsv convert both ways at the primaries, greys and a grid of colours', () => {
  assert.deepEqual(rgbToHsv({ r: 255, g: 0, b: 0 }), { h: 0, s: 1, v: 1 });
  assert.deepEqual(rgbToHsv({ r: 0, g: 255, b: 0 }), { h: 120, s: 1, v: 1 });
  assert.deepEqual(rgbToHsv({ r: 0, g: 0, b: 255 }), { h: 240, s: 1, v: 1 });
  assert.deepEqual(rgbToHsv({ r: 255, g: 0, b: 255 }), { h: 300, s: 1, v: 1 });
  assert.deepEqual(rgbToHsv({ r: 0, g: 0, b: 0 }), { h: 0, s: 0, v: 0 });
  assert.deepEqual(rgbToHsv({ r: 128, g: 128, b: 128 }), { h: 0, s: 0, v: 128 / 255 });
  assert.deepEqual(hsvToRgb({ h: 0, s: 1, v: 1 }), { r: 255, g: 0, b: 0 });
  assert.deepEqual(hsvToRgb({ h: 60, s: 1, v: 1 }), { r: 255, g: 255, b: 0 });
  assert.deepEqual(hsvToRgb({ h: 180, s: 1, v: 1 }), { r: 0, g: 255, b: 255 });
  assert.deepEqual(hsvToRgb({ h: 240, s: 1, v: 1 }), { r: 0, g: 0, b: 255 });
  assert.deepEqual(hsvToRgb({ h: 300, s: 1, v: 1 }), { r: 255, g: 0, b: 255 });
  assert.deepEqual(hsvToRgb({ h: -60, s: 2, v: 1 }), { r: 255, g: 0, b: 255 }, 'hue wraps, saturation clamps');
  for (let r = 0; r <= 255; r += 51) for (let g = 0; g <= 255; g += 51) for (let b = 0; b <= 255; b += 51) {
    assert.deepEqual(hsvToRgb(rgbToHsv({ r, g, b })), { r, g, b });
  }
});

test('the picker state keeps the chosen hue on greys and round-trips the hex', () => {
  assert.deepEqual(hsvaOf('#ff000080'), { h: 0, s: 1, v: 1, a: 128 / 255 });
  assert.equal(hsvaOf('#000000ff', 200).h, 200, 'black keeps the hue');
  assert.equal(hsvaOf('#808080ff', 33).h, 33, 'grey keeps the hue');
  assert.equal(hsvaOf('#00ff00ff', 33).h, 120);
  for (const hex of ['#38bdf8ff', '#a78bfa1a', '#0c0e16ff', '#ffffff00']) assert.equal(hexOfHsva(hsvaOf(hex)), hex);
  assert.equal(hexOfHsva({ h: 0, s: 1, v: 1, a: 2 }), '#ff0000ff');
});

test('keyboard steps clamp saturation, value and opacity and wrap the hue', () => {
  const at = { h: 359, s: 0.995, v: 0.01, a: 0.5 };
  assert.equal(stepHsva(at, 'h', 2).h, 1);
  assert.equal(stepHsva({ ...at, h: 0 }, 'h', -10).h, 350);
  assert.equal(stepHsva(at, 's', 10).s, 1);
  assert.equal(stepHsva(at, 'v', -10).v, 0);
  assert.equal(stepHsva(at, 'a', 1).a, 0.51);
  assert.equal(stepHsva(at, 'a', -1).a, 0.49);
});

test('opacity percent and what the hex field means', () => {
  assert.equal(alphaPercent('#ff000080'), 50);
  assert.equal(withAlphaPercent('#ff000080', 100), '#ff0000ff');
  assert.equal(withAlphaPercent('#ff000080', 'x'), '#ff000000');
  assert.equal(readHexInput('#00ff00', 128), '#00ff0080', 'six digits keep the current opacity');
  assert.equal(readHexInput('0f0', 255), '#00ff00ff');
  assert.equal(readHexInput('0f0'), '#00ff00ff');
  assert.equal(readHexInput('#00ff0040', 255), '#00ff0040', 'eight digits bring their own');
  assert.equal(readHexInput('#0f08', 255), '#00ff0088');
  assert.equal(readHexInput('green', 255), null);
  assert.equal(readHexInput(undefined), null);
});
