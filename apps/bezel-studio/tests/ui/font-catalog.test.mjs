import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  FONT_FILTERS, FONT_SECTIONS, faceForFamily, faceOptions, faceValue, findFamily, fontSections, fontStatus, isNamedWeight,
  matchesQuery, nearestFace, normalizeCatalog, parseFaceValue, passesFilter, themeFamilies, themeFontAssets, withoutThemeFont,
} from '../../src/font-catalog.js';

const face = (weight, italic = false) => ({ weight, italic });
const CATALOG = normalizeCatalog({
  fallback: 'Inter',
  families: [
    { name: 'Inter', faces: [face(700), face(400), face(400), face(600)], monospace: false, category: 'sans', bundled: true },
    { name: 'JetBrains Mono', faces: [face(400), face(700)], monospace: true, category: 'mono', bundled: true },
    { name: 'Georgia', faces: [face(400), face(400, true), face(700)], category: 'serif' },
    { name: 'Malgun Gothic', aliases: ['맑은 고딕'], faces: [face(400)], category: 'sans' },
    { name: 'Segoe Script', faces: [face(400)], category: 'display' },
    { name: 'Odd', faces: [face(250)], category: 'weird' },
    { name: '', faces: [face(400)] },
    { name: 'No faces', faces: [] },
    { name: 'Bad faces', faces: [{ weight: 'x' }] },
  ],
});

test('the catalogue is normalised: faces sorted once, unknown categories are sans, bad families left out', () => {
  assert.equal(normalizeCatalog(null), null);
  assert.equal(normalizeCatalog({}), null);
  assert.deepEqual(CATALOG.families.map((f) => f.name), ['Inter', 'JetBrains Mono', 'Georgia', 'Malgun Gothic', 'Segoe Script', 'Odd']);
  assert.deepEqual(CATALOG.families[0].faces, [face(400), face(600), face(700)]);
  assert.equal(CATALOG.families[5].category, 'sans');
  assert.equal(CATALOG.fallback, 'Inter');
  assert.equal(normalizeCatalog({ families: [] }).fallback, null);
  assert.deepEqual(FONT_FILTERS, ['all', 'sans', 'serif', 'mono']);
  assert.deepEqual(FONT_SECTIONS, ['assets', 'theme', 'recent', 'bundled', 'user', 'system']);
});

test("a family is found by any case or a localized alias; a missing one falls back, an asset is the theme's", () => {
  assert.equal(findFamily(CATALOG, 'inter')?.name, 'Inter');
  assert.equal(findFamily(CATALOG, '맑은 고딕')?.name, 'Malgun Gothic');
  assert.equal(findFamily(CATALOG, 'Digital-7'), null);
  assert.equal(findFamily(null, 'Inter'), null);
  assert.deepEqual(fontStatus(null, { family: 'Inter' }), { known: false, missing: false, family: null, fallback: null });
  assert.equal(fontStatus(CATALOG, { family: 'Georgia' }).missing, false);
  assert.deepEqual(fontStatus(CATALOG, { family: 'Digital-7' }), { known: true, missing: true, family: null, fallback: 'Inter' });
  assert.equal(fontStatus(CATALOG, { family: 'Digital-7', asset: 'assets/d7.ttf' }).missing, false);
});

test("the theme's families are listed once each, in reading order", () => {
  const theme = { elements: [
    { kind: { style: { font: { family: 'Georgia', weight: 400 } } } },
    { kind: { content: { type: 'player' }, style: { font: { family: 'inter', weight: 700 } } } },
    { kind: { style: { font: { family: 'GEORGIA', weight: 700 } } } },
    { kind: { family: 'turing-rev-c' } },
  ] };
  assert.deepEqual(themeFamilies(theme), ['Georgia', 'inter']);
  assert.deepEqual(themeFamilies({}), []);
});

test('filters and search narrow the families; accents and case do not matter', () => {
  const georgia = findFamily(CATALOG, 'Georgia');
  assert.ok(passesFilter(georgia, 'all'));
  assert.ok(passesFilter(georgia, 'serif'));
  assert.ok(!passesFilter(georgia, 'sans'));
  assert.ok(matchesQuery(georgia, ''));
  assert.ok(matchesQuery(georgia, '  GEOR '));
  assert.ok(matchesQuery({ name: 'Café Sans', aliases: [] }, 'cafe sa'));
  assert.ok(!matchesQuery(georgia, 'geor mono'));
  assert.ok(matchesQuery(findFamily(CATALOG, 'Malgun Gothic'), '맑은'));
});

