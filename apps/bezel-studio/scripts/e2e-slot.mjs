// Runs Playwright specs in one of at most two slots on this machine, so
// parallel agents and worktrees do not overload it: each run takes a slot
// (a lock file in the system's temp folder, freed when its process is
// gone), its own free port (E2E_PORT, read by playwright.config.mjs, which
// starts its own scripts/serve-e2e.py) and 2 workers unless told otherwise.
//   node scripts/e2e-slot.mjs [specs…] [playwright options…]
import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const APP = fileURLToPath(new URL('../', import.meta.url));
const SLOTS = 2;
const DIR = join(tmpdir(), 'bezel-e2e-slots');
const WAIT_MS = 2000;

function alive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error.code === 'EPERM';
  }
}

/** Takes a free slot (a stale one, whose process is gone, is free): its lock path, or null. */
function takeSlot() {
  mkdirSync(DIR, { recursive: true });
  for (let slot = 0; slot < SLOTS; slot += 1) {
    const lock = join(DIR, `slot-${slot}.lock`);
    try {
      writeFileSync(lock, String(process.pid), { flag: 'wx' });
      return lock;
    } catch {
      const owner = Number(readFileSync(lock, 'utf8'));
      if (!owner || !alive(owner)) {
        rmSync(lock, { force: true });
        slot -= 1;
      }
    }
  }
  return null;
}

function freePort() {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });
}

let lock = takeSlot();
while (!lock) {
  console.log(`e2e-slot: both slots busy, waiting…`);
  await new Promise((done) => setTimeout(done, WAIT_MS));
  lock = takeSlot();
}
const release = () => rmSync(lock, { force: true });
process.on('exit', release);
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => process.exit(130));

const args = process.argv.slice(2);
// --full runs the package's complete npm test command under the same slot.
const full = args[0] === '--full';
if (full) args.shift();
if (!args.some((arg) => arg.startsWith('--workers'))) args.push('--workers=2');
const port = await freePort();
console.log(`e2e-slot: ${lock} on port ${port}`);
const cli = join(APP, 'node_modules', '@playwright', 'test', 'cli.js');
const child = spawn(full ? 'npm' : process.execPath, full ? ['test', '--', ...args] : [cli, 'test', ...args], {
  shell: full && process.platform === 'win32',
  cwd: APP,
  stdio: 'inherit',
  env: { ...process.env, E2E_PORT: String(port) },
});
child.on('exit', (code) => process.exit(code ?? 1));
