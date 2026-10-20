import { test, expect, watchErrors, expectAccessible, copyAndPaste, pickSensor } from './helpers.mjs';

test('native visualization presets, scoped controls, second sensor and Undo',async({page,t})=>{
  const errors=watchErrors(page);
  await page.goto('/index.html?demo=turing88');
  const detail=page.locator('#inspector');
  const add=async kind=>{
    await page.getByRole('button',{name:t('library.addWidget',{name:t(`widget.${kind}`)}),exact:true}).click();
    await detail.getByRole('tab',{name:t('inspector.tab.look'),exact:true}).click();
  };
  const preset=()=>detail.getByRole('combobox',{name:t('visual.preset'),exact:true});
  await add('bar');await preset().selectOption('matrix');
  await detail.getByRole('spinbutton',{name:t('visual.columns'),exact:true}).fill('12');
  await detail.getByRole('spinbutton',{name:t('visual.columns'),exact:true}).dispatchEvent('change');
  await copyAndPaste(page);
  await expect(preset()).toHaveValue('matrix');
  await expect(detail.getByRole('spinbutton',{name:t('visual.columns'),exact:true})).toHaveValue('12');
  await preset().selectOption('standard');await page.locator('#undo').click();
  await expect(preset()).toHaveValue('matrix');
  await add('ring');await preset().selectOption('pixel');
  await expect(detail.getByRole('spinbutton',{name:t('visual.rows'),exact:true})).toHaveCount(0);
  await preset().selectOption('dial');
  await detail.getByRole('switch',{name:t('visual.marker'),exact:true}).uncheck();
  await add('graph');await preset().selectOption('mirrored');
  await detail.getByRole('tab',{name:t('inspector.tab.data'),exact:true}).click();
  await expect(detail.getByRole('combobox',{name:t('visual.secondary'),exact:true})).toBeVisible();
  await pickSensor(page,t,detail,'gpu.usage',t('visual.secondary'));
  await expect(detail.getByRole('combobox',{name:t('visual.secondary'),exact:true})).toHaveAttribute('data-sensor-key','gpu.usage');
  await expectAccessible(page);expect(errors).toEqual([]);
});