test('sections: in the theme (missing ones too), recent, bundled, system; empty ones left out', () => {
  const sections = fontSections(CATALOG, { theme: ['Georgia', 'Digital-7'], recent: ['georgia', 'JetBrains Mono', 'Gone'] });
  assert.deepEqual(sections.map((s) => [s.key, s.count]), [['theme', 2], ['recent', 1], ['bundled', 2], ['system', 4]]);
  assert.deepEqual(sections[0].entries[1], { name: 'Digital-7', missing: true });
  assert.equal(sections[1].entries[0].name, 'JetBrains Mono', 'a theme family is not repeated as recent');
  const mono = fontSections(CATALOG, { filter: 'mono', theme: ['Georgia', 'Digital-7'], recent: ['JetBrains Mono'] });
  assert.deepEqual(mono.map((s) => [s.key, s.count]), [['recent', 1], ['bundled', 1]], 'a missing family has no category');
  const found = fontSections(CATALOG, { query: 'digi', theme: ['Digital-7'] });
  assert.deepEqual(found.map((s) => s.key), ['theme']);
  assert.deepEqual(fontSections(CATALOG, { query: 'zzz' }), []);
  assert.deepEqual(fontSections(null), []);
  assert.deepEqual(fontSections(CATALOG).map((s) => s.key), ['bundled', 'system']);
});

test('faces: the value round-trips and the nearest face follows font matching', () => {
  assert.equal(faceValue(face(700, true)), '700i');
  assert.deepEqual(parseFaceValue('700i'), face(700, true));
  assert.deepEqual(parseFaceValue('400'), face(400));
  assert.equal(parseFaceValue('bold'), null);
  const faces = [face(300), face(500), face(700), face(400, true)];
  assert.deepEqual(nearestFace(faces, face(600)), face(700), 'a tie above 500 goes heavier');
  assert.deepEqual(nearestFace(faces, face(400)), face(300), 'a tie below goes lighter');
  assert.deepEqual(nearestFace(faces, face(800, true)), face(400, true), 'the slant first');
  assert.deepEqual(nearestFace([face(400)], face(700, true)), face(400));
  assert.equal(nearestFace([], face(400)), null);
  assert.ok(isNamedWeight(400));
  assert.ok(!isNamedWeight(250));
});

test('the face select offers only real faces, and tells when the theme asks for one the family lacks', () => {
  const inter = findFamily(CATALOG, 'Inter');
  assert.deepEqual(faceOptions(inter, face(600)).map((o) => o.value), ['400', '600', '700']);
  const lacking = faceOptions(inter, face(300, true));
  assert.deepEqual(lacking.map((o) => o.value), ['300i', '400', '600', '700'], 'in weight order');
  assert.deepEqual(lacking[0], { ...face(300, true), value: '300i', missing: true, nearest: face(400) });
  assert.deepEqual(faceOptions(null, face(700)), [{ ...face(700), value: '700', missing: true, nearest: null }]);
  assert.deepEqual(faceForFamily(inter, face(800)), face(700));
  assert.deepEqual(faceForFamily({ faces: [] }, face(800)), face(800));
});


test('user and theme files have distinct sections and matching faces even with identical family names', () => {
  const catalog = normalizeCatalog({ families: [
    { name: 'Local', faces: [face(400)], origin: 'user' },
    { name: 'Local', faces: [face(700)], origin: 'theme', asset: 'assets/local.ttf' },
  ] });
  assert.deepEqual(fontSections(catalog).map((s) => s.key), ['assets', 'user']);
  assert.equal(findFamily(catalog, 'Local').origin, 'user');
  assert.deepEqual(fontStatus(catalog, { family: 'Local', asset: 'assets/local.ttf' }).family.faces, [face(700)]);
});


test('detaching a font preserves its family and style everywhere, without mutating undo snapshots', () => {
  const font = { family: 'Local', weight: 700, italic: true, asset: 'assets/local.ttf' };
  const theme = { elements: [{ kind: { style: { font }, content: { progress: { font } } } }] };
  const next = withoutThemeFont(theme, font.asset);
  assert.deepEqual([...themeFontAssets(theme)], [font.asset]);
  assert.deepEqual([...themeFontAssets(next)], []);
  assert.deepEqual(next.elements[0].kind.style.font, { ...font, asset: null });
  assert.deepEqual(next.elements[0].kind.content.progress.font, { ...font, asset: null });
  assert.equal(theme.elements[0].kind.style.font.asset, font.asset);
});
