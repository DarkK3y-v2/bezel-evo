// README screenshots: real Studio UI and renderer, browser demo data only.
// From the repository root, after npm ci in apps/bezel-studio:
//   node docs/images/capture.mjs
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from '../../apps/bezel-studio/node_modules/@playwright/test/index.mjs';
import { createWidget } from '../../apps/bezel-studio/src/editor/widgets.js';
import { translator } from '../../apps/bezel-studio/src/i18n/index.js';

const output = fileURLToPath(new URL('./', import.meta.url));
const app = fileURLToPath(new URL('../../apps/bezel-studio/', import.meta.url));
const t = translator('en');
const size = { width: 480, height: 1920 };
const theme = { schema: 1, name: 'Ember', canvas: size, orientation: 'portrait', refreshSeconds: 1, background: { type: 'color', color: '#0B0D0FFF' }, elements: [] };
function widget(type, name, x, y, width, height, sensor = {}) {
  const { kind, valueTransition, card } = createWidget(type, size, sensor);
  const element = { id: theme.elements.length + 1, name, frame: { x, y, width, height }, opacity: 1, visible: true, locked: false, kind, ...(valueTransition ? { valueTransition } : {}), ...(card ? { card } : {}) };
  theme.elements.push(element);
  return element;
}
function text(name, content, x, y, width, height, fontSize, color = '#E8EAEDFF', align = 'left') {
  const element = widget('text', name, x, y, width, height);
  element.kind.content.text = content;
  Object.assign(element.kind.style, { size: fontSize, paint: color, align, font: { family: 'IBM Plex Sans', weight: 600, italic: false } });
  return element;
}
function panel(name, y, height) {
  const element = widget('shape', name, 24, y, 432, height);
  Object.assign(element.kind, { radius: 24, fill: '#121518FF' });
}
text('Overview label', 'SYSTEM / OVERVIEW', 32, 24, 416, 42, 24, '#FF9248FF');
const clock = widget('clock', 'Clock', 32, 74, 416, 128);
Object.assign(clock.kind.style, { size: 104, align: 'left', font: { family: 'IBM Plex Sans', weight: 600, italic: false } });
const date = widget('clock', 'Date', 32, 202, 416, 42);
date.kind.content.pattern = '%A, %d %B';
Object.assign(date.kind.style, { size: 27, align: 'left', paint: '#AEB5BDFF' });
panel('Processor panel', 280, 660);
text('Processor label', 'PROCESSOR', 52, 306, 376, 48, 28, '#FF9248FF');
const cpu = widget('ring', 'CPU load', 94, 386, 292, 292, { key: 'cpu.usage', quantity: 'percent' });
Object.assign(cpu.kind, { fill: '#FF9248FF', track: '#2C3238FF', thickness: 22 });
const value = widget('value', 'CPU percentage', 118, 468, 244, 104, { key: 'cpu.usage', quantity: 'percent' });
Object.assign(value.kind.style, { size: 74, align: 'center' });
text('CPU caption', 'CPU LOAD', 130, 568, 220, 42, 24, '#AEB5BDFF', 'center');
for (const [name, key, x, caption] of [['Memory usage', 'memory.percent', 52, 'RAM USED'], ['GPU usage', 'gpu.usage', 270, 'GPU LOAD']]) {
  const metric = widget('value', name, x, 750, 172, 86, { key, quantity: key.endsWith('temperature') ? 'celsius' : 'percent' });
  Object.assign(metric.kind.style, { size: 58, align: 'left' });
  text(`${name} caption`, caption, x, 844, 176, 42, 23, '#AEB5BDFF');
}
panel('History panel', 972, 366);
text('History label', 'PROCESSOR HISTORY', 52, 998, 376, 48, 26, '#FF9248FF');
const graph = widget('graph', 'CPU history', 52, 1082, 376, 190, { key: 'cpu.usage', quantity: 'percent' });
Object.assign(graph.kind, { color: '#FF9248FF', fill: '#FF924830', lineWidth: 4 });
panel('Memory panel', 1370, 266);
text('Memory label', 'MEMORY', 52, 1396, 376, 48, 28, '#FF9248FF');
const ram = widget('value', 'Memory used', 52, 1460, 376, 82, { key: 'memory.percent', quantity: 'percent' });
Object.assign(ram.kind.style, { size: 64, align: 'left' });
const bar = widget('bar', 'Memory bar', 52, 1570, 376, 16, { key: 'memory.percent', quantity: 'percent' });
Object.assign(bar.kind, { fill: '#FF9248FF', track: '#2C3238FF', radius: 8 });
text('Footer', 'BEZEL EVO', 32, 1728, 416, 60, 42);
text('Demo label', 'EMBER / DEMO DATA', 32, 1800, 416, 42, 24, '#AEB5BDFF');

