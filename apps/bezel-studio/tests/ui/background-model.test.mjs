// The theme's one background (D-2026-10-16-studio-redesign-fidelity-25):
// its kind and source, the options shown under its card, its name and
// status, and the chooser that sets nothing until confirmed.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  BACKGROUND_SOURCES, DEFAULT_BACKGROUND_COLOR, backgroundFileDraft, backgroundKind, backgroundName, backgroundOptions, backgroundSource, backgroundStatus,
  chooserSources, chosenBackground, colorName, confirmKey, imageFits, localCopyOf, mediumOf, sameBackground, screenVideos, startColor,
  startPicks, storedOnScreen, uploadMedium, videoWindowIds,
} from '../../src/editor/background.js';
import { createStore } from '../../src/editor/store.js';
import { DEMO_THEME } from '../../src/demo-theme.js';
import { SCENARIOS } from '../../src/demo-data.js';
import { LOCALES } from '../../src/i18n/index.js';

const color = { type: 'color', color: '#112233ff' };
const image = { type: 'image', asset: 'assets/foto.png', fit: 'contain' };
const clip = { type: 'video', asset: 'assets/ferias.mp4', poster: 'assets/ferias-poster.png', framing: { fit: 'contain' } };
const stored = { type: 'deviceVideo', path: 'sd/video/AMD.mp4', looping: false, color: '#445566ff' };
const plays = SCENARIOS.turing88.screens[0];
const host = { key: 'wch', models: [{ name: 'Rev A', capabilities: { storage: false, videoPlayback: false } }] };

test('a background is one kind from one source', () => {
  assert.deepEqual([color, image, clip, stored, { type: 'none' }, null].map(backgroundKind), ['color', 'image', 'video', 'deviceVideo', 'color', 'color']);
  assert.deepEqual([color, image, clip, stored].map(backgroundSource), ['color', 'computer', 'computer', 'screen']);
  assert.deepEqual(BACKGROUND_SOURCES, ['color', 'computer', 'screen']);
});

test('the card shows only the options of the kind in use', () => {
  assert.deepEqual(backgroundOptions(color), ['color']);
  assert.deepEqual(backgroundOptions(image), ['fit']);
  assert.deepEqual(backgroundOptions(clip), ['videoStatus', 'framing']);
  assert.deepEqual(backgroundOptions(stored), ['loop', 'windows', 'storage']);
});

test('a background is named by its file, or its colour with the opacity when not opaque', () => {
  assert.equal(colorName('#0c0e16ff'), '#0C0E16');
  assert.equal(colorName('#0c0e16'), '#0C0E16');
  assert.equal(colorName('#0c0e1680'), '#0C0E16 · 50%');
  assert.equal(colorName('teal'), 'teal');
  assert.equal(backgroundName(color), '#112233');
  assert.equal(backgroundName({ type: 'color' }), colorName(DEFAULT_BACKGROUND_COLOR));
  assert.deepEqual([image, clip, stored].map(backgroundName), ['foto.png', 'ferias.mp4', 'AMD.mp4']);
});

test('a picture fills or fits, and keeps another fit the theme saved', () => {
  assert.deepEqual(imageFits('cover'), ['cover', 'contain']);
  assert.deepEqual(imageFits(undefined), ['cover', 'contain']);
  assert.deepEqual(imageFits('fill'), ['cover', 'contain', 'fill']);
  assert.deepEqual(imageFits('none'), ['cover', 'contain', 'none']);
});

test('the video windows are the shapes that show the screen video', () => {
  const theme = { elements: [
    { id: 1, kind: { type: 'shape', videoWindow: true } },
    { id: 2, kind: { type: 'shape' } },
    { id: 3, kind: { type: 'text', videoWindow: true } },
    { id: 4, kind: { type: 'shape', videoWindow: true } },
  ] };
  assert.deepEqual(videoWindowIds(theme), [1, 4]);
  assert.deepEqual(videoWindowIds(null), []);
});

test('the screen listing says what it stores and what Bezel can send again', () => {
  const overview = {
    card: { free: 1 },
    files: [{ path: 'sd/video/AMD.mp4', kind: 'video' }, { path: 'sd/image/a.png', kind: 'image' }, { path: 'internal/video/x.mp4', kind: 'video' }],
    restorable: [{ path: 'sd/video/old.mp4', localCopy: true }, { path: 'sd/video/gone.mp4', localCopy: false }],
  };
  assert.deepEqual(screenVideos(overview).map((f) => f.path), ['sd/video/AMD.mp4', 'internal/video/x.mp4']);
  assert.deepEqual(screenVideos(null), []);
  assert.equal(storedOnScreen(overview, 'sd/video/AMD.mp4'), true);
  assert.equal(storedOnScreen(overview, 'sd/video/old.mp4'), false);
  assert.equal(storedOnScreen(null, 'sd/video/AMD.mp4'), null, 'not known yet');
  assert.equal(storedOnScreen({}, 'x'), false);
  const partial = { ...overview, folderErrors: [{ medium: 'sd', kind: 'video' }] };
  assert.equal(storedOnScreen(partial, 'sd/video/old.mp4'), null, 'a failed listing does not prove the video is missing');
  assert.equal(storedOnScreen(partial, 'sd/video/AMD.mp4'), true, 'a known file is present');
  assert.equal(storedOnScreen(partial, 'internal/video/old.mp4'), false, 'another folder was listed successfully');
  assert.equal(localCopyOf(overview, 'sd/video/old.mp4').path, 'sd/video/old.mp4');
  assert.equal(localCopyOf(overview, 'sd/video/gone.mp4'), null, 'no copy: nothing to send');
  assert.equal(localCopyOf(null, 'x'), null);
  assert.equal(uploadMedium(overview), 'sd');
  assert.equal(uploadMedium({ card: null }), 'internal');
  assert.equal(mediumOf('sd/video/AMD.mp4'), 'sd');
  assert.equal(mediumOf(null), '');
});

