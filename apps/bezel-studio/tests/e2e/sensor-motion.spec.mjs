import { test, expect, watchErrors, expectAccessible, clickAddWidget as add } from './helpers.mjs';

test('sensor motion animates a custom shape, edits its response, and survives undo', async ({page,t},info) => {
  const errors=watchErrors(page);
  await page.goto('/index.html?demo=turing88');
  await add(page,t,'shape');
  const inspector=page.locator('#inspector');
  const toggle=inspector.getByRole('switch',{name:t('insp.sensorMotionEnabled'),exact:true});
  await toggle.check();
  const source=inspector.getByRole('combobox',{name:t('insp.motionSource'),exact:true});
  await source.selectOption('cpu.usage');
  const reference=inspector.getByRole('spinbutton',{name:t('insp.motionReference'),exact:true});
  await reference.fill('100'); await reference.press('Tab');
  await expect(source).toHaveValue('cpu.usage');
  const pixels=()=>inspector.locator('.inspector-preview canvas').evaluate(canvas=>canvas.toDataURL());
  await expect(inspector.locator('.inspector-preview canvas')).toBeVisible();
  const first=await pixels();
  await expect.poll(pixels).not.toBe(first);
  await inspector.getByRole('switch',{name:t('insp.motionReverse'),exact:true}).check();
  await expect(inspector.getByRole('switch',{name:t('insp.motionReverse'),exact:true})).toBeChecked();
  await page.locator('#undo').click();
  await expect(inspector.getByRole('switch',{name:t('insp.motionReverse'),exact:true})).not.toBeChecked();
  await expectAccessible(page);
  await inspector.locator('[data-section="sensor-motion"]').scrollIntoViewIfNeeded();
  await page.screenshot({path:info.outputPath('sensor-motion.png')});
  await toggle.uncheck();
  await expect(source).toHaveCount(0);
  expect(errors).toEqual([]);
});