const port = await new Promise(resolve => {
  const server = createServer();
  server.listen(0, '127.0.0.1', () => { const port = server.address().port; server.close(() => resolve(port)); });
});
const server = spawn(process.platform === 'win32' ? 'python' : 'python3', ['scripts/serve-e2e.py', String(port), 'src'], { cwd: app, stdio: 'ignore', windowsHide: true });
const base = `http://localhost:${port}`;
let browser;
try {
  for (let attempt = 0; ; attempt++) {
    try { if ((await fetch(`${base}/index.html`)).ok) break; } catch {}
    if (attempt > 60) throw new Error('Demo server did not start');
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  browser = await chromium.launch();
  for (const colorScheme of ['dark', 'light']) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme, locale: 'en-US', timezoneId: 'UTC' });
    await context.addInitScript(() => localStorage.setItem('bezel.panelWidths', JSON.stringify({ library: 280, inspector: 360 })));
    // Load a custom example document into the existing demo, not a UI mockup.
    await context.route('**/demo-theme.js', route => route.fulfill({ contentType: 'text/javascript', body: `export const DEMO_THEME = ${JSON.stringify(theme)};` }));
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.clock.setFixedTime(new Date('2026-10-15T12:00:00Z'));
    await page.goto(`${base}/index.html?demo=turing88`);
    await page.evaluate(() => document.fonts.ready);
    await page.locator('#theme-name').filter({ visible: true }).waitFor();
    await page.waitForFunction(() => document.getElementById('theme-name').value === 'Ember');
    await page.waitForTimeout(1200);
    const screenshot = async name => {
      await page.screenshot({ path: `${output}${name}.png`, animations: 'disabled', caret: 'hide' });
      console.log(`${name}.png`);
    };
    if (colorScheme === 'light') { await screenshot('studio-light'); await context.close(); continue; }
    await screenshot('studio-hero');
    const canvas = await page.locator('#preview').evaluate(canvas => canvas.toDataURL('image/png'));
    await page.locator('#tab-sensors').click();
    await screenshot('studio-library');
    await page.locator('#tab-layers').click();
    await page.locator('.layer-name').filter({ hasText: 'CPU load' }).click();
    await page.locator('#tab-widgets').click();
    await screenshot('studio-inspector');
    // Populate the card using the editor's actual actions, like its e2e recipe.
    await page.locator('.widget-tile[data-widget="card"]').click();
    const inspector = page.locator('#inspector');
    const name = await inspector.getByLabel(t('common.name'), { exact: true }).inputValue();
    const selectCard = async () => {
      await page.locator('#tab-layers').click();
      await page.locator('.layer-name').filter({ hasText: name }).first().click();
      await page.locator('#tab-widgets').click();
    };
    await page.locator('.widget-tile[data-widget="ring"]').click();
    await selectCard();
    await inspector.getByRole('button', { name: t('card.addFace'), exact: true }).click();
    await page.locator('.widget-tile[data-widget="bar"]').click();
    await selectCard();
    await inspector.getByRole('tab', { name: t('card.tab.triggers'), exact: true }).click();
    await inspector.getByRole('button', { name: t('trigger.add'), exact: true }).click();
    await screenshot('studio-card-triggers');
    if (errors.length) throw new Error(errors.join('\n'));
    // A deliberately generic device illustration using the exact demo frame.
    // No claim about a manufacturer's case, product photograph or hardware test.
    const render = await context.newPage();
    const font = readFileSync(`${app}src/assets/fonts/ibm-plex/IBMPlexSans-Regular.woff2`).toString('base64');
    await render.setViewportSize({ width: 1200, height: 900 });
    await render.setContent(`<style>
      @font-face{font-family:Plex;src:url(data:font/woff2;base64,${font})}
      *{box-sizing:border-box}body{margin:0;background:#0B0D0F;color:#E8EAED;font-family:Plex,sans-serif}
      main{width:1200px;height:900px;display:flex;align-items:center;justify-content:center;gap:120px;background:radial-gradient(ellipse at 70% 70%,#241B14 0,transparent 55%)}
      .copy{width:420px}.eyebrow{font-size:16px;letter-spacing:4px;color:#FF9248}h1{font-size:64px;font-weight:400;line-height:1.1;letter-spacing:-2px;margin:30px 0}p{font-size:21px;color:#AEB5BD;line-height:1.6}.note{font-size:14px;margin-top:56px}
      .device{padding:12px;background:linear-gradient(110deg,#343A40,#121518 24%,#1A1D21);border:1px solid #43494E;border-radius:22px;box-shadow:0 40px 80px #000A,0 0 50px #FF92480A;transform:rotate(-4deg)}
      .device img{display:block;width:182px;height:728px;border-radius:9px}.ledge{height:8px;width:270px;background:#262C30;border:1px solid #353B40;border-radius:50%;margin:22px -30px -28px;box-shadow:0 18px 20px #0008}
      </style><main><div class="copy"><div class="eyebrow">BEZEL EVO</div><h1>Your screen.<br>Your layout.</h1><p>Clock, live PC stats and a little<br>room for your own style.</p><p class="note">Illustrative device render<br>Ember example theme / demo data</p></div><div class="device"><img alt="Ember theme with clock and CPU, GPU and memory widgets" src="${canvas}"><div class="ledge"></div></div></main>`);
    await render.evaluate(() => document.fonts.ready);
    await render.screenshot({ path: `${output}screen-render.png` });
    console.log('screen-render.png');
    await context.close();
  }
} finally {
  await browser?.close();
  server.kill();
}
