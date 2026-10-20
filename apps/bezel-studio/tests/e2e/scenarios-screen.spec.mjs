// The screen in demo mode, in pt-BR and en, light and dark: live mode and
// start at login, a denied port shows its access error on
// the stage), a panel in desktop mode goes back only after a dialog, a hung
// screen is restarted after one, a live screen that drops is connected
// again, saying so, and the Screen panel shows only the screen chosen at the
// top.
import { test, expect, watchErrors, expectAccessible } from './helpers.mjs';

test('without a screen, live mode explains itself', async ({ page, t }) => {
  const errors = watchErrors(page);
  await page.goto('/index.html?demo=empty');
  await expect(page.locator('#screen-select')).toContainText(t('top.noScreen'));
  const connect = page.getByRole('region', { name: t('connect.title') });
  await expect(connect).toBeVisible();
  await expect(connect).toContainText(t('connect.devices.searching'));
  await page.getByRole('switch').click({ force: true });
  await expect(page.locator('#toast')).toHaveText(t('toast.noScreen'));
  await expect(page.getByRole('switch')).not.toBeChecked();
  await page.getByRole('tab', { name: t('library.screen') }).click();
  await expect(page.locator('#screen-panel')).toContainText(t('screen.none'));
  await expectAccessible(page);
  await page.goto('/index.html?demo=error');
  await expect(page.locator('#status-device')).toContainText('permission denied');
  await expect(page.getByRole('region', { name: t('connect.title') }).getByRole('alert')).toContainText('permission denied');
  expect(errors).toEqual([]);
});

test('live mode and start at login', async ({ page, t }) => {
  const errors = watchErrors(page);
  await page.goto('/index.html?demo=turing88');
  await expect(page.locator('#theme-name')).toHaveValue('Demo');
  await page.getByRole('switch').click({ force: true });
  await expect(page.getByRole('switch')).toBeChecked();
  await expect(page.locator('#status-device')).toHaveText(t('status.live'));
  await page.getByRole('tab', { name: t('library.screen') }).click();
  const autostart = page.getByRole('checkbox', { name: t('screenPanel.autostart'), exact: true });
  await autostart.check();
  await expect(autostart).toBeChecked();
  await page.getByRole('switch').click({ force: true });
  await expect(page.getByRole('switch')).not.toBeChecked();
  await expectAccessible(page);
  expect(errors).toEqual([]);
});

test('the Screen panel shows only the screen chosen at the top', async ({ page, t }) => {
  const errors = watchErrors(page);
  await page.goto('/index.html?demo=two');
  await expect(page.locator('#theme-name')).toHaveValue('Demo');
  await page.getByRole('tab', { name: t('library.screen') }).click();
  const panel = page.locator('#panel-screen');
  const names = { '/dev/ttyACM1': 'Turing Smart Screen 8.8"', COM3: 'COM3' };
  const picker = page.locator('#screen-select');
  const first = await picker.inputValue();
  const second = Object.keys(names).find((key) => key !== first);
  const slider = panel.getByRole('slider', { name: t('screen.brightness') });
  const autostart = panel.getByRole('checkbox', { name: t('screenPanel.autostart'), exact: true });
  const advanced = panel.getByRole('group', { name: t('screen.advanced'), exact: true });
  // Only the chosen screen: one card, one brightness, one set of advanced actions.
  await expect(panel.locator('.screen-block')).toHaveCount(1);
  await expect(panel.getByRole('region', { name: names[first], exact: true })).toBeVisible();
  await expect(panel.getByRole('region', { name: names[second], exact: true })).toHaveCount(0);
  await expect(panel.locator('.screen-card .meta')).toHaveText(new RegExp(`^${first.replace(/[/.]/g, '\$&')} · `));
  await expect(slider).toHaveCount(1);
  await expect(advanced).toHaveCount(1);
  await expect(autostart).toBeVisible();
  await slider.fill('40');
  await expect(slider).toHaveValue('40');
  await expectAccessible(page);

  // The other screen shows once chosen at the top, with its own brightness.
  await picker.selectOption(second);
  await expect(panel.getByRole('region', { name: names[second], exact: true })).toBeVisible();
  await expect(panel.getByRole('region', { name: names[first], exact: true })).toHaveCount(0);
  await expect(panel.locator('.screen-block')).toHaveCount(1);
  await expect(panel.locator('.screen-card .meta')).toHaveText(new RegExp(`^${second.replace(/[/.]/g, '\$&')} · `));
  await expect(slider).toHaveCount(1);
  await expect(slider).toHaveValue('70');
  await expect(advanced).toHaveCount(1);
  await expect(autostart).toBeVisible();
  await expectAccessible(page);

  // And back: the first keeps the level set on it.
  await picker.selectOption(first);
  await expect(panel.getByRole('region', { name: names[first], exact: true })).toBeVisible();
  await expect(slider).toHaveValue('40');
  expect(errors).toEqual([]);
});


