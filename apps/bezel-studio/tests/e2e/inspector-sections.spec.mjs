import { test, expect, watchErrors, expectAccessible } from './helpers.mjs';

const addWidget = async (page, t, widget) => {
  await page.locator('#tab-widgets').click();
  await page.getByRole('button', { name: t('library.addWidget', { name: t(`widget.${widget}`) }), exact: true }).click();
};

test('object properties are Data and Look tabs, kept per kind through edits and Undo', async ({ page, t }) => {
  const errors = watchErrors(page);
  await page.goto('/index.html?demo=turing88');
  await addWidget(page, t, 'ring');
  await page.locator('#save').click();
  await expect(page.locator('#status-main')).toHaveText(t('status.saved'));
  const inspector = page.locator('#inspector');
  const tabs = inspector.getByRole('tablist', { name: t('inspector.tabs'), exact: true }).getByRole('tab');
  await expect(tabs).toHaveText([t('inspector.tab.data'), t('inspector.tab.look')]);
  await expect(tabs.first()).toHaveAttribute('aria-selected', 'true');
  // Geometry leads every object's properties, before preview and tabs.
  const order = () => inspector.locator(':scope > *').evaluateAll(nodes => nodes.map(n => n.dataset.section ?? n.getAttribute('role') ?? n.className));
  expect(await order()).toEqual(['inspector-head', 'actions', 'position', 'inspector-preview', 'tablist', 'tabpanel', 'tabpanel']);
  await expect(inspector.locator('[data-section="arc"]')).toBeVisible();
  const more = inspector.getByRole('button', { name: t('insp.more'), exact: true });
  const actions = inspector.locator('#inspector-actions');
  await expect(more).toHaveAttribute('aria-expanded', 'false');
  await expect(actions).toBeHidden();
  await more.click();
  await expect(more).toHaveAttribute('aria-expanded', 'true');
  await expect(actions.getByRole('button', { name: t('common.duplicate'), exact: true })).toBeVisible();
  await more.click();
  await expect(actions).toBeHidden();
  const fillMode = inspector.getByRole('combobox', { name: t('ring.fillMode'), exact: true });
  await expect(inspector.getByRole('combobox', { name: t('inspector.sensor'), exact: true })).toBeVisible();
  await expect(fillMode).toHaveCount(0);

  const look = inspector.getByRole('tab', { name: t('inspector.tab.look'), exact: true });
  await look.click();
  await expect(look).toHaveAttribute('aria-selected', 'true');
  await expect(inspector.getByRole('tabpanel', { name: t('inspector.tab.look'), exact: true })).toBeVisible();
  await expect(fillMode).toBeVisible();
  await expect(page.locator('#status-main')).toHaveText(t('status.saved'));

  // An edit and its Undo draw the form again: the Look tab stays open.
  const x = inspector.getByRole('spinbutton', { name: t('inspector.x'), exact: true });
  const before = await x.inputValue();
  await x.fill('60'); await x.press('Tab');
  await expect(x).toHaveValue('60'); await expect(look).toHaveAttribute('aria-selected', 'true');
  await page.locator('#undo').click();
  await expect(x).toHaveValue(before); await expect(look).toHaveAttribute('aria-selected', 'true');
  await expect(fillMode).toBeVisible();

  // Arrow keys move between the tabs (ARIA tabs), Home and End to the ends.
  await look.focus();
  await page.keyboard.press('ArrowRight');
  const data = inspector.getByRole('tab', { name: t('inspector.tab.data'), exact: true });
  await expect(data).toHaveAttribute('aria-selected', 'true');
  await expect(data).toBeFocused();
  await page.keyboard.press('End');
  await expect(look).toBeFocused(); await expect(look).toHaveAttribute('aria-selected', 'true');
  await page.keyboard.press('Home');
  await expect(data).toBeFocused();
  await page.keyboard.press('End');

  // Another kind opens on its own first tab; the ring comes back on Look.
  const ring = await inspector.getByLabel(t('common.name'), { exact: true }).inputValue();
  await addWidget(page, t, 'bar');
  await expect(inspector.getByRole('tab', { name: t('inspector.tab.data'), exact: true })).toHaveAttribute('aria-selected', 'true');
  expect((await order()).slice(0, 5)).toEqual(['inspector-head', 'actions', 'position', 'inspector-preview', 'tablist']);
  // Graph, Player and spectrum follow exactly the same area order.
  for (const widget of ['graph', 'player', 'spectrum']) {
    await addWidget(page, t, widget);
    expect(await order()).toEqual(['inspector-head', 'actions', 'position', 'inspector-preview', 'tablist', 'tabpanel', 'tabpanel']);
  }
  await page.locator('#tab-layers').click();
  await page.locator('.layer-name').filter({ hasText: ring }).first().click();
  await expect(inspector.getByLabel(t('common.name'), { exact: true })).toHaveValue(ring);
  await expect(inspector.getByRole('tab', { name: t('inspector.tab.look'), exact: true })).toHaveAttribute('aria-selected', 'true');
  await expectAccessible(page); expect(errors).toEqual([]);
});

