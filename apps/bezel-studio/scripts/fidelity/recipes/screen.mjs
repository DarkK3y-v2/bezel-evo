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

const settings = async (app) => {
  await app.tab('screen');
  await widen(app);
  await app.page.locator('label.live-toggle').click();
  await app.page.locator('#screen-panel input[type=checkbox]').check();
  await app.click('.standby-radio[data-choice=off]');
  await app.click('.standby-dialog .dialog-actions .primary-button');
  await app.page.locator('#toast').waitFor({ state: 'hidden' });
};

const storage = async (app) => {
  await app.tab('screen');
  await app.click('#subtab-storage');
};

export default {
  area: 'screen',
  artboards: ['Screen', 'Storage', 'SensorStatus'],
  states: [
    { name: 'settings', run: settings },
    { name: 'settings-advanced', run: async (app) => { await settings(app); await app.page.locator('.screen-tail').scrollIntoViewIfNeeded(); } },
    { name: 'storage', run: storage },
    { name: 'storage-boot', demo: 'vendorCard', run: storage },
    { name: 'storage-boot-drop', run: async (app) => {
      await storage(app);
      await app.page.locator('.manager-column[data-medium=internal] [role=option]').first().hover();
      await app.page.mouse.down();
      await app.page.locator('.boot-slot').hover();
    } },
    { name: 'storage-sd', run: async (app) => { await storage(app); await app.click('[data-focus=place-sd]'); } },
    { name: 'sensor-ok', run: (app) => app.click('#status-libre-toggle') },
    { name: 'sensor-status', query: '&libre=partial', run: (app) => app.click('#status-libre-toggle') },
    { name: 'sensor-status-error', query: '&libre=error', run: (app) => app.click('#status-libre-toggle') },
    { name: 'sensor-chip-error', query: '&libre=error', run: async () => {} },
    { name: 'sensor-restarting', query: '&libre=error', run: async (app) => {
      // Freeze timers before invoking the real demo bridge, so its pending
      // restart can be photographed without extending production delays.
      await app.page.clock.install({ time: new Date('2026-10-09T10:00:00Z') });
      await app.page.clock.pauseAt(new Date('2026-10-09T10:00:01Z'));
      await app.page.locator('#status-libre-restart').click();
    } },
  ],
};
