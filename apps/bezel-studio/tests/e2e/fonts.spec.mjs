// The window's fonts are the bundled IBM Plex files (D-2026-10-09-studio-redesign-6,
// -fidelity-9): Sans 400/500/600 and Mono 400/500 load from assets/fonts,
// and no font is asked of another host.
import { test, expect, watchErrors } from './helpers.mjs';

const FACES = [
  ['IBM Plex Sans', '400'], ['IBM Plex Sans', '500'], ['IBM Plex Sans', '600'],
  ['IBM Plex Mono', '400'], ['IBM Plex Mono', '500'],
];

test('the IBM Plex faces load from the bundled files', async ({ page }) => {
  const errors = watchErrors(page);
  const fonts = [];
  page.on('request', (request) => {
    if (request.resourceType() === 'font') fonts.push(new URL(request.url()));
  });
  await page.goto('/index.html?demo=turing88');
  await expect(page.locator('#theme-name')).toHaveValue('Demo');
  const status = await page.evaluate(async (faces) => {
    await Promise.all(faces.map(([family, weight]) => document.fonts.load(`${weight} 13px "${family}"`)));
    await document.fonts.ready;
    return faces.map(([family, weight]) => {
      const face = [...document.fonts].find((f) => f.family.replace(/"/g, '') === family && f.weight === weight);
      return [family, weight, face?.status ?? 'missing', document.fonts.check(`${weight} 13px "${family}"`)];
    });
  }, FACES);
  expect(status).toEqual(FACES.map(([family, weight]) => [family, weight, 'loaded', true]));
  expect(fonts.length).toBeGreaterThanOrEqual(FACES.length);
  for (const url of fonts) {
    expect(url.origin).toBe(new URL(page.url()).origin);
    expect(url.pathname).toMatch(/^\/assets\/fonts\/ibm-plex\/IBMPlex(Sans|Mono)-[A-Za-z]+\.woff2$/);
  }
  // The body text is 13px Sans; a readout is Mono.
  expect(await page.locator('body').evaluate((n) => getComputedStyle(n).fontSize)).toBe('13px');
  expect(await page.locator('body').evaluate((n) => getComputedStyle(n).fontFamily)).toMatch(/^"IBM Plex Sans"/);
  expect(await page.locator('#zoom-label').evaluate((n) => getComputedStyle(n).fontFamily)).toMatch(/^"IBM Plex Mono"/);
  expect(errors).toEqual([]);
});
