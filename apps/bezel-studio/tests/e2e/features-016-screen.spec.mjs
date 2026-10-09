// Features of 0.1.0-dev.016 in the screen panel: the sleep timer is
// discoverable, defaults to five minutes and remembers edits.
import { test, expect, watchErrors, expectAccessible } from './helpers.mjs';
test('sleep timer is discoverable, defaults to five and remembers edits',async ({page,t})=>{
 const errors=watchErrors(page);await page.goto('/index.html?demo=turing88');await expect(page.locator('#theme-name')).toHaveValue('Demo');
 await page.locator('#tab-screen').click();await page.locator('#configure-sleep-timer').click();
 const dialog=page.getByRole('dialog',{name:t('standby.off.title'),exact:true});const minutes=dialog.getByRole('combobox',{name:t('standby.off.minutes'),exact:true});
 await expect(minutes).toHaveValue('5');await minutes.selectOption('7');await dialog.getByRole('button',{name:t('standby.write'),exact:true}).click();
 await expect(dialog).toHaveCount(0);await page.locator('#configure-sleep-timer').click();await expect(minutes).toHaveValue('7');await dialog.getByRole('button',{name:t('dialog.cancel'),exact:true}).click();
 await expectAccessible(page);expect(errors).toEqual([]);
});
