import { test, expect, watchErrors, expectAccessible } from './helpers.mjs';

// The stage takes the keys after a press, but its focus ring is the
// keyboard's alone (D-2026-10-15-studio-redesign-fidelity-22): a click or a
// middle-button pan never leaves it; Tab still shows it.
const ring = (locator) => locator.evaluate((node) => ({
  focused: document.activeElement === node,
  visible: node.matches(':focus-visible'),
  outline: getComputedStyle(node).outlineStyle,
}));

async function pan(page, box) {
  await page.mouse.move(box.x + 60, box.y + 60);
  await page.mouse.down({ button: 'middle' });
  await page.mouse.move(box.x + 140, box.y + 110, { steps: 6 });
  await page.mouse.up({ button: 'middle' });
}

test('a click or a middle-button pan focuses the stage without the ring; Tab shows it', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('/index.html?demo=turing88');
  const stage = page.locator('#stage-scroll');
  const box = await stage.boundingBox();
  const mouseFocus = { focused: true, visible: false, outline: 'none' };

  // A click on the empty stage, then on the canvas, then keys on it.
  await page.mouse.click(box.x + 30, box.y + box.height - 30);
  expect(await ring(stage)).toEqual(mouseFocus);
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  expect(await ring(stage)).toEqual(mouseFocus);
  await page.keyboard.press('ArrowRight');
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  expect(await ring(stage)).toEqual(mouseFocus);

  // A middle-button pan, whether the stage had focus or not.
  await pan(page, box);
  expect(await ring(stage)).toEqual(mouseFocus);
  await page.locator('#tab-widgets').click();
  await pan(page, box);
  expect(await ring(stage)).toEqual({ focused: false, visible: false, outline: 'none' });
  await page.mouse.click(box.x + 30, box.y + box.height - 30);
  await pan(page, box);
  expect(await ring(stage)).toEqual(mouseFocus);

  // The keyboard brings the ring back: away and back with Tab.
  await page.keyboard.press('Shift+Tab');
  await expect(stage).not.toBeFocused();
  await page.keyboard.press('Tab');
  expect(await ring(stage)).toEqual({ focused: true, visible: true, outline: 'solid' });
  await expectAccessible(page);
  expect(errors).toEqual([]);
});
