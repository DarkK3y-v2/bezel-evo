import { test, expect, watchErrors, expectAccessible, clickAddWidget } from './helpers.mjs';

test('demo pixels and fit measurement use display case without rewriting content', async ({ page }) => {
  await page.goto('/index.html?demo=turing88');
  const matches = await page.evaluate(async () => {
    const { renderApprox, measureApprox } = await import('/demo-render.js');
    const { createWidget } = await import('/editor/widgets.js');
    const source = 'mÚSICA já TOCA';
    const made = createWidget('text', { width: 480, height: 100 });
    return ['upper','lower','sentence','title'].map((casing, i) => {
      const expected = ['MÚSICA JÁ TOCA','música já toca','Música já toca','Música Já Toca'][i];
      const element = { ...made, id: 1, visible: true, opacity: 1, frame: { x: 0, y: 0, width: 480, height: 100 },
        kind: { ...made.kind, content: { type: 'static', text: source }, style: { ...made.kind.style, size: 26, casing } } };
      const theme = { canvas: { width: 480, height: 100 }, background: { type: 'color', color: '#000000ff' }, refreshSeconds: 1, elements: [element] };
      const reference = structuredClone(theme);
      reference.elements[0].kind.content.text = expected;
      reference.elements[0].kind.style.casing = 'normal';
      const a = renderApprox(theme, 0).rgba;
      const b = renderApprox(reference, 0).rgba;
      return a.every((byte,index) => byte === b[index])
        && JSON.stringify(measureApprox(theme,1,0)) === JSON.stringify(measureApprox(reference,1,0))
        && theme.elements[0].kind.content.text === source;
    });
  });
  expect(matches).toEqual([true,true,true,true]);
});

test('letter case preserves source text and supports Undo across text widgets', async ({ page, t }) => {
  const errors = watchErrors(page);
  await page.goto('/index.html?demo=turing88');
  await clickAddWidget(page, t, 'text');
  const inspector = page.locator('#inspector');
  const source = inspector.getByRole('textbox', { name: t('common.text'), exact: true });
  await source.fill('è GIÀ una BELLA giornata');
  await source.press('Tab');
  await inspector.getByRole('tab', { name: t('inspector.tab.look'), exact: true }).click();
  const casing = inspector.getByRole('combobox', { name: t('textCase.label'), exact: true });
  for (const mode of ['upper', 'lower', 'sentence', 'title']) {
    await casing.selectOption(mode);
    await expect(casing).toHaveValue(mode);
  }
  await page.locator('#undo').click();
  await expect(casing).toHaveValue('sentence');
  await expectAccessible(page);
  await inspector.getByRole('tab', { name: t('inspector.tab.data'), exact: true }).click();
  await expect(inspector.getByRole('textbox', { name: t('common.text'), exact: true })).toHaveValue('è GIÀ una BELLA giornata');
  for (const widget of ['value', 'player', 'weather']) {
    await clickAddWidget(page, t, widget);
    await inspector.getByRole('tab', { name: t('inspector.tab.look'), exact: true }).click();
    await inspector.getByRole('combobox', { name: t('textCase.label'), exact: true }).selectOption('lower');
  }
  expect(errors).toEqual([]);
});
