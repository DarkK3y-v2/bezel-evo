// Screenshots the mockup artboards and the comparable app states (demo mode).
import { chromium } from 'file:///F:/dev/bezel/apps/bezel-studio/node_modules/playwright/index.mjs';
import fs from 'node:fs';

const OUT = process.argv[2];
const MOCK = 'http://127.0.0.1:1432';
const APP = 'http://127.0.0.1:1431/index.html?demo=turing88';
fs.mkdirSync(`${OUT}/mock`, { recursive: true });
fs.mkdirSync(`${OUT}/app`, { recursive: true });

const canvas = JSON.parse(fs.readFileSync(process.argv[3], 'utf8'));
const browser = await chromium.launch();

for (const name of canvas.order) {
  if (name.startsWith('Logo')) continue;
  const b = canvas.boards[name];
  const page = await browser.newPage({ viewport: { width: b.w, height: b.h }, colorScheme: 'dark' });
  await page.goto(`${MOCK}/${name}`);
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${OUT}/mock/${name.replace('.dc.html', '')}.png` });
  await page.close();
}

const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: 'dark', locale: 'it-IT' });
const page = await ctx.newPage();
const shot = (n) => page.screenshot({ path: `${OUT}/app/${n}.png` });
const tab = async (id) => { await page.locator(`#tab-${id}`).click(); await page.waitForTimeout(500); };
const add = async (label) => {
  await tab('widgets');
  await page.locator('#panel-widgets button').filter({ hasText: label }).first().click();
  await page.waitForTimeout(800);
};

await page.goto(APP);
await page.waitForTimeout(2500);
await shot('Main-default');
for (const id of ['widgets', 'sensors', 'layers', 'media', 'themes', 'screen']) { await tab(id); await shot(`panel-${id}`); }

for (const [label, n] of [['Anello', 'ring'], ['Grafico', 'graph'], ['Lettore', 'player'], ['Card', 'card']]) {
  try {
    await add(label);
    await shot(`inspector-${n}`);
    const tabs = page.locator('#inspector [role="tab"]');
    const count = await tabs.count();
    for (let i = 1; i < count; i++) { await tabs.nth(i).click(); await page.waitForTimeout(400); await shot(`inspector-${n}-tab${i}`); }
  } catch (e) { console.log('skip', n, e.message.split('\n')[0]); }
}
try { await page.locator('#status-libre-toggle').click(); await page.waitForTimeout(400); await shot('sensor-popover'); await page.keyboard.press('Escape'); } catch (e) { console.log('skip popover'); }

// Connect: no screen.
const empty = await ctx.newPage();
await empty.goto('http://127.0.0.1:1431/index.html?demo=empty');
await empty.waitForTimeout(2500);
await empty.screenshot({ path: `${OUT}/app/connect.png` });

await browser.close();
console.log('done');
