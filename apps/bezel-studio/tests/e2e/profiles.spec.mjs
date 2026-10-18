import { test, expect, watchErrors, expectAccessible, libraryTabKey } from './helpers.mjs';

async function openProfiles(page, t) {
  await page.getByRole('tab', { name: t(libraryTabKey('themes')), exact: true }).click();
  await page.locator('#theme-profiles').click();
  return page.getByRole('dialog', { name: t('profiles.title'), exact: true });
}

test('profiles are managed from Themes and saved independently of the editor', async ({ page, t }, info) => {
  const errors = watchErrors(page);
  await page.goto('/index.html?demo=turing88');
  const original = await page.locator('#theme-name').inputValue();
  let dialog = await openProfiles(page, t);
  await expect(dialog.getByText(t('profiles.empty'))).toBeVisible();
  await dialog.getByRole('button', { name: t('profiles.add'), exact: true }).click();
  let profile = dialog.locator('.profile-editor');
  await profile.getByRole('textbox', { name: t('common.name'), exact: true }).fill('Music');
  await profile.getByRole('button', { name: t('profiles.addRule'), exact: true }).click();
  await profile.getByRole('textbox', { name: t('profiles.app'), exact: true }).fill('Spotify');
  await profile.getByRole('spinbutton', { name: t('trigger.priority'), exact: true }).fill('30');
  await profile.getByRole('spinbutton', { name: t('profiles.returnDelay'), exact: true }).fill('5');
  const id = await profile.getAttribute('data-profile');
  await dialog.getByRole('combobox', { name: t('profiles.mode'), exact: true }).selectOption(id);
  await dialog.getByRole('combobox', { name: t('profiles.fallback'), exact: true }).selectOption(id);
  await expectAccessible(page);
  if (info.project.name === 'dark-en') await dialog.screenshot({ path: '../../dist/profiles-editor.png' });
  await dialog.getByRole('button', { name: t('common.save'), exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.locator('#theme-name')).toHaveValue(original);
  dialog = await openProfiles(page, t);
  profile = dialog.locator('.profile-editor');
  await expect(profile.getByRole('textbox', { name: t('common.name'), exact: true })).toHaveValue('Music');
  await expect(profile.getByRole('spinbutton', { name: t('trigger.priority'), exact: true })).toHaveValue('30');
  await expect(profile.getByRole('spinbutton', { name: t('profiles.returnDelay'), exact: true })).toHaveValue('5');
  await expect(dialog.getByRole('combobox', { name: t('profiles.mode'), exact: true })).toHaveValue(id);
  await profile.getByRole('button', { name: t('profiles.remove'), exact: true }).click();
  await expect(dialog.getByRole('combobox', { name: t('profiles.mode'), exact: true })).toHaveValue('default');
  await expect(dialog.getByRole('combobox', { name: t('profiles.fallback'), exact: true })).toHaveValue('');
  await dialog.getByRole('button', { name: t('common.save'), exact: true }).click();
  dialog = await openProfiles(page, t);
  await expect(dialog.locator('.profile-editor')).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(page.locator('#theme-profiles')).toBeFocused();
  expect(errors).toEqual([]);
});

test('System separates audio and power, shows text in full and omits uptime sparklines', async ({ page, t }, info) => {
  const errors = watchErrors(page);
  await page.goto('/index.html?demo=turing88');
  await page.getByRole('tab', { name: t(libraryTabKey('sensors')), exact: true }).click();
  await page.locator('#sensor-filter [data-category="system"]').click();
  const panel = page.locator('#panel-sensors');
  await expect(panel.locator('.sensor-subgroup')).toHaveText([t('sensorsPanel.group.system'), t('sensorsPanel.group.audio'), t('sensorsPanel.group.power')]);
  const host = panel.locator('[data-key="system.hostname"] .value');
  await expect(host).toHaveText('bezel-demo-workstation');
  await expect(host).toHaveAttribute('title', 'bezel-demo-workstation');
  await expect(panel.locator('[data-key="system.audio.muted"] .value')).toHaveText(t('sensorsPanel.state.off'));
  await expect(panel.locator('[data-key="system.power.ac"] .value')).toHaveText(t('sensorsPanel.state.on'));
  await expect(panel.locator('[data-key="system.uptime"] svg')).toHaveCount(0);
  await expect(panel.locator('.sensor-row-text svg')).toHaveCount(0);
  await expectAccessible(page);
  if (info.project.name === 'dark-en') await panel.screenshot({ path: '../../dist/system-sensors.png' });
  expect(errors).toEqual([]);
});
