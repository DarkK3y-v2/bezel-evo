import { test, expect, watchErrors, expectAccessible } from './helpers.mjs';

const expectedRows = t => [
  ['studio', 100, 90], ['webview', 101, 110], ['webview', 102, 48], ['light', 103, 40], ['sensors', 104, 24],
].map(([role, pid, value]) => t('shell.memoryProcess', { name: t(`shell.memoryRole.${role}`), pid, value: t('shell.memoryMB', { value }) }));

test('memory pill shows the total, demo marker and per-process breakdown with keyboard access', async ({ page, t }) => {
  const errors = watchErrors(page);
  await page.goto('/index.html?demo=turing88');
  await expect(page.locator('#theme-name')).toHaveValue('Demo');
  const toggle = page.locator('#status-memory-toggle');
  const label = `${t('shell.memoryChip', { value: t('shell.memoryMB', { value: 312 }) })} · ${t('shell.memoryDemoBadge')}`;
  await expect(toggle).toHaveText(label);
  await expect(page.getByRole('status').locator('#status-memory-toggle')).toHaveCount(1);
  await expect(toggle).toHaveAttribute('data-demo', 'true');
  await expect(toggle).toHaveClass('pill');
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await expect(toggle).toHaveAttribute('title', [t('shell.memoryChip', { value: t('shell.memoryMB', { value: 312 }) }), t('shell.memoryDemo'), ...expectedRows(t)].join('\n'));
  await toggle.focus();
  await page.keyboard.press('Enter');
  const popover = page.getByRole('dialog', { name: t('shell.memoryTitle') });
  await expect(popover).toBeVisible();
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await expect(popover.getByRole('listitem')).toHaveText(expectedRows(t));
  await expect(popover).toContainText(t('shell.memoryDemo'));
  await expect(popover.getByRole('button', { name: t('dialog.close') })).toBeFocused();
  await expectAccessible(page);
  await page.keyboard.press('Escape');
  await expect(popover).toBeHidden();
  await expect(toggle).toBeFocused();
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await toggle.click();
  await expect(popover).toBeVisible();
  await page.locator('#theme-name').click();
  await expect(popover).toBeHidden();
  // The statusbar remains available while Storage owns the wide workspace.
  await page.locator('#tab-screen').click();
  await page.getByRole('tab', { name: t('screen.storageTab'), exact: true }).click();
  await expect(page.locator('.workspace')).toHaveClass(/storage-wide/);
  await toggle.click();
  await expect(popover).toBeVisible();
  await expect(popover.getByRole('listitem')).toHaveCount(5);
  await popover.evaluate(node => Promise.all(node.getAnimations().map(animation => animation.finished)));
  await expectAccessible(page);
  await popover.getByRole('button', { name: t('dialog.close') }).click();
  await expect(popover).toBeHidden();
  expect(errors).toEqual([]);
});

test('unavailable backend memory is announced without a fabricated zero or demo label', async ({ page, t }) => {
  const errors = watchErrors(page);
  // An unavailable diagnostic has no bearing on sensors or the live screen.
  await page.route('**/demo-backend.js', async route => {
    const response = await route.fetch();
    const source = await response.text();
    const body = source.replace(/memoryUsage: \(\) => Promise\.resolve\(\{ demo: true,[\s\S]*?\] \}\),/, "memoryUsage: () => Promise.resolve({ totalBytes: null, processes: [] }),");
    expect(body).not.toBe(source);
    await route.fulfill({ response, body });
  });
  await page.goto('/index.html?demo=turing88');
  const toggle = page.locator('#status-memory-toggle');
  await expect(toggle).toHaveText(t('shell.memoryChip', { value: t('shell.memoryUnavailable') }));
  await expect(toggle).toHaveAttribute('data-demo', 'false');
  await toggle.click();
  const popover = page.getByRole('dialog', { name: t('shell.memoryTitle') });
  await expect(popover).toContainText(t('shell.memoryMethod'));
  await expect(popover.getByRole('listitem')).toHaveCount(0);
  await expect(page.locator('#status-libre-toggle')).toBeVisible();
  await expectAccessible(page);
  expect(errors).toEqual([]);
});
