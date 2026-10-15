import { test, expect, watchErrors, expectAccessible } from './helpers.mjs';

// One corner-radius control everywhere (D-2026-10-15-studio-redesign-fidelity-22):
// the drawing of the object's corners with the shared radius beside it, or
// a field at each corner, in shapes, bars and the player's cover.
const addWidget = async (page, t, widget) => {
  await page.locator('#tab-widgets').click();
  await page.getByRole('button', { name: t('library.addWidget', { name: t(`widget.${widget}`) }), exact: true }).click();
};
const radiusOf = (control) => control.locator('.corner-shape').evaluate((node) => getComputedStyle(node).borderTopLeftRadius);
const lit = (control, corner) => control.locator(`.corner-mark[data-corner="${corner}"]`).evaluate((node) => getComputedStyle(node).opacity);

test('shapes, bars and the player cover share the corner control, by mouse and keyboard', async ({ page, t }) => {
  const errors = watchErrors(page);
  await page.goto('/index.html?demo=turing88');
  const inspector = page.locator('#inspector');
  const look = () => inspector.getByRole('tab', { name: t('inspector.tab.look'), exact: true });

  // Shape: one radius drawn beside its field, then each corner its own.
  await addWidget(page, t, 'shape');
  let control = inspector.getByRole('group', { name: t('inspector.radius'), exact: true });
  await expect(control).toHaveAttribute('data-mode', 'same');
  const radius = control.getByRole('spinbutton', { name: t('inspector.radius'), exact: true });
  await radius.fill('12'); await radius.press('Tab');
  await expect(radius).toHaveValue('12');
  const drawn = await radiusOf(control);
  expect(parseFloat(drawn)).toBeGreaterThan(0);
  await inspector.getByRole('button', { name: t('insp.cornersEach'), exact: true }).click();
  await expect(control).toHaveAttribute('data-mode', 'each');
  const corners = control.getByRole('spinbutton');
  await expect(corners).toHaveCount(4);
  for (const name of ['topLeft', 'topRight', 'bottomRight', 'bottomLeft']) {
    await expect(control.getByRole('spinbutton', { name: t(`inspector.${name}`), exact: true })).toHaveValue('12');
  }
  // Tab goes through the corners in reading order; the focused one lights its corner.
  const tl = control.getByRole('spinbutton', { name: t('inspector.topLeft'), exact: true });
  await tl.focus();
  expect(await lit(control, 'topLeft')).toBe('1');
  expect(await lit(control, 'bottomRight')).toBe('0');
  await page.keyboard.press('Tab');
  await expect(control.getByRole('spinbutton', { name: t('inspector.topRight'), exact: true })).toBeFocused();
  await tl.fill('0'); await tl.press('Tab');
  expect(await radiusOf(control)).toBe('0px');
  await expect(control.getByRole('spinbutton', { name: t('inspector.topRight'), exact: true })).toHaveValue('12');
  await page.locator('#undo').click();
  await expect(tl).toHaveValue('12');
  await inspector.getByRole('button', { name: t('insp.cornersSame'), exact: true }).click();
  await expect(control.getByRole('spinbutton', { name: t('inspector.radius'), exact: true })).toHaveValue('12');
  // An ellipse has no corners.
  await inspector.getByRole('button', { name: t('shape.ellipse'), exact: true }).click();
  await expect(inspector.locator('.corner-radii')).toHaveCount(0);

  // Bar: one radius only, the same drawing.
  await addWidget(page, t, 'bar');
  await look().click();
  control = inspector.getByRole('group', { name: t('inspector.radius'), exact: true });
  await expect(control.locator('.corner-shape')).toBeVisible();
  await expect(inspector.getByRole('button', { name: t('insp.cornersEach'), exact: true })).toHaveCount(0);
  await control.getByRole('spinbutton', { name: t('inspector.radius'), exact: true }).fill('3');
  await control.getByRole('spinbutton', { name: t('inspector.radius'), exact: true }).press('Tab');
  await expect(control.getByRole('spinbutton', { name: t('inspector.radius'), exact: true })).toHaveValue('3');

  // Player cover: the same control, under its own title.
  await addWidget(page, t, 'player');
  await look().click();
  control = inspector.getByRole('group', { name: t('player.coverRadius'), exact: true });
  await expect(control.locator('.corner-shape')).toBeVisible();
  await inspector.getByRole('button', { name: t('insp.cornersEach'), exact: true }).click();
  await expect(control.getByRole('spinbutton')).toHaveCount(4);
  // Only one corner control in the whole inspector, and the old ones are gone.
  await expect(inspector.locator('.corner-radii')).toHaveCount(1);
  await expect(inspector.locator('.corner-grid, .corner-cover')).toHaveCount(0);
  await expectAccessible(page);
  expect(errors).toEqual([]);
});
