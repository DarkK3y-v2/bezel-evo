// The inspector of one object (artboards Main, GraphData/Look,
// PlayerData/Look): its head, its preview rendered alone by the backend
// (D-2026-10-09-studio-redesign-fidelity-8), the graph's scale and window,
// and the player's apps, all from the demo's real data.
import { test, expect, watchErrors, expectAccessible, clickAddWidget as add, openInspectorTab as tab } from './helpers.mjs';

/** Whether the preview's canvas has a pixel drawn (`any`) or a strong red one (`red`). */
const anyPixel = (preview, kind) => preview.evaluate((canvas, which) => {
  const d = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
  for (let i = 0; i < d.length; i += 4) {
    if (which === 'any' ? d[i + 3] > 0 : d[i + 3] > 200 && d[i] > 200 && d[i + 1] < 80 && d[i + 2] < 80) return true;
  }
  return false;
}, kind);

/** The alpha of the preview's pixel at the fraction `fx, fy` of its size. */
const alphaAt = (preview, fx, fy) => preview.evaluate((canvas, [x, y]) => {
  const px = Math.min(canvas.width - 1, Math.floor(canvas.width * x));
  const py = Math.min(canvas.height - 1, Math.floor(canvas.height * y));
  return canvas.getContext('2d').getImageData(px, py, 1, 1).data[3];
}, [fx, fy]);

test('the preview draws the object alone: an object under it is absent, and its color follows the edit', async ({ page, t }) => {
  const errors = watchErrors(page);
  await page.goto('/index.html?demo=turing88');
  // An opaque shape, then a ring over it, both in the middle of the screen.
  await add(page, t, 'shape');
  await add(page, t, 'ring');
  const inspector = page.locator('#inspector');
  const name = await inspector.getByLabel(t('inspector.name'), { exact: true }).inputValue();
  const preview = inspector.getByRole('img', { name: t('inspector.previewOf', { name }), exact: true });
  await expect(preview).toBeVisible();
  await expect.poll(() => anyPixel(preview, 'any')).toBe(true);
  // The shape fills the ring's middle on the screen; alone, the middle is empty.
  await expect.poll(() => alphaAt(preview, 0.5, 0.5)).toBe(0);
  await expect.poll(() => alphaAt(preview, 0.02, 0.02)).toBe(0);
  expect(await anyPixel(preview, 'red')).toBe(false);

  await tab(page, t, 'inspector.tab.look');
  const fill = inspector.locator('input[type="text"]').and(inspector.getByLabel(t('inspector.fill'), { exact: true }));
  await fill.fill('#ff0000');
  await fill.press('Tab');
  await expect.poll(() => anyPixel(preview, 'red')).toBe(true);
  await page.locator('#undo').click();
  await expect.poll(() => anyPixel(preview, 'red')).toBe(false);
  await expectAccessible(page);
  expect(errors).toEqual([]);
});