test('the status says where a video is; a colour or a picture has none', () => {
  const at = (bg, screen, live = false, state = null, isStored = null) => backgroundStatus(bg, { screen, live, liveVideo: state ? { state } : null, stored: isStored });
  assert.equal(at(color, plays), null);
  assert.equal(at(image, plays), null);
  // A video from the computer follows videoStatus.
  assert.deepEqual(at(clip, null), { tone: 'muted', key: 'screen.none' });
  assert.deepEqual(at(clip, plays), { tone: 'warn', key: 'insp.bgToCopy' });
  assert.deepEqual(at(clip, plays, true), { tone: 'muted', key: 'inspector.video.checking' });
  assert.deepEqual(at(clip, plays, true, 'onDevice'), { tone: 'ok', key: 'insp.bgOnScreen' });
  assert.deepEqual(at(clip, plays, true, 'missing'), { tone: 'error', key: 'insp.bgNotOnScreen' });
  assert.deepEqual(at(clip, host), { tone: 'info', key: 'insp.bgHostDecodes' });
  assert.deepEqual(at(clip, host, true, 'host'), { tone: 'info', key: 'insp.bgHostDecodes' });
  assert.deepEqual(at(clip, host, true, 'noConverter'), { tone: 'warn', key: 'insp.bgPosterOnly' });
  // A video stored on the screen: present, missing, or the screen cannot play it.
  assert.deepEqual(at(stored, null), { tone: 'muted', key: 'screen.none' });
  assert.deepEqual(at(stored, host), { tone: 'error', key: 'deviceVideo.unsupported' });
  assert.deepEqual(at(stored, plays, true, 'noPlayback'), { tone: 'error', key: 'deviceVideo.unsupported' });
  assert.deepEqual(at(stored, plays), { tone: 'muted', key: 'inspector.video.checking' }, 'not listed yet');
  assert.deepEqual(at(stored, plays, false, null, true), { tone: 'ok', key: 'insp.bgOnScreen' });
  assert.deepEqual(at(stored, plays, false, null, false), { tone: 'error', key: 'insp.bgNotOnScreen' });
  assert.deepEqual(at(stored, plays, true, 'storedMissing', true), { tone: 'error', key: 'insp.bgNotOnScreen' }, 'live says missing');
  assert.deepEqual(at(stored, plays, true, 'onDevice', false), { tone: 'ok', key: 'insp.bgOnScreen' }, 'live says it plays');
  assert.deepEqual(backgroundStatus(stored, { screen: plays, live: false, liveVideo: null }), { tone: 'muted', key: 'inspector.video.checking' });
});

test('the screen source is disabled, with the reason, when the screen cannot play stored videos', () => {
  assert.deepEqual(chooserSources(plays), [{ source: 'color', disabled: null }, { source: 'computer', disabled: null }, { source: 'screen', disabled: null }]);
  assert.equal(chooserSources(null)[2].disabled, 'screen.none');
  assert.equal(chooserSources(host)[2].disabled, 'deviceVideo.unsupported');
  assert.deepEqual(chooserSources(host).slice(0, 2).map((s) => s.disabled), [null, null]);
});

test('the chooser starts from the background in use', () => {
  assert.deepEqual(startPicks(color), { color: '#112233ff', computer: null, screen: null });
  assert.deepEqual(startPicks(clip), { color: DEFAULT_BACKGROUND_COLOR, computer: 'assets/ferias.mp4', screen: null });
  assert.deepEqual(startPicks(image, '#abcdefff'), { color: '#abcdefff', computer: 'assets/foto.png', screen: null }, 'the last colour seen');
  assert.deepEqual(startPicks(stored), { color: '#445566ff', computer: null, screen: 'sd/video/AMD.mp4' }, 'the colour around the windows');
  assert.equal(startColor({ type: 'color' }), DEFAULT_BACKGROUND_COLOR);
});

