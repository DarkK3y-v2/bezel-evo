import { test, expect, expectAccessible, watchErrors } from './helpers.mjs';

// The sensors chip (artboard SensorStatus): four states, a dialog with a row
// per hardware, the last reading, and the restart of the Libre reader only.

test('Libre status detects a failed PSU and restarts the reader', async ({ page, t }) => {
  const errors = watchErrors(page);
  await page.goto('/index.html?demo=turing88&libre=partial');
  await expect(page.locator('#status-libre-label')).toHaveText(t('sensorChip.missingOne', { count: 1 }));
  await expect(page.locator('#status-libre-dot')).toHaveAttribute('data-state', 'partial');
  const dot = page.locator('#status-libre-toggle');
  await expect(dot).toHaveAttribute('data-tone', 'warn');
  await expect(dot).toHaveAttribute('title', /Corsair/);
  await expect(dot).toHaveAttribute('aria-expanded', 'false');
  await dot.click();
  await expect(dot).toHaveAttribute('aria-expanded', 'true');
  const popover = page.getByRole('dialog', { name: t('sensorChip.title.partialOne', { count: 1 }) });
  await expect(popover).toBeVisible();
  const hardware = popover.getByRole('list', { name: t('sensorChip.hardware') }).getByRole('listitem');
  // A row per hardware: the PSU's board is missing, the others show a value and their source.
  await expect(hardware.filter({ hasText: t('category.board') })).toContainText(t('sensorStatus.missing'));
  await expect(hardware.filter({ hasText: t('category.cpu') })).toContainText('LibreHardwareMonitor');
  await expect(hardware.filter({ hasText: t('category.cpu') })).toContainText(/\d/);
  await expect(hardware.filter({ hasText: t('category.memory') })).not.toContainText(t('sensorStatus.missing'));
  await expect(popover).toContainText(/Corsair/);
  await expect(popover).toContainText(t('sensorChip.lastReading', { ago: '' }).trim());
  await expectAccessible(page);
  await popover.getByRole('button', { name: t('status.libreRestart'), exact: true }).click();
  await expect(page.locator('#restart-libre')).toBeDisabled();
  await expect(page.locator('#status-libre-label')).toHaveText(t('sensorChip.restarting'));
  await expect(dot).toHaveAttribute('data-tone', 'info');
  await expect(page.locator('#status-libre-label')).toHaveText(/\d+ ms/);
  await expect(page.locator('#status-libre-dot')).toHaveAttribute('data-state', 'ok');
  await expect(dot).toHaveAttribute('data-tone', 'ok');
  await expect(page.locator('#restart-libre')).toBeEnabled();
  await expect(popover).toBeHidden();
  await expect(page.getByRole('dialog', { name: t('sensorChip.title.ok') })).toBeVisible();
  await expectAccessible(page);
  await page.keyboard.press('Escape');
  await expect(page.locator('#libre-popover')).toBeHidden();
  await expect(dot).toHaveAttribute('aria-expanded', 'false');
  await expect(dot).toBeFocused();
  expect(errors).toEqual([]);
});

test('the Libre dialog opens Sensors and closes on a click outside', async ({ page, t }) => {
  const errors = watchErrors(page);
  await page.goto('/index.html?demo=turing88&libre=error');
  const dot = page.locator('#status-libre-toggle');
  await expect(page.locator('#status-libre-dot')).toHaveAttribute('data-state', 'error');
  await dot.press('Enter');
  const popover = page.locator('#libre-popover');
  await expect(popover).toBeVisible();
  await expect(page.locator('#restart-libre')).toBeFocused();
  await expect(popover).toContainText(t('sensorStatus.hint', { hardware: '' }).split(':')[0]);
  await page.locator('#status-main').click();
  await expect(popover).toBeHidden();
  await dot.click();
  await popover.getByRole('button', { name: t('sensorStatus.openSensors') }).click();
  await expect(popover).toBeHidden();
  await expect(page.getByRole('tab', { name: t('common.sensors') })).toHaveAttribute('aria-selected', 'true');
  expect(errors).toEqual([]);
});

test('Libre stopped is red with the restart beside the chip; other providers stay green', async ({ page, t }) => {
  const errors = watchErrors(page);
  await page.goto('/index.html?demo=turing88&libre=error');
  await expect(page.locator('#status-libre-label')).toHaveText(t('sensorChip.stopped'));
  await expect(page.locator('#status-libre-dot')).toHaveAttribute('data-state', 'error');
  await expect(page.locator('#status-libre-toggle')).toHaveAttribute('data-tone', 'danger');
  // Nothing reads: the restart is one click away, without opening the dialog.
  const quick = page.locator('#status-libre').getByRole('button', { name: t('status.libreRestart'), exact: true });
  await expect(quick).toBeVisible();
  await expectAccessible(page);
  await quick.click();
  await expect(page.locator('#status-libre-label')).toHaveText(/\d+ ms/);
  await expect(quick).toBeHidden();
  await expect(page.locator('#libre-popover')).toBeHidden();

  // Without LibreHardwareMonitor: the green chip with the sample's time and
  // a row per hardware, but nothing to restart (D-2026-10-09-studio-redesign-10).
  await page.goto('/index.html?demo=turing88');
  await expect(page.locator('#theme-name')).toHaveValue('Demo');
  await expect(page.locator('#status-libre')).toBeVisible();
  await expect(page.locator('#status-libre-label')).toHaveText(/\d+ ms/);
  await expect(page.locator('#status-libre-dot')).toHaveAttribute('data-state', 'ok');
  await expect(page.locator('#status-sensors')).toBeHidden();
  await page.locator('#status-libre-toggle').click();
  const popover = page.getByRole('dialog', { name: t('sensorChip.title.ok') });
  await expect(popover.getByRole('listitem')).toHaveCount(7);
  await expect(page.locator('#restart-libre')).toBeHidden();
  await expect(page.locator('#status-libre-restart')).toBeHidden();
  await expect(popover.getByRole('button', { name: t('dialog.close') })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.locator('#status-libre-toggle')).toBeFocused();
  expect(errors).toEqual([]);
});
