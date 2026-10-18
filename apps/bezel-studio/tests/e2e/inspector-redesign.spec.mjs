import { test, expect, clickAddWidget, expectAccessible, watchErrors } from './helpers.mjs';

test('all widget inspectors separate navigation from geometry and keep integrated labels readable', async ({ page, t }) => {
  const errors = watchErrors(page);
  await page.goto('/index.html?demo=turing88');
  await expect(page.locator('#theme-name')).toHaveValue('Demo');
  const inspector = page.locator('#inspector');
  for (const kind of ['value', 'text', 'clock', 'weather', 'bar', 'ring', 'needle', 'graph', 'spectrum', 'player', 'image', 'shape', 'card']) {
    await page.locator('#tab-widgets').click();
    await clickAddWidget(page, t, kind);
    const position = inspector.locator(':scope > [data-section="position"]');
    const geometry = position.locator('.geometry-fields');
    await expect(geometry.getByRole('spinbutton')).toHaveCount(4);
    await expect(geometry.locator('.fld-prefix')).toHaveText([t('insp.xPrefix'), t('insp.yPrefix'), t('insp.widthLabel'), t('insp.heightLabel')]);
    expect(await geometry.locator('input').evaluateAll(nodes => nodes.every(node => node.clientWidth >= 38))).toBe(true);
    expect(await inspector.evaluate(node => node.scrollWidth <= node.clientWidth + 1)).toBe(true);
    const tabs = inspector.getByRole('tablist');
    if (await tabs.count()) {
      const gap = await tabs.evaluate(node => node.getBoundingClientRect().top - node.previousElementSibling.getBoundingClientRect().bottom);
      expect(gap).toBeGreaterThanOrEqual(24);
      for (const tab of await tabs.getByRole('tab').all()) {
        await tab.click();
        await expect(position).toBeVisible();
        await expect(inspector.locator(':scope > .inspector-preview')).toBeVisible();
        await expect(inspector.locator(':scope > [data-section="membership"]')).toBeVisible();
        expect(await inspector.evaluate(node => node.scrollWidth <= node.clientWidth + 1)).toBe(true);
      }
    }
  }
  await expectAccessible(page);
  expect(errors).toEqual([]);
});

test('sensor formatting offers temperature controls only for temperatures and transition readouts stay compact', async ({ page, t }) => {
  const errors = watchErrors(page);
  await page.goto('/index.html?demo=turing88');
  await expect(page.locator('#theme-name')).toHaveValue('Demo');
  await clickAddWidget(page, t, 'value');
  const inspector = page.locator('#inspector');
  const source = inspector.getByRole('combobox', { name: t('inspector.sensor'), exact: true });
  await source.selectOption('gpu.usage');
  await expect(inspector.getByRole('switch', { name: t('inspector.fahrenheit'), exact: true })).toHaveCount(0);
  await source.selectOption('cpu.temperature');
  await expect(inspector.getByRole('switch', { name: t('inspector.fahrenheit'), exact: true })).toBeVisible();
  const toggle = inspector.getByRole('switch', { name: t('inspector.showUnit'), exact: true });
  expect(await toggle.evaluate(input => ['none', 'normal'].includes(getComputedStyle(input.parentElement.querySelector('span'), '::before').content))).toBe(true);
  const transition = inspector.locator('[data-section="transition"]');
  await transition.getByRole('button', { name: t('insp.transitionSmooth'), exact: true }).click();
  await expect(transition.locator('.slider-field-inline output')).toHaveText('400 ms');
  await transition.getByRole('button', { name: t('fade.none'), exact: true }).click();
  await expect(transition.getByRole('slider')).toHaveCount(0);
  await transition.getByRole('button', { name: t('insp.transitionSmooth'), exact: true }).click();
  await source.selectOption('gpu.usage');
  for (const tab of ['data', 'look']) {
    await inspector.getByRole('tab', { name: t(`inspector.tab.${tab}`), exact: true }).click();
    await expectAccessible(page);
    await inspector.evaluate(node => { node.style.height = `${node.scrollHeight}px`; node.style.maxHeight = 'none'; node.style.flex = 'none'; node.scrollTop = 0; });
    await page.locator('.statusbar').evaluate(node => { node.style.visibility = 'hidden'; });
    await inspector.screenshot({ path: test.info().outputPath(`inspector-${tab}.png`) });
  }
  expect(errors).toEqual([]);
});
