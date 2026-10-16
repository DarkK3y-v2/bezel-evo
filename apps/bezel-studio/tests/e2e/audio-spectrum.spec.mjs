import { test, expect, watchErrors, expectAccessible, clickAddWidget as add, openInspectorTab as tab } from './helpers.mjs';
async function setup(page,t,player=true) {
  await page.goto('/index.html?demo=turing88');
  if(player) await add(page,t,'player');
  await add(page,t,'spectrum'); return page.locator('#inspector');
}
test('spectrum follows one Player; demo, presets, gradients and band thresholds use shared controls',async({page,t})=>{
  const errors=watchErrors(page), inspector=await setup(page,t);
  const follow=inspector.getByRole('combobox',{name:t('spectrum.follow'),exact:true});
  await expect(follow).toHaveValue('');await expect(inspector.getByText(t('spectrum.playerMissing'),{exact:true})).toHaveCount(0);
  await expect(follow.locator('option')).toHaveCount(2);await follow.selectOption({index:1});await expect(follow).not.toHaveValue('');
  const count=inspector.getByRole('spinbutton',{name:t('spectrum.bands'),exact:true});await expect(count).toHaveValue('32');
  await count.fill('48');await count.press('Tab');await expect(count).toHaveValue('48');
  await inspector.getByRole('button',{name:t('spectrum.demo'),exact:true}).click();await expect(inspector.getByText(t('spectrum.demoHint'),{exact:true})).toBeVisible();
  const canvas=inspector.locator('canvas');const before=await canvas.evaluate(c=>c.toDataURL());await expect.poll(()=>canvas.evaluate(c=>c.toDataURL())).not.toBe(before);
  await tab(page,t,'inspector.tab.look');
  await expect(inspector.getByRole('button',{name:t('spectrum.balanced'),exact:true})).toHaveAttribute('aria-pressed','true');
  await expect(inspector.getByRole('switch',{name:t('spectrum.peaks'),exact:true})).toBeChecked();
  await inspector.getByRole('button',{name:t('spectrum.snappy'),exact:true}).click();await expect(inspector.getByRole('button',{name:t('spectrum.snappy'),exact:true})).toHaveAttribute('aria-pressed','true');
  await page.getByRole('button',{name:t('top.undo'),exact:true}).click();await expect(inspector.getByRole('button',{name:t('spectrum.balanced'),exact:true})).toHaveAttribute('aria-pressed','true');
  await inspector.getByRole('combobox',{name:t('inspector.fill'),exact:true}).selectOption('gradient');
  await inspector.getByRole('switch',{name:t('insp.colorByValue'),exact:true}).check();await expect(inspector.getByText(t('spectrum.levelScale'),{exact:true})).toBeVisible();
  await expectAccessible(page);expect(errors).toEqual([]);
});
test('missing Player is explicit and capture permission remains a local preference',async({page,t})=>{
  const errors=watchErrors(page), inspector=await setup(page,t,false);
  await expect(inspector.getByRole('status')).toHaveText(t('spectrum.playerMissing'));
  await expect(inspector.getByText(t('spectrum.browser'),{exact:true})).toBeVisible();
  await page.getByRole('button',{name:t('prefs.title'),exact:true}).click();const dialog=page.getByRole('dialog',{name:t('prefs.title')});
  const consent=dialog.getByRole('switch',{name:t('spectrum.consent'),exact:true});await expect(consent).not.toBeChecked();await expect(dialog.getByText(t('spectrum.privacy'),{exact:true})).toBeVisible();
  await consent.check();await expect(consent).toBeChecked();await expectAccessible(page);
  await dialog.getByRole('button',{name:t('common.done'),exact:true}).click();await page.getByRole('button',{name:t('prefs.title'),exact:true}).click();
  await expect(page.getByRole('switch',{name:t('spectrum.consent'),exact:true})).toBeChecked();expect(errors).toEqual([]);
});