test('the preview shows the selected object rendered alone, on or off the canvas', async ({ page, t }) => {
  const errors = watchErrors(page);
  await page.goto('/index.html?demo=turing88');
  await addWidget(page, t, 'ring');
  const inspector = page.locator('#inspector');
  const name = await inspector.getByLabel(t('common.name'), { exact: true }).inputValue();
  const preview = inspector.getByRole('img', { name: t('inspector.previewOf', { name }), exact: true });
  await expect(preview).toBeVisible();
  await expect(inspector.locator('.inspector-preview')).toContainText(t('inspector.previewLive'));
  await expect.poll(() => preview.evaluate(canvas => {
    if (canvas.width < 8 || canvas.height < 8) return false;
    const pixels = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
    return pixels.some((v, i) => i % 4 === 3 && v > 0);
  })).toBe(true);
  // Rendered alone, it shows even moved off the canvas.
  const x = inspector.getByRole('spinbutton', { name: t('inspector.x'), exact: true });
  await x.fill('5000'); await x.press('Tab');
  await expect(x).toHaveValue('5000');
  await expect(preview).toBeVisible();
  await expect(inspector.locator('.inspector-preview-off')).toBeHidden();
  await expect.poll(() => preview.evaluate(canvas => canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data.some((v, i) => i % 4 === 3 && v > 0))).toBe(true);
  await page.locator('#undo').click();
  await expect(preview).toBeVisible();
  await expectAccessible(page); expect(errors).toEqual([]);
});

test('a card has Faces, Motion, Triggers and Look tabs; its faces are a list, the one in view marked', async ({ page, t }) => {
  const errors = watchErrors(page);
  await page.goto('/index.html?demo=turing88');
  await addWidget(page, t, 'card');
  const inspector = page.locator('#inspector');
  // Cards keep the same geometry-first order as ordinary objects.
  expect((await inspector.locator(':scope > *').evaluateAll(nodes => nodes.map(n => n.dataset.section ?? n.getAttribute('role') ?? n.className))).slice(0, 5))
    .toEqual(['inspector-head', 'actions', 'position', 'inspector-preview', 'tablist']);
  const tabs = inspector.getByRole('tablist', { name: t('card.tabs'), exact: true }).getByRole('tab');
  await expect(tabs).toHaveText([t('card.tab.faces'), t('card.tab.motion'), t('card.tab.triggers'), t('inspector.tab.look')]);
  const faces = inspector.getByRole('list', { name: t('card.tab.faces'), exact: true });
  await inspector.getByRole('button', { name: t('card.addFace'), exact: true }).click();
  const current = faces.locator('[aria-current="true"]');
  await expect(current).toHaveAttribute('data-face', '1');
  await expect(current).toContainText(t('layers.inView'));
  await faces.getByRole('button', { name: t('cardInsp.editFace', { name: t('card.faceName', { number: 1 }) }), exact: true }).click();
  await expect(current).toHaveAttribute('data-face', '0');
  await expect(faces.getByText(t('layers.inView'), { exact: true })).toHaveCount(1);
  await inspector.getByRole('tab', { name: t('card.tab.motion'), exact: true }).click();
  await expect(inspector.getByRole('button', { name: t('card.animateNext'), exact: true })).toBeEnabled();
  await inspector.getByRole('tab', { name: t('card.tab.triggers'), exact: true }).click();
  await expect(inspector.getByRole('button', { name: t('trigger.add'), exact: true })).toBeEnabled();
  await expectAccessible(page); expect(errors).toEqual([]);
});
