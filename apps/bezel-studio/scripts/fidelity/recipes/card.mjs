// Populated Card states, built through the real editor and demo bridge.
import { translator } from '../../../src/i18n/index.js';
import { setPanelWidths } from '../../../tests/e2e/helpers.mjs';
const t = translator('it');
async function populated(app) {
  await setPanelWidths(app.page, { inspector: 360 });
  await app.page.reload();
  await app.add('card');
  const inspector = app.page.locator('#inspector');
  const name = await inspector.getByLabel(t('inspector.name'), { exact: true }).inputValue();
  const select = async () => {
    await app.tab('layers');
    await app.page.locator('.layer-name').filter({ hasText: name }).first().click();
    await app.tab('widgets');
  };
  await app.add('ring');
  await select();
  await inspector.getByRole('button', { name: t('card.addFace'), exact: true }).click();
  await app.add('bar');
  await app.add('graph');
  await select();
}
export default {
  area: 'card',
  artboards: ['CardFaces', 'CardMotion', 'CardTriggers'],
  states: [
    { name: 'faces', run: populated },
    { name: 'motion', run: async app => {
      await populated(app); await app.inspectorTab(1);
      await app.page.getByRole('switch', { name: t('card.autoRotate'), exact: true }).check();
      await app.page.getByRole('radio', { name: t('card.effect.slide'), exact: true }).check();
    } },
    { name: 'triggers', run: async app => {
      await populated(app); await app.inspectorTab(2);
      await app.page.getByRole('button', { name: t('trigger.add'), exact: true }).click();
      await app.page.getByRole('button', { name: t('trigger.add'), exact: true }).click();
    } },
    { name: 'look', run: async app => { await populated(app); await app.inspectorTab(3); } },
  ].map(state => ({ ...state, capture: '#inspector', viewport: { width: 1440, height: 1440 } })),
};
