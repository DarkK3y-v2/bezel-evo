import { test, expect, watchErrors, expectAccessible, clickAddWidget as add } from './helpers.mjs';

test('value transitions offer inertia with settling time and undo',async({page,t},info)=>{
  const errors=watchErrors(page);
  await page.goto('/index.html?demo=turing88');
  await add(page,t,'value');
  const section=page.locator('[data-section="transition"]');
  await section.getByRole('button',{name:t('insp.transitionInertia'),exact:true}).click();
  await expect(section.getByRole('button',{name:t('insp.transitionInertia'),exact:true})).toHaveAttribute('aria-pressed','true');
  await expect(section).toContainText(t('insp.transitionSettling'));
  await expect(section).toContainText(t('insp.transitionInertiaHint'));
  const slider=section.getByRole('slider');
  await slider.press('ArrowRight');
  await expect(section.locator('output')).toHaveText('450 ms');
  await page.locator('#undo').click();
  await expect(section.locator('output')).toHaveText('400 ms');
  await page.locator('#undo').click();
  await expect(section.getByRole('button',{name:t('insp.transitionSmooth'),exact:true})).toHaveAttribute('aria-pressed','true');
  await section.getByRole('button',{name:t('insp.transitionInertia'),exact:true}).click();
  await expectAccessible(page);
  await section.screenshot({path:info.outputPath('value-inertia.png')});
  expect(errors).toEqual([]);
});
