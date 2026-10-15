import { test } from 'node:test';
import assert from 'node:assert/strict';
import { memoryStatus } from '../../src/memory-status.js';
import { translator } from '../../src/i18n/index.js';
import { createBridge } from '../../src/bridge.js';
import { createDemoBackend } from '../../src/demo-backend.js';

for (const locale of ['en', 'pt-BR', 'it']) {
  test(`memory presentation uses backend totals and distinguishes unavailable from zero (${locale})`, () => {
    const t = translator(locale);
    const missing = memoryStatus(null, t);
    assert.equal(missing.label, t('shell.memoryChip', { value: t('shell.memoryUnavailable') }));
    assert.deepEqual(missing.rows, []);
    assert.equal(missing.demo, false);
    assert.equal(missing.note, t('shell.memoryMethod'));
    const measured = memoryStatus({ totalBytes: 312_000_000, processes: [{ pid: 8, role: 'studio', bytes: 7_500_000 }, { pid: 9, role: 'webview', bytes: null }] }, t);
    assert.equal(measured.label, t('shell.memoryChip', { value: t('shell.memoryMB', { value: 312 }) }));
    assert.equal(measured.rows[0], t('shell.memoryProcess', { name: t('shell.memoryRole.studio'), pid: 8, value: t('shell.memoryMB', { value: 8 }) }));
    assert.ok(measured.rows[1].includes(t('shell.memoryUnavailable')));
    assert.ok(measured.title.includes(measured.rows.join('\n')));
    assert.equal(memoryStatus({ totalBytes: 0 }, t).label, t('shell.memoryChip', { value: t('shell.memoryMB', { value: 0 }) }));
    assert.ok(memoryStatus({}, t).title.includes(t('shell.memoryUnavailable')));
  });
}

test('memory bridge exposes only the read-only command and passes its report through', async () => {
  const report = { totalBytes: null, processes: [] };
  const calls = [];
  const bridge = createBridge({ location: { hostname: 'localhost', search: '' }, __TAURI__: { core: { invoke: async (...args) => { calls.push(args); return report; } } } });
  assert.deepEqual(await bridge.memoryUsage(), report);
  assert.deepEqual(calls, [['memory_usage']]);
});

test('demo memory is explicitly marked, aggregates its processes, and returns independent reports', async () => {
  const demo = createDemoBackend('turing88');
  const report = await demo.memoryUsage();
  assert.equal(report.demo, true);
  assert.equal(report.totalBytes, 312_000_000);
  assert.equal(report.processes.reduce((total, p) => total + p.bytes, 0), report.totalBytes);
  assert.equal(new Set(report.processes.map(p => p.pid)).size, report.processes.length);
  assert.deepEqual([...new Set(report.processes.map(p => p.role))].sort(), ['light', 'sensors', 'studio', 'webview']);
  const t = translator('it');
  const status = memoryStatus(report, t);
  assert.ok(status.label.endsWith(t('shell.memoryDemoBadge')));
  assert.equal(status.note, t('shell.memoryDemo'));
  report.processes[0].bytes = 0;
  assert.equal((await demo.memoryUsage()).processes[0].bytes, 90_000_000);
});
