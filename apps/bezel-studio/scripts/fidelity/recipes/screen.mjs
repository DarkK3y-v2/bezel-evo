// The screen panel and the sensor status (artboards Screen, Storage, SensorStatus).
// The artboards draw the panel 360px wide: the Settings states widen the
// library panel to that width (its resizer's own key), so the two compare.
const widen = async (app) => {
  const handle = app.page.locator('#resize-library');
  await handle.focus();
  for (let i = 0; i < 11; i += 1) await handle.press('ArrowRight');
  await handle.blur();
  await app.page.waitForTimeout(300);
};

export default {
  area: 'screen',
  artboards: ['Screen', 'Storage', 'SensorStatus'],
  states: [
    { name: 'settings', run: async (app) => { await app.tab('screen'); await widen(app); } },
    { name: 'storage', run: async (app) => { await app.tab('screen'); await app.click('#subtab-storage'); } },
    { name: 'sensor-ok', run: (app) => app.click('#status-libre-toggle') },
    { name: 'sensor-status', query: '&libre=partial', run: (app) => app.click('#status-libre-toggle') },
    { name: 'sensor-status-error', query: '&libre=error', run: (app) => app.click('#status-libre-toggle') },
    { name: 'sensor-chip-error', query: '&libre=error', run: async () => {} },
  ],
};
