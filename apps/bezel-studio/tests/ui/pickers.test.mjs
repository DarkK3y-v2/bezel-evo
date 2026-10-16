import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createPickers } from '../../src/ui/pickers.js';

const family = { name: 'Local', faces: [{ weight: 400, italic: false }], origin: 'user' };

test('one picker context reloads the catalog, opens the fixed folder and detaches files in one undoable command', async () => {
  let theme = { elements: [{ kind: { style: { font: { family: 'Local', weight: 400, asset: 'assets/local.ttf' } } } }] };
  const original = structuredClone(theme);
  let calls = 0, opened = 0, notified = 0, dispatched = 0;
  const pickers = createPickers({
    storage: null, t: (key) => key, onCatalog: () => notified++,
    store: { getState: () => ({ theme }), dispatch: (command, { patch }) => { assert.equal(command, 'setTheme'); dispatched++; theme = { ...theme, ...patch }; } },
    bridge: {
      fontCatalog: async () => { calls++; return { families: [family, { ...family, origin: 'theme', asset: 'assets/local.ttf' }] }; },
      openFontsFolder: async () => { opened++; },
    },
  });
  await pickers.load();
  assert.equal(notified, 1);
  const { source, texts } = pickers.font('Real sample');
  assert.equal(source.sample, 'Real sample');
  assert.equal(texts.sections.user, 'fontPicker.user');
  await source.openFolder();
  await source.reload();
  assert.equal(opened, 1);
  assert.equal(calls, 2);
  assert.equal(notified, 1, 'a popover reload does not redraw its anchor');
  source.remove('assets/local.ttf');
  assert.equal(dispatched, 1);
  assert.equal(source.catalog().families.length, 1);
  assert.equal(theme.elements[0].kind.style.font.asset, null);
  theme = original;
  assert.equal(source.catalog().families.length, 2, 'undo restores the file in the picker');
  source.remember('Local');
  assert.deepEqual(source.recent(), ['Local']);
});
