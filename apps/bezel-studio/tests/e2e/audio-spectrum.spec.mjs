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
  const gain=inspector.getByRole('spinbutton',{name:t('spectrum.gain'),exact:true});await expect(gain).toHaveValue('1');
  await gain.fill('0.5');await gain.press('Tab');await expect(gain).toHaveValue('0.5');await expect(inspector.getByText(t('spectrum.gainHint'),{exact:true})).toBeVisible();
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
test('missing Player is explicit and audio capture is on until turned off locally',async({page,t})=>{
  const errors=watchErrors(page), inspector=await setup(page,t,false);
  await expect(inspector.getByRole('status')).toHaveText(t('spectrum.playerMissing'));
  await expect(inspector.getByText(t('spectrum.browser'),{exact:true})).toBeVisible();
  await page.getByRole('button',{name:t('prefs.title'),exact:true}).click();const dialog=page.getByRole('dialog',{name:t('prefs.title')});
  const consent=dialog.getByRole('switch',{name:t('spectrum.consent'),exact:true});await expect(consent).toBeChecked();await expect(dialog.getByText(t('spectrum.privacy'),{exact:true})).toBeVisible();
  await consent.uncheck();await expect(consent).not.toBeChecked();await expectAccessible(page);
  await dialog.getByRole('button',{name:t('common.done'),exact:true}).click();await page.getByRole('button',{name:t('prefs.title'),exact:true}).click();
  await expect(page.getByRole('switch',{name:t('spectrum.consent'),exact:true})).not.toBeChecked();expect(errors).toEqual([]);
});
test('the bars corners switch between one radius and four, under their own title',async({page,t})=>{
  const errors=watchErrors(page), inspector=await setup(page,t);await tab(page,t,'inspector.tab.look');
  await expect(inspector.getByRole('heading',{name:t('insp.cornersTitle'),exact:true})).toBeVisible();
  await expect(inspector.getByRole('heading',{name:t('insp.corners'),exact:true})).toHaveCount(0);
  const same=inspector.getByRole('button',{name:t('insp.cornersSame'),exact:true}), each=inspector.getByRole('button',{name:t('insp.cornersEach'),exact:true});
  const control=inspector.locator('.corner-radii');
  await expect(same).toHaveAttribute('aria-pressed','true');await expect(control.getByRole('spinbutton')).toHaveCount(1);
  await each.click();await expect(each).toHaveAttribute('aria-pressed','true');await expect(control.getByRole('spinbutton')).toHaveCount(4);
  await same.click();await expect(same).toHaveAttribute('aria-pressed','true');await expect(control.getByRole('spinbutton')).toHaveCount(1);
  expect(errors).toEqual([]);
});
test('each style shows only its own fields, one Undo step per change (D-AS-11)',async({page,t})=>{
  const errors=watchErrors(page), inspector=await setup(page,t);
  await inspector.getByRole('button',{name:t('spectrum.demo'),exact:true}).click();
  await tab(page,t,'inspector.tab.look');
  const style=inspector.getByRole('combobox',{name:t('spectrum.style'),exact:true});await expect(style).toHaveValue('mirrored');
  const field=name=>inspector.getByRole('spinbutton',{name:t(name),exact:true});
  const toggle=name=>inspector.getByRole('switch',{name:t(name),exact:true});
  await expect(toggle('spectrum.centre')).toBeVisible();await expect(field('spectrum.block')).toHaveCount(0);
  await style.selectOption('blocks');await expect(field('spectrum.block')).toHaveValue('6');
  await expect(inspector.getByText(t('spectrum.blockColors'),{exact:true})).toBeVisible();await expect(toggle('spectrum.centre')).toHaveCount(0);
  await style.selectOption('line');await expect(field('spectrum.stroke')).toHaveValue('2');await expect(toggle('spectrum.fill')).toBeChecked();
  await expect(field('spectrum.thickness')).toHaveCount(0);await expect(toggle('spectrum.peaks')).toHaveCount(0);
  await expect(inspector.getByRole('heading',{name:t('insp.cornersTitle'),exact:true})).toHaveCount(0);
  await style.selectOption('radial');await expect(field('spectrum.inner')).toHaveValue('40');await expect(toggle('spectrum.ring')).toBeVisible();
  await style.selectOption('bars');await expect(toggle('spectrum.baseline')).toBeVisible();
  await page.getByRole('button',{name:t('top.undo'),exact:true}).click();await expect(style).toHaveValue('radial');
  await expectAccessible(page);expect(errors).toEqual([]);
});
