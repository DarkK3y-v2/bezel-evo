// The screen in demo mode, in pt-BR and en, light and dark: live mode and
// start at login, a denied port shows the udev command (in a dialog and on
// the stage), a panel in desktop mode goes back only after a dialog, a hung
// screen is restarted after one, and a live screen that drops is connected
// again, saying so.
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
  const autostart = page.getByRole('checkbox', { name: t('screen.autostart') });
  await autostart.check();
  await expect(autostart).toBeChecked();
  await page.getByRole('switch').click({ force: true });
  await expect(page.getByRole('switch')).not.toBeChecked();
  await expectAccessible(page);
  expect(errors).toEqual([]);
});

test('a denied port shows the udev command to copy', async ({ page, context, t }) => {
  const errors = watchErrors(page);
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('/index.html?demo=denied');
  await expect(page.locator('#theme-name')).toHaveValue('Demo');
  const live = page.getByRole('switch');
  await live.click({ force: true });
  const dialog = page.getByRole('dialog', { name: t('udev.title') });
  const denied = t('error.accessDenied', { address: '/dev/ttyACM1', reason: 'Permission denied (os error 13)' });
  await expect(dialog).toContainText(denied);
  const command = dialog.getByRole('group', { name: t('udev.command') });
  await expect(command).toContainText('sudo install -m 644 /home/demo/.cache/io.github.slipalison.bezel/60-bezel.rules /etc/udev/rules.d/60-bezel.rules');
  await expect(dialog).toContainText(t('udev.never'));
  const copy = command.getByRole('button', { name: t('udev.copy') });
  await expect(copy).toBeFocused();
  await expectAccessible(page);
  await copy.click();
  await expect(page.locator('#toast')).toHaveText(t('udev.copied'));
  expect(await page.evaluate(() => navigator.clipboard.readText())).toMatch(/^sudo install -m 644 .* && sudo udevadm trigger$/);
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(live).not.toBeChecked();

  // The stage says how to connect it, with the same command.
  const connect = page.getByRole('region', { name: t('connect.title') });
  await expect(connect).toContainText(denied);
  await expect(connect.getByRole('group', { name: t('udev.command') })).toContainText('sudo install -m 644');

  // The storage tab says the same, with the command.
  await page.getByRole('tab', { name: t('library.screen') }).click();
  await page.getByRole('tab', { name: t('screen.storageTab') }).click();
  const storage = page.locator('#storage-panel');
  await expect(storage.getByRole('alert')).toContainText(denied);
  await expect(storage.getByRole('group', { name: t('udev.command') })).toBeVisible();
  await expectAccessible(page);
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
  const card = page.getByRole('region', { name });
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
