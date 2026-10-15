// The inspector (artboards Main's right panel, GraphData/Look, PlayerData/Look).
import { setPanelWidths } from '../../../tests/e2e/helpers.mjs';
import { translator } from '../../../src/i18n/index.js';

const t = translator('it');
// Standalone inspector boards are 360px; Main keeps the shell's 320px.
async function standalone(app, kind) {
  await setPanelWidths(app.page, { inspector: 360 });
  await app.page.reload();
  await app.add(kind);
}

export default {
  area: 'inspector',
  artboards: ['Main', 'GraphData', 'GraphLook', 'PlayerData', 'PlayerLook'],
  states: [
    { name: 'theme', run: async () => {} },
    { name: 'ring', run: (app) => app.add('ring') },
    { name: 'ring-look', run: async (app) => { await app.add('ring'); await app.inspectorTab(1); } },
    { name: 'graph', run: (app) => standalone(app, 'graph') },
    { name: 'graph-auto', run: async (app) => {
      await standalone(app, 'graph');
      await app.page.locator('#inspector').getByRole('button', { name: t('insp.automatic'), exact: true }).click();
    } },
    { name: 'graph-look', run: async (app) => { await standalone(app, 'graph'); await app.inspectorTab(1); } },
    { name: 'player', run: (app) => standalone(app, 'player') },
    { name: 'player-look', run: async (app) => { await standalone(app, 'player'); await app.inspectorTab(1); } },
    { name: 'player-corners', run: async (app) => {
      await standalone(app, 'player');
      await app.inspectorTab(1);
      await app.page.locator('#inspector').getByRole('button', { name: t('insp.cornersEach'), exact: true }).click();
    } },
    { name: 'shape-corners', run: async (app) => {
      await standalone(app, 'shape');
      await app.page.locator('#inspector').getByRole('button', { name: t('insp.cornersEach'), exact: true }).click();
      await app.page.locator('#inspector .corner-radii').scrollIntoViewIfNeeded();
    } },
    { name: 'bar-look', run: async (app) => { await standalone(app, 'bar'); await app.inspectorTab(1); } },
    { name: 'player-custom', run: async (app) => {
      await standalone(app, 'player');
      await app.page.locator('#inspector').getByRole('button', { name: t('insp.otherApp'), exact: true }).click();
    } },
    { name: 'player-stopped', run: async (app) => {
      await standalone(app, 'player');
      await app.page.locator('#inspector').getByRole('radio', { name: new RegExp(t('insp.stoppedHide')) }).check();
    } },
  ].map(state => ({ ...state, capture: '#inspector' })),
};