test('a panel in desktop mode is labelled and switched back only after a dialog', async ({ page, t }) => {
  const errors = watchErrors(page);
  const key = 'hid:/dev/hidraw7';
  await page.goto('/index.html?demo=desktop');
  await expect(page.locator('#theme-name')).toHaveValue('Demo');
  await page.getByRole('tab', { name: t('library.screen') }).click();
  const panel = page.getByRole('group', { name: t('desktop.cardLabel', { address: key }) });
  await expect(panel).toContainText(t('desktop.notValidated'));
  await expect(panel).toContainText('Turing 8.8" V1.x (USB)');
  await expectAccessible(page);

  const leave = panel.getByRole('button', { name: t('desktop.leave') });
  await leave.click();
  const dialog = page.getByRole('dialog', { name: t('desktop.confirmTitle', { address: key }) });
  await expect(dialog).toContainText(t('desktop.confirmRisk'));
  // Not validated: the safe answer has the focus.
  await expect(dialog.getByRole('button', { name: t('dialog.cancel') })).toBeFocused();
  await expectAccessible(page);
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(leave).toBeFocused();
  await expect(panel).toBeVisible();

  await leave.click();
  await dialog.getByRole('button', { name: t('desktop.confirmAction') }).click();
  await expect(page.locator('#toast')).toHaveText(t('desktop.doneModel', { model: 'Turing 8.8" V1.x (USB)' }));
  await expect(panel).toHaveCount(0);
  await expect(page.locator('#screen-select option')).toHaveCount(2);
  expect(errors).toEqual([]);
});

test('a hung screen offers the restart, which asks first and brings it back', async ({ page, t }) => {
  // D-2026-09-30-release-polish-13: the screen stopped reading what Bezel
  // sent; live mode and uploads stop until it is restarted, no replug.
  const errors = watchErrors(page);
  const name = 'Turing Smart Screen 8.8"';
  await page.goto('/index.html?demo=hung');
  await expect(page.locator('#theme-name')).toHaveValue('Demo');
  await page.getByRole('switch').click({ force: true });
  await expect(page.locator('#toast')).toHaveText(t('toast.liveStopped', { message: t('error.hung') }));
  await expect(page.getByRole('switch')).not.toBeChecked();
  await page.getByRole('tab', { name: t('library.screen') }).click();
  // The warning and the restart sit in the screen's advanced actions.
  const card = page.getByRole('group', { name: t('screen.advanced'), exact: true });
  await expect(card).toContainText(t('restart.hung'));
  await expect(card.getByRole('button', { name: t('screen.restart') })).toBeVisible();
  await expectAccessible(page);

  // An upload stops too, and its error offers the restart.
  await page.getByRole('tab', { name: t('screen.storageTab') }).click();
  const internal = page.getByRole('region', { name: t('storage.medium.internal') });
  await internal.getByRole('button', { name: t('storage.choose') }).click();
  await page.getByRole('dialog').getByRole('button', { name: t('storage.confirmUploadAction'), exact: true }).click();
  const failed = page.getByRole('region', { name: t('storage.errorTitle') });
  await expect(failed).toContainText(t('error.hung'), { timeout: 15_000 });

  // The restart asks first and says what stops; Esc keeps everything.
  const restart = failed.getByRole('button', { name: t('screen.restart') });
  await restart.click();
  const dialog = page.getByRole('dialog', { name: t('restart.confirmTitle', { name }) });
  await expect(dialog).toContainText(t('restart.confirmBody'));
  await expectAccessible(page);
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(restart).toBeFocused();

  await restart.click();
  await dialog.getByRole('button', { name: t('restart.confirmAction') }).click();
  await expect(page.locator('#toast')).toHaveText(t('restart.done'));
  await expect(failed).toHaveCount(0);
  await page.getByRole('tab', { name: t('screen.settingsTab') }).click();
  await expect(card).not.toContainText(t('restart.hung'));

  // Back: live mode stays on.
  await page.getByRole('switch').click({ force: true });
  await expect(page.locator('#status-device')).toHaveText(t('status.live'));
  await page.waitForTimeout(1500);
  await expect(page.getByRole('switch')).toBeChecked();
  expect(errors).toEqual([]);
});

test('screens without a wake chip offer no restart', async ({ page, t }) => {
  const errors = watchErrors(page);
  await page.goto('/index.html?demo=turzx');
  await page.getByRole('tab', { name: t('library.screen') }).click();
  await expect(page.getByRole('region', { name: 'Turing 2.1" Round (USB)' })).toBeVisible();
  await expect(page.getByRole('button', { name: t('screen.restart') })).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('a live screen that drops is connected again by itself', async ({ page, t }) => {
  // T-7.11: the backend connects the screen again (2, 5, 10 s apart); the
  // status says so meanwhile, and a toast when it is back.
  const errors = watchErrors(page);
  await page.goto('/index.html?demo=flaky');
  await expect(page.locator('#theme-name')).toHaveValue('Demo');
  await page.getByRole('switch').click({ force: true });
  await expect(page.locator('#status-device')).toHaveText(t('restart.reconnecting', { attempt: 1, attempts: 3 }));
  await expectAccessible(page);
  await expect(page.locator('#toast')).toHaveText(t('restart.doneLive'), { timeout: 5_000 });
  await expect(page.locator('#status-device')).toHaveText(t('status.live'));
  await expect(page.getByRole('switch')).toBeChecked();
  expect(errors).toEqual([]);
});