test('what the chooser would set: nothing until picked, the one in use as it is', () => {
  const assets = [{ ref: 'assets/ferias.mp4', kind: 'video', poster: 'assets/ferias-poster.png' }, { ref: 'assets/mar.png', kind: 'image' }];
  for (const source of BACKGROUND_SOURCES) assert.equal(chosenBackground(color, source, null, assets), null);
  assert.equal(chosenBackground(color, 'color', '#112233ff'), color);
  assert.deepEqual(chosenBackground(stored, 'color', '#000000ff'), { type: 'color', color: '#000000ff' });
  assert.equal(chosenBackground(clip, 'computer', 'assets/ferias.mp4', assets), clip, 'its framing kept');
  assert.deepEqual(chosenBackground(clip, 'computer', 'assets/mar.png', assets), { type: 'image', asset: 'assets/mar.png', fit: 'cover' });
  assert.deepEqual(chosenBackground(color, 'computer', 'assets/ferias.mp4', assets), { type: 'video', asset: 'assets/ferias.mp4', poster: 'assets/ferias-poster.png' });
  assert.equal(chosenBackground(color, 'computer', 'assets/gone.png', assets), null, 'an asset no longer in the theme');
  assert.equal(chosenBackground(stored, 'screen', 'sd/video/AMD.mp4'), stored);
  assert.deepEqual(chosenBackground(stored, 'screen', 'sd/video/NVI.mp4'), { type: 'deviceVideo', path: 'sd/video/NVI.mp4', looping: false, color: '#445566ff' }, 'loop and colour kept');
  assert.deepEqual(chosenBackground(color, 'screen', 'internal/video/earth.mp4'), { type: 'deviceVideo', path: 'internal/video/earth.mp4', looping: true, color: '#112233ff' });
  assert.deepEqual(chosenBackground(image, 'screen', 'internal/video/earth.mp4').color, DEFAULT_BACKGROUND_COLOR);
});

test('nothing to confirm when the choice is the background in use; the button says what it sets', () => {
  assert.ok(sameBackground(stored, { ...stored }));
  assert.ok(!sameBackground(stored, { ...stored, path: 'x' }));
  assert.ok(!sameBackground(stored, null));
  assert.ok(sameBackground(null, undefined));
  assert.equal(confirmKey(color, 'color'), 'insp.bgUseColor');
  assert.equal(confirmKey(image, 'computer'), 'insp.bgUseImage');
  assert.equal(confirmKey(clip, 'computer'), 'insp.bgUseVideo');
  assert.equal(confirmKey(stored, 'screen'), 'insp.bgUseVideo');
  assert.equal(confirmKey(null, 'color'), 'insp.bgUseColor');
  assert.equal(confirmKey(null, 'screen'), 'insp.bgUseVideo');
  assert.equal(confirmKey(null, 'computer'), 'insp.bgUse');
});

test('a confirmed change is one undo step, and nothing is set before it', () => {
  const store = createStore(DEMO_THEME);
  const before = store.getState().theme.background;
  const next = chosenBackground(before, 'screen', 'sd/video/AMD.mp4');
  assert.ok(!store.canUndo(), 'choosing sets nothing');
  store.dispatch('setTheme', { patch: { background: next } });
  assert.deepEqual(store.getState().theme.background, next);
  store.undo();
  assert.deepEqual(store.getState().theme.background, before);
  assert.ok(!store.canUndo() && !store.isDirty());
});

test('every text the model names exists in every locale', () => {
  const contexts = [null, plays, host].flatMap((screen) => [false, true].flatMap((live) => [null, 'onDevice', 'missing', 'storedMissing', 'noPlayback', 'host', 'noConverter']
    .flatMap((state) => [null, true, false].map((isStored) => ({ screen, live, liveVideo: state ? { state } : null, stored: isStored })))));
  const keys = new Set();
  for (const bg of [color, image, clip, stored]) for (const context of contexts) keys.add(backgroundStatus(bg, context)?.key);
  for (const screen of [null, plays, host]) for (const s of chooserSources(screen)) keys.add(s.disabled);
  for (const bg of [null, color, image, clip, stored]) for (const source of BACKGROUND_SOURCES) keys.add(confirmKey(bg, source));
  keys.delete(undefined);
  keys.delete(null);
  for (const [locale, table] of Object.entries(LOCALES)) for (const key of keys) assert.equal(typeof table[key], 'string', `${locale}: ${key}`);
});

test('picking a native file creates only a draft; the confirmed import supplies its actual asset', () => {
  assert.equal(backgroundFileDraft(null), null);
  assert.equal(backgroundFileDraft('notes.txt'), null);
  assert.deepEqual(backgroundFileDraft('C:/Videos/Clip.MP4'), { source: 'C:/Videos/Clip.MP4', ref: 'C:/Videos/Clip.MP4', kind: 'video' });
  assert.equal(backgroundFileDraft('/pictures/a.png').kind, 'image');
  assert.equal(backgroundFileDraft('/pictures/a.gif').kind, 'image', 'animation is determined by the importer, not guessed from its extension');
});
