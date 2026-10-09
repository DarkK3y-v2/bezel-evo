// The app icons: the Pixel mark SVGs and the raster set Tauri ships.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inflateSync } from 'node:zlib';

import { PALETTE, TRAY_SIZES, encodePng, matrixPaths, pixelMarkSvg, trayLayout, trayPixels, writeTrayIcons } from '../../scripts/build-icons.mjs';

const app = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const icons = join(app, 'src-tauri', 'icons');
const conf = JSON.parse(readFileSync(join(app, 'src-tauri', 'tauri.conf.json'), 'utf8'));

/** Width and height from the IHDR chunk of a PNG. */
function pngSize(buf) {
  assert.equal(buf.subarray(0, 8).toString('hex'), '89504e470d0a1a0a', 'PNG signature');
  assert.equal(buf.subarray(12, 16).toString('latin1'), 'IHDR');
  return [buf.readUInt32BE(16), buf.readUInt32BE(20)];
}

/** Square sizes stored in an ICO directory (a 0 byte means 256). */
function icoSizes(buf) {
  assert.equal(buf.readUInt16LE(0), 0, 'ICO reserved');
  assert.equal(buf.readUInt16LE(2), 1, 'ICO type = icon');
  const sizes = [];
  for (let i = 0; i < buf.readUInt16LE(4); i += 1) {
    const at = 6 + i * 16;
    const w = buf[at] || 256;
    const h = buf[at + 1] || 256;
    assert.equal(w, h, `ICO entry ${i} is square`);
    sizes.push(w);
  }
  return sizes.sort((a, b) => a - b);
}

/** The edge the file name promises, or undefined for an unknown PNG. */
function expectedEdge(name) {
  const fixed = { 'icon.png': 512, 'icon-1024.png': 1024, 'StoreLogo.png': 50 };
  if (name in fixed) return fixed[name];
  const tray = /^tray-(\d+)\.png$/.exec(name);
  if (tray) return Number(tray[1]);
  const m = /^(?:Square)?(\d+)x(\d+)(@2x)?(?:Logo)?\.png$/.exec(name);
  if (!m) return undefined;
  assert.equal(m[1], m[2], `${name} names a square`);
  return Number(m[1]) * (m[3] ? 2 : 1);
}

test('both icon.svg files are the generated Pixel mark', () => {
  const ui = readFileSync(join(app, 'src', 'icon.svg'), 'utf8');
  const tauri = readFileSync(join(icons, 'icon.svg'), 'utf8');
  assert.equal(ui, tauri, 'src/icon.svg and src-tauri/icons/icon.svg differ');
  assert.equal(ui, pixelMarkSvg(), 'icon.svg is stale: run node scripts/build-icons.mjs');
  assert.match(ui, /fill="#FF9248"/, 'the accent is the literal --accent');
});

test('the mark is a B on a 5x7 matrix with an accent base and a live pixel', () => {
  const cells = (d) => (d.match(/M/g) ?? []).length;
  const p = matrixPaths();
  assert.equal(cells(p.dim) + cells(p.lit) + cells(p.acc) + cells(p.live), 35);
  assert.equal(cells(p.live), 1);
  assert.equal(cells(p.acc), 6);
  assert.equal(cells(p.lit), 14);
  assert.equal(PALETTE.accent, '#FF9248');
});

test('every PNG listed in tauri.conf.json has the size in its name', () => {
  const listed = conf.bundle.icon.filter((f) => f.endsWith('.png'));
  assert.ok(listed.length >= 3);
  for (const rel of listed) {
    const name = rel.split('/').pop();
    const edge = expectedEdge(name);
    assert.deepEqual(pngSize(readFileSync(join(app, 'src-tauri', rel))), [edge, edge], rel);
  }
});

test('every PNG in src-tauri/icons, extras included, has the size in its name', () => {
  const pngs = readdirSync(icons).filter((f) => f.endsWith('.png'));
  for (const extra of ['icon-1024.png', '64x64.png', ...TRAY_SIZES.map((e) => `tray-${e}.png`)]) assert.ok(pngs.includes(extra), extra);
  assert.ok(!pngs.includes('tray.png'), 'the old tray picture (the app icon reduced) is gone');
  for (const name of pngs) {
    const edge = expectedEdge(name);
    assert.ok(edge, `unexpected icon ${name}`);
    assert.deepEqual(pngSize(readFileSync(join(icons, name))), [edge, edge], name);
  }
});

test('icon.ico (NSIS installer and exe icon) carries 16/24/32/48/64/256', () => {
  assert.ok(conf.bundle.icon.includes('icons/icon.ico'));
  assert.deepEqual(icoSizes(readFileSync(join(icons, 'icon.ico'))), [16, 24, 32, 48, 64, 256]);
});

