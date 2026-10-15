import { test, expect, watchErrors, expectAccessible } from './helpers.mjs';

// The theme's background type is a choice in plain sight
// (D-2026-10-15-studio-redesign-fidelity-23): Color | From PC | From screen,
// each with one line of explanation and its own controls; From PC links to
// the Media panel, From screen to Screen › Storage. A switch is one undo
// step and brings back the last background of that type.
const inspector = (page) => page.locator('#inspector');
const kinds = (page, t) => inspector(page).getByRole('group', { name: t('insp.bgType'), exact: true });
const kind = (page, t, key) => kinds(page, t).getByRole('button', { name: t(key), exact: true });
const video = (page, t) => inspector(page).getByRole('group', { name: t('bg.video'), exact: true });

test('the three background types, their links and one undo step per switch', async ({ page, t }) => {
  const errors = watchErrors(page);
  await page.goto('/index.html?demo=turing88');
  await expect(page.locator('#theme-name')).toHaveValue('Demo');
  await expect(kinds(page, t).getByRole('button')).toHaveText([t('inspector.color'), t('insp.bgPc'), t('insp.bgScreen')]);
  await expect(kind(page, t, 'inspector.color')).toHaveAttribute('aria-pressed', 'true');
  await expect(inspector(page).locator('.background-body input[type="color"]')).toBeVisible();

  // From PC with nothing picked yet: the explanation and the pickers, the theme unchanged.
  await kind(page, t, 'insp.bgPc').click();
  await expect(kind(page, t, 'insp.bgPc')).toHaveAttribute('aria-pressed', 'true');
  await expect(kind(page, t, 'insp.bgPc')).toBeFocused();
  await expect(inspector(page)).toContainText(t('insp.bgPcHint'));
  await expect(inspector(page)).toContainText(t('insp.bgPending'));
  await expect(page.locator('#status-main')).toHaveText(t('status.saved'));
  await expect(page.locator('#undo')).toBeDisabled();
  await expectAccessible(page);
  // Its link opens the Media panel.
  await inspector(page).getByRole('button', { name: t('insp.bgOpenMedia'), exact: true }).click();
  await expect(page.locator('#tab-media')).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('#panel-media')).toBeVisible();

  // A video from the PC: one step.
  await inspector(page).getByRole('button', { name: t('inspector.useVideo'), exact: true }).click();
  await expect(video(page, t)).toContainText('ferias.mp4');
  await expect(kind(page, t, 'insp.bgPc')).toHaveAttribute('aria-pressed', 'true');

  // From screen, by keyboard: the explanation and the link to Screen › Storage.
  await kind(page, t, 'insp.bgScreen').focus();
  await page.keyboard.press('Enter');
  await expect(kind(page, t, 'insp.bgScreen')).toHaveAttribute('aria-pressed', 'true');
  await expect(kind(page, t, 'insp.bgScreen')).toBeFocused();
  await expect(inspector(page)).toContainText(t('insp.bgScreenHint'));
  await expect(video(page, t)).toHaveCount(0);
  await inspector(page).getByRole('button', { name: t('insp.bgOpenStorage'), exact: true }).click();
  await expect(page.locator('#tab-screen')).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('#subtab-storage')).toHaveAttribute('aria-selected', 'true');
  // The storage manager takes the whole width; back to the editor.
  await page.locator('#tab-widgets').click();

  // Color, then From PC again brings the video back; each switch is one undo step.
  await kind(page, t, 'inspector.color').click();
  await expect(kind(page, t, 'inspector.color')).toHaveAttribute('aria-pressed', 'true');
  await expect(video(page, t)).toHaveCount(0);
  await kind(page, t, 'insp.bgPc').click();
  await expect(video(page, t)).toContainText('ferias.mp4');
  await page.locator('#undo').click();
  await expect(kind(page, t, 'inspector.color')).toHaveAttribute('aria-pressed', 'true');
  await page.locator('#undo').click();
  await expect(video(page, t)).toContainText('ferias.mp4');
  await page.locator('#undo').click();
  await expect(kind(page, t, 'inspector.color')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#status-main')).toHaveText(t('status.saved'));
  await expectAccessible(page);
  expect(errors).toEqual([]);
});

test('a video stored on the screen shows under From screen and comes back after Color', async ({ page, t }) => {
  const errors = watchErrors(page);
  await page.goto('/index.html?demo=vendorCard');
  await kind(page, t, 'insp.bgScreen').click();
  await inspector(page).getByRole('button', { name: t('insp.bgOpenStorage'), exact: true }).click();
  const card = page.getByRole('region', { name: t('storage.medium.sd'), exact: true });
  await card.getByRole('option').filter({ has: page.getByText('AMD.mp4', { exact: true }) }).click();
  await card.getByRole('button', { name: t('storage.action.background'), exact: true }).click();
  await page.locator('#tab-widgets').click();
  await expect(kind(page, t, 'insp.bgScreen')).toHaveAttribute('aria-pressed', 'true');
  await expect(inspector(page).locator('.bg-file')).toHaveText('AMD.mp4');
  await expect(inspector(page).getByRole('checkbox', { name: t('deviceVideo.loop'), exact: true })).toBeChecked();
  await expectAccessible(page);
  await kind(page, t, 'inspector.color').click();
  await expect(inspector(page).locator('.bg-file')).toHaveCount(0);
  await kind(page, t, 'insp.bgScreen').click();
  await expect(inspector(page).locator('.bg-file')).toHaveText('AMD.mp4');
  await page.locator('#undo').click();
  await expect(kind(page, t, 'inspector.color')).toHaveAttribute('aria-pressed', 'true');
  expect(errors).toEqual([]);
});