test('the head names the object, its kind and layer; the eye hides it and the lock locks it', async ({ page, t }) => {
  const errors = watchErrors(page);
  await page.goto('/index.html?demo=turing88');
  await add(page, t, 'ring');
  const inspector = page.locator('#inspector');
  const subtitle = new RegExp(`^${t('widget.ring')} · ${t('insp.layer', { level: '(\\d+)', total: '(\\d+)' })}$`);
  const text = await inspector.locator('.inspector-sub').textContent();
  const [, level, total] = text.match(subtitle);
  // A new object goes on top: the last layer.
  expect(Number(level)).toBe(Number(total));
  await page.locator('#tab-layers').click();
  await expect(page.locator('#layer-list .layer-row')).toHaveCount(Number(total));

  const name = inspector.getByRole('textbox', { name: t('inspector.name'), exact: true });
  await name.fill('Gauge 42');
  await name.press('Tab');
  await expect(page.locator('.layer-name').filter({ hasText: 'Gauge 42' })).toHaveCount(1);

  await inspector.getByRole('button', { name: t('layers.hide'), exact: true }).click();
  const show = inspector.getByRole('button', { name: t('collection.filter'), exact: true });
  await expect(show).toBeVisible();
  await show.click();
  await expect(inspector.getByRole('button', { name: t('layers.hide'), exact: true })).toBeVisible();

  const lock = inspector.getByRole('button', { name: t('layers.lock'), exact: true });
  await expect(lock).toHaveAttribute('aria-pressed', 'false');
  await lock.click();
  await expect(inspector.getByRole('button', { name: t('layers.unlock'), exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.locator('#undo').click();
  await expect(lock).toHaveAttribute('aria-pressed', 'false');

  // The source card shows the sensor's key and value now over its select.
  await expect(inspector.locator('.source-card .list-card-sub')).toHaveText('cpu.usage');
  await expect(inspector.locator('.source-card .list-card-value')).toHaveText(/%$/);
  await expect(inspector.getByRole('combobox', { name: t('inspector.sensor'), exact: true })).toHaveValue('cpu.usage');
  const arc = inspector.locator('.arc-preview .arc-fill');
  const beforeArc = await arc.getAttribute('d');
  const sweep = inspector.getByRole('spinbutton', { name: t('inspector.sweep'), exact: true });
  await sweep.fill('180');
  await sweep.press('Tab');
  await expect(sweep).toHaveValue('180');
  await expect(arc).toHaveAttribute('d', 'M15.03 48.97A24 24 0 0 1 48.97 15.03');
  await page.locator('#undo').click();
  await expect(arc).toHaveAttribute('d', beforeArc);
  // Both degree values fit beside their translated prefixes at default width.
  for (const label of ['inspector.startAngle', 'inspector.sweep']) {
    const field = inspector.getByRole('spinbutton', { name: t(label), exact: true });
    expect(await field.evaluate((input) => {
      const ctx = document.createElement('canvas').getContext('2d');
      ctx.font = getComputedStyle(input).font;
      return ctx.measureText(input.value).width <= input.clientWidth;
    })).toBe(true);
  }
  const x = inspector.getByRole('spinbutton', { name: t('inspector.x'), exact: true });
  await inspector.getByRole('button', { name: t('align.left'), exact: true }).click();
  await expect(x).toHaveValue('0');
  await expectAccessible(page);
  expect(errors).toEqual([]);
});

test('the graph scales itself and shows its peak; quick durations set its samples', async ({ page, t }) => {
  const errors = watchErrors(page);
  await page.goto('/index.html?demo=turing88');
  await add(page, t, 'graph');
  const inspector = page.locator('#inspector');
  const samples = inspector.getByRole('spinbutton', { name: t('inspector.history'), exact: true });
  await expect(samples).toHaveValue('60');
  const minute = inspector.getByRole('button', { name: t('unit.minutes', { value: 1 }), exact: true });
  await expect(minute).toHaveAttribute('aria-pressed', 'true');
  await inspector.getByRole('button', { name: t('unit.minutes', { value: 5 }), exact: true }).click();
  await expect(samples).toHaveValue('300');
  await expect(inspector.getByRole('button', { name: t('unit.minutes', { value: 5 }), exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(inspector.locator('.inspector-preview-axis')).toContainText(t('insp.ago', { seconds: 300 }));

  await expect(inspector.locator('.graph-peak')).toHaveCount(0);
  await inspector.getByRole('button', { name: t('insp.automatic'), exact: true }).click();
  await expect(inspector.getByRole('button', { name: t('insp.automatic'), exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(inspector).toContainText(t('insp.peak'));
  await expect(inspector.locator('.graph-peak')).toHaveText(/%$/);
  await expect(inspector.locator('.inspector-preview-value')).toHaveText(/%$/);

  await tab(page, t, 'inspector.tab.look');
  const styles = inspector.getByRole('group', { name: t('inspector.style'), exact: true });
  await expect(styles.getByRole('button', { name: t('graph.area'), exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(inspector.getByRole('slider', { name: new RegExp(t('insp.fillShare')) })).toBeVisible();
  await styles.getByRole('button', { name: t('graph.line'), exact: true }).click();
  await expect(styles.getByRole('button', { name: t('graph.line'), exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(inspector.getByRole('slider', { name: new RegExp(t('insp.fillShare')) })).toHaveCount(0);
  await expectAccessible(page);
  expect(errors).toEqual([]);
});

test('the player lists the apps with a media session, the playing one marked, and what shows when nothing plays', async ({ page, t }) => {
  const errors = watchErrors(page);
  await page.goto('/index.html?demo=turing88');
  await add(page, t, 'player');
  const inspector = page.locator('#inspector');
  const apps = inspector.getByRole('group', { name: t('insp.apps'), exact: true });
  await expect(apps.getByRole('button', { name: t('insp.automatic'), exact: true })).toHaveAttribute('aria-pressed', 'true');
  // The demo's Spotify plays, its Chrome is paused.
  const spotify = apps.getByRole('button', { name: `Spotify, ${t('insp.playing')}`, exact: true });
  await expect(spotify.locator('.pill-dot')).toHaveAttribute('data-playing', 'true');
  await expect(apps.getByRole('button', { name: 'chrome', exact: true }).locator('.pill-dot')).toHaveAttribute('data-playing', 'false');
  await spotify.click();
  await expect(apps.getByRole('button', { name: `Spotify, ${t('insp.playing')}`, exact: true })).toHaveAttribute('aria-pressed', 'true');
  const source = inspector.getByRole('textbox', { name: t('player.source'), exact: true });
  await expect(source).toHaveCount(0);
  await apps.getByRole('button', { name: t('insp.otherApp'), exact: true }).click();
  await expect(source).toHaveValue('Spotify');
  await source.fill('vlc');
  await source.press('Tab');
  await expect(apps.getByRole('button', { name: t('insp.otherApp'), exact: true })).toHaveAttribute('aria-pressed', 'true');
  // A named app closes the manual editor, including when the value was custom.
  await spotify.click();
  await expect(source).toHaveCount(0);
  await expect(apps.getByRole('button', { name: t('insp.otherApp'), exact: true })).toHaveAttribute('aria-pressed', 'false');
  await apps.getByRole('button', { name: t('insp.automatic'), exact: true }).click();
  await expect(apps.getByRole('button', { name: t('insp.automatic'), exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(source).toHaveCount(0);

  const stopped = inspector.getByRole('radiogroup', { name: t('insp.stopped'), exact: true });
  await expect(stopped.getByRole('radio', { name: new RegExp(t('insp.stoppedText')) })).toBeChecked();
  await expect(inspector.getByRole('textbox', { name: t('player.empty'), exact: true })).toBeVisible();
  await stopped.getByRole('radio', { name: new RegExp(t('insp.stoppedHide')) }).check();
  await expect(stopped.getByRole('radio', { name: new RegExp(t('insp.stoppedHide')) })).toBeChecked();
  await expect(stopped.getByRole('radio', { name: new RegExp(t('insp.stoppedHide')) })).toBeFocused();
  await expect(inspector.getByRole('textbox', { name: t('player.empty'), exact: true })).toHaveCount(0);
  await page.keyboard.press('ArrowDown');
  await expect(stopped.getByRole('radio', { name: new RegExp(t('insp.stoppedText')) })).toBeChecked();
  await expect(stopped.getByRole('radio', { name: new RegExp(t('insp.stoppedText')) })).toBeFocused();
  await page.keyboard.press('ArrowUp');
  await expect(stopped.getByRole('radio', { name: new RegExp(t('insp.stoppedHide')) })).toBeChecked();
  await page.locator('#undo').click();
  await expect(stopped.getByRole('radio', { name: new RegExp(t('insp.stoppedText')) })).toBeChecked();

  await tab(page, t, 'inspector.tab.look');
  const gap = inspector.getByRole('spinbutton', { name: t('player.coverGap'), exact: true });
  await gap.fill('14');
  await gap.press('Tab');
  await expect(gap).toHaveValue('14');
  await expectAccessible(page);
  expect(errors).toEqual([]);
});

test('late isolated frames are discarded and Player chips follow newly available activity', async ({ page, t, lang }) => {
  const errors = watchErrors(page);
  await page.goto('/index.html?demo=turing88');
  // A second inspector with the real demo backend: only IPC delivery is
  // delayed, so a selection change can overtake its first rendered answer.
  await page.evaluate(async (locale) => {
    const [{ createInspector }, { createStore }, { createDemoBackend }, { translator }] = await Promise.all([
      import('/ui/inspector.js'), import('/editor/store.js'), import('/demo-backend.js'), import('/i18n/index.js'),
    ]);
    const backend = createDemoBackend('turing88');
    const store = createStore((await backend.session()).theme);
    const catalog = await backend.catalog();
    const actual = await backend.sample();
    let sample = { ...actual, activity: null };
    let release;
    let calls = 0;
    const root = document.createElement('aside');
    root.id = 'inspector-probe';
    root.className = 'inspector';
    Object.assign(root.style, { position: 'fixed', inset: '52px 0 30px auto', width: '360px', zIndex: '100' });
    document.body.append(root);
    const inspector = createInspector({ root, store, t: translator(locale), minRefresh: () => 1,
      sensors: { catalog: () => catalog, fonts: () => [] },
      host: {
        lastSample: () => sample,
        renderElement: async (id, opts) => {
          calls += 1;
          const frame = await backend.renderElement(store.getState().theme, id, opts);
          if (calls === 1) await new Promise((resolve) => { release = resolve; });
          return frame;
        },
      },
    });
    store.subscribe(() => inspector.render());
    store.dispatch('add', { widget: 'ring', x: 200, y: 400 });
    globalThis.inspectorProbe = { store, inspector, release: () => release(), calls: () => calls,
      activity: (available) => { sample = { ...actual, activity: available ? actual.activity : null }; inspector.frameShown(); } };
  }, lang);
  const probe = page.locator('#inspector-probe');
  await expect.poll(() => page.evaluate(() => inspectorProbe.calls())).toBe(1);
  await page.evaluate(() => inspectorProbe.store.dispatch('add', { widget: 'shape', x: 200, y: 400 }));
  expect(await page.evaluate(() => inspectorProbe.calls())).toBe(1);
  await page.evaluate(() => inspectorProbe.release());
  const canvas = probe.getByRole('img');
  await expect.poll(() => page.evaluate(() => inspectorProbe.calls())).toBe(2);
  await expect.poll(() => alphaAt(canvas, 0.5, 0.5)).toBe(255);
  await expect(canvas).toHaveAttribute('aria-label', t('inspector.previewOf', { name: await probe.getByLabel(t('inspector.name'), { exact: true }).inputValue() }));

  await page.evaluate(() => inspectorProbe.store.dispatch('add', { widget: 'player', x: 200, y: 400 }));
  await expect(probe.locator('.player-apps-hint')).toHaveText(t('insp.appsNone'));
  await page.evaluate(() => inspectorProbe.activity(true));
  const spotify = probe.getByRole('button', { name: `Spotify, ${t('insp.playing')}`, exact: true });
  await expect(spotify).toBeVisible();
  await expect(probe.locator('.player-apps-hint')).toHaveText(t('insp.appsHint'));
  await spotify.click();
  await spotify.focus();
  await page.evaluate(() => inspectorProbe.activity(false));
  await expect(probe.getByRole('textbox', { name: t('player.source'), exact: true })).toHaveValue('Spotify');
  await expect(probe.locator('.player-apps-hint')).toHaveText(t('insp.appsNone'));
  await page.evaluate(() => inspectorProbe.activity(true));
  await expect(spotify).toHaveAttribute('aria-pressed', 'true');
  await expect(probe.getByRole('textbox', { name: t('player.source'), exact: true })).toHaveCount(0);
  await expectAccessible(page);
  expect(errors).toEqual([]);
});
