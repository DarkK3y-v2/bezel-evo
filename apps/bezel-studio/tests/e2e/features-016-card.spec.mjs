// Features of 0.1.0-dev.016 in the card's inspector: trigger edits,
// priorities and target faces survive Undo.
import { test, expect, watchErrors, expectAccessible, clickAddWidget as add, openInspectorTab as tab } from './helpers.mjs';
test('card trigger edits, priorities and target faces survive Undo',async ({page,t})=>{
 const errors=watchErrors(page);await page.goto('/index.html?demo=turing88');await add(page,t,'card');
 const inspector=page.locator('#inspector');await tab(page,t,'card.tab.triggers');await expect(inspector.getByRole('button',{name:t('trigger.add'),exact:true})).toBeDisabled();
 await tab(page,t,'card.tab.faces');await inspector.getByRole('button',{name:t('card.addFace'),exact:true}).click();
 await tab(page,t,'card.tab.triggers');await inspector.getByRole('button',{name:t('trigger.add'),exact:true}).click();
 const condition=inspector.getByRole('combobox',{name:t('trigger.condition'),exact:true});await expect(condition).toHaveValue('mediaPlaying');
 await condition.selectOption('foreground');await expect(condition).toHaveValue('foreground');
 const priority=inspector.getByRole('spinbutton',{name:t('trigger.priority'),exact:true});await priority.fill('7');await priority.press('Tab');await expect(priority).toHaveValue('7');
 await page.locator('#undo').click();await expect(priority).toHaveValue('0');
 await inspector.getByRole('button',{name:t('trigger.remove'),exact:true}).click();await expect(condition).toHaveCount(0);
 await expectAccessible(page);expect(errors).toEqual([]);
});
