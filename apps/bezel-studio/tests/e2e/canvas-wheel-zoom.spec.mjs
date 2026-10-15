import { test, expect, watchErrors, expectAccessible, setPanelWidths } from './helpers.mjs';

const canvas = (page) => page.locator('#canvas-box');
const scale = (page) => canvas(page).evaluate(node => node.getBoundingClientRect().width / node.querySelector('canvas').width);
const canvasPoint = (page, cursor) => canvas(page).evaluate((node, at) => {
  const r = node.getBoundingClientRect();
  const zoom = r.width / node.querySelector('canvas').width;
  return { x: (at.x - r.left) / zoom, y: (at.y - r.top) / zoom };
}, cursor);

async function wheelAt(page, cursor, delta, ctrl = false) {
  const before = await scale(page);
  await page.mouse.move(cursor.x, cursor.y);
  if (ctrl) await page.keyboard.down('Control');
  await page.mouse.wheel(0, delta);
  if (ctrl) await page.keyboard.up('Control');
  await expect.poll(() => scale(page)).not.toBe(before);
}

// Synthetic wheel events exercise fractional travel and deltaMode precisely;
// the main gestures below use native browser wheel input.
async function burst(page, deltas, options = {}) {
  return canvas(page).evaluate(async (node, { deltas, options }) => {
    const r = node.getBoundingClientRect();
    const stage = document.getElementById('stage-scroll').getBoundingClientRect();
    const clientX = (Math.max(r.left, stage.left) + Math.min(r.right, stage.right)) / 2;
    const clientY = (Math.max(r.top, stage.top) + Math.min(r.bottom, stage.bottom)) / 2;
    const prevented = deltas.map(deltaY => {
      const evt = new WheelEvent('wheel', { bubbles: true, cancelable: true, clientX, clientY, deltaY, ...options });
      node.querySelector('canvas').dispatchEvent(evt);
      return evt.defaultPrevented;
    });
    await new Promise(requestAnimationFrame);
    return prevented;
  }, { deltas, options });
}

for (const demo of ['turing88', 'dragon']) {
  test(`wheel and pinch keep the cursor's canvas point fixed (${demo})`, async ({ page }) => {
    const errors = watchErrors(page);
    await setPanelWidths(page, { library: 272, inspector: 320 });
    await page.goto(`/index.html?demo=${demo}`);
    await expect(page.locator('#theme-name')).toHaveValue(demo === 'dragon' ? 'Dragon Ball' : 'Demo');
    const box = await canvas(page).boundingBox();
    const cursor = { x: Math.round(box.x + box.width * 0.7), y: Math.round(box.y + box.height * 0.35) };
    const anchor = await canvasPoint(page, cursor);
    const initial = await scale(page);
    for (const [delta, ctrl, expected] of [[-100, false, initial * 1.25], [100, false, initial], [-100, true, initial * 1.25], [100, true, initial]]) {
      await wheelAt(page, cursor, delta, ctrl);
      expect(await scale(page)).toBeCloseTo(expected, 4);
      const after = await canvasPoint(page, cursor);
      // Subpixel CSS layout and integer scroll offsets may differ by 1 screen px.
      expect(Math.abs(after.x - anchor.x) * expected).toBeLessThanOrEqual(1.1);
      expect(Math.abs(after.y - anchor.y) * expected).toBeLessThanOrEqual(1.1);
      await expect(page.locator('#zoom-label')).toHaveText(`${Math.round(expected * 100)}%`);
    }
    // Cross from a fitting canvas into a scrollable canvas and back.
    for (const delta of [-800, 800]) {
      await wheelAt(page, cursor, delta);
      const current = await scale(page);
      const after = await canvasPoint(page, cursor);
      expect(Math.abs(after.x - anchor.x) * current).toBeLessThanOrEqual(1.1);
      expect(Math.abs(after.y - anchor.y) * current).toBeLessThanOrEqual(1.1);
    }
    // Zoom out near a viewport edge after scrolling into a large canvas.
    await wheelAt(page, cursor, -800);
    const enlarged = await canvas(page).boundingBox();
    const viewport = await page.locator('#stage-scroll').boundingBox();
    const edge = { x: Math.ceil(Math.max(enlarged.x + 2, viewport.x + 28)), y: Math.ceil(Math.max(enlarged.y + 2, viewport.y + 58)) };
    const edgeAnchor = await canvasPoint(page, edge);
    await wheelAt(page, edge, 800);
    const edgeAfter = await canvasPoint(page, edge);
    expect(Math.abs(edgeAfter.x - edgeAnchor.x) * initial).toBeLessThanOrEqual(1.1);
    expect(Math.abs(edgeAfter.y - edgeAnchor.y) * initial).toBeLessThanOrEqual(1.1);
    await page.locator('#zoom-fit').click();
    await page.locator('#zoom-in').click();
    expect(await scale(page)).toBeCloseTo(initial * 1.25, 4);
    await page.locator('#zoom-out').click();
    expect(await scale(page)).toBeCloseTo(initial, 4);
    await page.locator('#zoom-fit').click();
    expect(await scale(page)).toBeCloseTo(initial, 4);
    await expectAccessible(page);
    expect(errors).toEqual([]);
  });
}