/** The pixels of a PNG `encodePng` wrote (8-bit RGBA, rows unfiltered). */
function decodePng(buf) {
  const [width, height] = pngSize(buf);
  assert.deepEqual([...buf.subarray(24, 29)], [8, 6, 0, 0, 0], '8-bit RGBA, not interlaced');
  const parts = [];
  for (let at = 8; at < buf.length;) {
    const length = buf.readUInt32BE(at);
    if (buf.subarray(at + 4, at + 8).toString('latin1') === 'IDAT') parts.push(buf.subarray(at + 8, at + 8 + length));
    at += 12 + length;
  }
  const rows = inflateSync(Buffer.concat(parts));
  const out = new Uint8Array(width * height * 4);
  for (let row = 0; row < height; row += 1) {
    const at = row * (1 + width * 4);
    assert.equal(rows[at], 0, 'unfiltered row');
    out.set(rows.subarray(at + 1, at + 1 + width * 4), row * width * 4);
  }
  return { width, height, rgba: out };
}

/** WCAG contrast ratio of two `[r, g, b]` colours. */
function contrast(a, b) {
  const lum = (c) => {
    const [r, g, bl] = c.map((v) => v / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));

test('the tray icon is drawn at 16, 20, 24 and 32 px, as build-icons.mjs draws it', () => {
  assert.deepEqual([...TRAY_SIZES], [16, 20, 24, 32]);
  for (const edge of TRAY_SIZES) {
    const png = readFileSync(join(icons, `tray-${edge}.png`));
    assert.deepEqual(pngSize(png), [edge, edge], `tray-${edge}.png`);
    assert.deepEqual(decodePng(png).rgba, trayPixels(edge), `tray-${edge}.png is stale: run node scripts/build-icons.mjs`);
  }
  const dir = mkdtempSync(join(tmpdir(), 'bezel-tray-'));
  try {
    writeTrayIcons(dir);
    for (const edge of TRAY_SIZES) assert.deepEqual(decodePng(readFileSync(join(dir, `tray-${edge}.png`))).rgba, trayPixels(edge));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
  const tiny = encodePng(1, 1, new Uint8Array([1, 2, 3, 4]));
  assert.deepEqual([...decodePng(tiny).rgba], [1, 2, 3, 4]);
});

test('the tray icon keeps a crisp B on its tile, legible on light and dark taskbars', () => {
  const [tile, lit, accent] = [hex(PALETTE.tile), hex(PALETTE.lit), hex(PALETTE.accent)];
  const lightBar = [243, 243, 243];
  const darkBar = [32, 32, 32];
  assert.ok(contrast(tile, lightBar) >= 7, 'the dark tile stands out on a light taskbar');
  assert.ok(contrast(lit, darkBar) >= 7 && contrast(lit, tile) >= 7, 'the letter stands out on a dark one');
  assert.ok(contrast(accent, tile) >= 4.5, 'and its accent base');
  for (const edge of TRAY_SIZES) {
    const { cell, gap, x, y } = trayLayout(edge);
    const px = trayPixels(edge);
    const at = (cx, cy) => [...px.subarray((cy * edge + cx) * 4, (cy * edge + cx) * 4 + 4)];
    assert.ok(cell >= 2, `${edge}: cells of at least 2 px`);
    assert.ok(x >= 2 && y >= 1 && x + 3 * cell + 2 * gap <= edge - 2 && y + 5 * cell + 4 * gap <= edge - 1, `${edge}: the B fits inside the tile`);
    assert.deepEqual(at(x, y), [...lit, 255], `${edge}: the top-left cell is lit`);
    assert.deepEqual(at(x + cell + gap, y + 4 * (cell + gap)), [...accent, 255], `${edge}: the base is the accent`);
    assert.deepEqual(at(x + 2 * (cell + gap), y), [...hex(PALETTE.live), 255], `${edge}: the live pixel`);
    assert.deepEqual(at(x + 2 * (cell + gap), y + cell + gap), [...lit, 255], `${edge}: the B's bowl`);
    assert.deepEqual(at(x + cell + gap, y + cell + gap), [...tile, 255], `${edge}: an unlit cell is the tile`);
    assert.equal(at(0, 0)[3], 0, `${edge}: transparent outside the rounded corner`);
    assert.equal(at(Math.floor(edge / 2), 0)[3], 255, `${edge}: the tile reaches the edge`);
  }
});

test('Light and Studio draw the tray from the dedicated tray icon', () => {
  const read = (rel) => readFileSync(join(app, ...rel.split('/')), 'utf8');
  const shared = read('src-tauri/src/tray_icon.rs');
  for (const edge of TRAY_SIZES) assert.match(shared, new RegExp(`include_bytes!\\("\\.\\./icons/tray-${edge}\\.png"\\)`), `tray_icon.rs embeds tray-${edge}.png`);
  const studio = read('src-tauri/src/tray.rs');
  assert.match(studio, /crate::tray_icon::/, 'the Studio tray uses it');
  const light = read('../../crates/bezel-cli/src/light_tray.rs');
  assert.match(light, /#\[path = "\.\.\/\.\.\/\.\.\/apps\/bezel-studio\/src-tauri\/src\/tray_icon\.rs"\]/, 'Light includes the same module');
  assert.match(light, /mod tray_picture;[\s\S]*tray_picture::tray_rgba\(/, 'and uses it');
  assert.doesNotMatch(light + studio, /tray\.png|default_window_icon/, 'neither draws the app icon in the tray');
});

test('icon.icns is an Apple icon family', () => {
  const buf = readFileSync(join(icons, 'icon.icns'));
  assert.equal(buf.subarray(0, 4).toString('latin1'), 'icns');
  assert.equal(buf.readUInt32BE(4), buf.length);
});