test('fractional wheel travel accumulates, delta modes agree, and zoom respects button limits', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('/index.html?demo=turing88');
  await expect(page.locator('#theme-name')).toHaveValue('Demo');
  const initial = await scale(page);
  expect(await burst(page, Array(100).fill(-1), { ctrlKey: true })).toEqual(Array(100).fill(true));
  expect(await scale(page)).toBeCloseTo(initial * 1.25, 4);
  await burst(page, [6.25], { deltaMode: 1 }); // 100 pixels
  expect(await scale(page)).toBeCloseTo(initial, 4);
  await burst(page, [-0.25], { deltaMode: 2 }); // -100 pixels
  expect(await scale(page)).toBeCloseTo(initial * 1.25, 4);
  await burst(page, [-0.1], { ctrlKey: true });
  expect(await scale(page)).toBeGreaterThan(initial * 1.25);
  await burst(page, [-100000]);
  expect(await scale(page)).toBeCloseTo(8, 5);
  await expect(page.locator('#zoom-label')).toHaveText('800%');
  await burst(page, [-100]);
  expect(await scale(page)).toBeCloseTo(8, 5);
  await page.locator('#zoom-in').click();
  expect(await scale(page)).toBeCloseTo(8, 5);
  await burst(page, [100000]);
  expect(await scale(page)).toBeCloseTo(0.05, 5);
  await expect(page.locator('#zoom-label')).toHaveText('5%');
  await burst(page, [100]);
  expect(await scale(page)).toBeCloseTo(0.05, 5);
  await page.locator('#zoom-out').click();
  expect(await scale(page)).toBeCloseTo(0.05, 5);
  await burst(page, [-100]); // No excess delta is retained at the limit.
  expect(await scale(page)).toBeCloseTo(0.0625, 5);
  await page.locator('#zoom-fit').click();
  expect(await scale(page)).toBeCloseTo(initial, 4);
  // Neither the workspace outside the canvas nor other panels swallow wheel.
  for (const selector of ['#stage-scroll', '#inspector', '#zoom-in']) {
    const prevented = await page.locator(selector).evaluate(node => {
      const r = node.getBoundingClientRect();
      const evt = new WheelEvent('wheel', { bubbles: true, cancelable: true, ctrlKey: true, clientX: r.left + 2, clientY: r.top + 2, deltaY: -100 });
      node.dispatchEvent(evt);
      return evt.defaultPrevented;
    });
    expect(prevented).toBe(false);
  }
  expect(await scale(page)).toBeCloseTo(initial, 4);
  await expectAccessible(page);
  expect(errors).toEqual([]);
});

test('framing wheel still zooms the video; Ctrl+wheel still zooms only the view', async ({ page, t }) => {
  const errors = watchErrors(page);
  await page.goto('/index.html?demo=dragon');
  await expect(page.locator('#theme-name')).toHaveValue('Dragon Ball');
  await page.locator('#inspector').getByRole('button', { name: t('framing.onCanvas') }).click();
  const surface = page.getByRole('application', { name: t('framing.surface') });
  await expect(surface).toBeFocused();
  const initial = await scale(page);
  const box = await canvas(page).boundingBox();
  const cursor = { x: box.x + box.width * 0.6, y: box.y + box.height * 0.4 };
  await page.mouse.move(cursor.x, cursor.y);
  await page.mouse.wheel(0, -150);
  await expect(page.locator('#framing-numbers')).toHaveText(t('framing.readout', { zoom: 128, x: 60, y: 40 }));
  expect(await scale(page)).toBeCloseTo(initial, 4);
  const background = await page.locator('#framing-numbers').textContent();
  await wheelAt(page, cursor, -100, true);
  expect(await scale(page)).toBeCloseTo(initial * 1.25, 4);
  await expect(page.locator('#framing-numbers')).toHaveText(background);
  await surface.focus();
  await page.keyboard.press('Control+z');
  await expect(page.locator('#framing-numbers')).toHaveText(t('framing.readout', { zoom: 100, x: 50, y: 50 }));
  expect(await scale(page)).toBeCloseTo(initial * 1.25, 4);
  await expectAccessible(page);
  expect(errors).toEqual([]);
});
