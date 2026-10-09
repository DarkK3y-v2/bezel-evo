// Serves the design canvas (`*.dc.html` artboards) through the DC shim, so a
// browser shows them with their sample values. Each artboard answers with
// the header `X-DC-Mode: dynamic|static` (and `X-DC-Reason` when static).
//   node scripts/fidelity/serve-mock.mjs [port]   (prints the URL; Ctrl+C stops)
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { shimArtboard } from './dc-shim.mjs';

/** The design canvas of the studio redesign. */
export const DESIGN = fileURLToPath(new URL('../../../../.jdi/phases/studio-redesign/design/project/', import.meta.url));

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.css': 'text/css' };

async function answer(root, request, response) {
  const path = decodeURIComponent(new URL(request.url, 'http://mock').pathname);
  const file = normalize(join(root, path));
  if (!file.startsWith(normalize(root + sep)) && file !== normalize(root)) {
    response.writeHead(403).end();
    return;
  }
  // The DC runtime is replaced by the shim: its script is not needed.
  if (path.endsWith('/support.js')) {
    response.writeHead(200, { 'Content-Type': TYPES['.js'] }).end('');
    return;
  }
  try {
    const body = await readFile(file);
    if (!file.endsWith('.dc.html')) {
      response.writeHead(200, { 'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream' }).end(body);
      return;
    }
    const shimmed = shimArtboard(body.toString('utf8'));
    const headers = { 'Content-Type': TYPES['.html'], 'X-DC-Mode': shimmed.mode };
    if (shimmed.reason) headers['X-DC-Reason'] = encodeURIComponent(shimmed.reason);
    response.writeHead(200, headers).end(shimmed.html);
  } catch {
    response.writeHead(404).end();
  }
}

/**
 * Starts the mock server on `port` (0 = any free one).
 * @returns {Promise<{ url: string, close: () => Promise<void> }>}
 */
export function startMockServer({ root = DESIGN, port = 0 } = {}) {
  const server = createServer((request, response) => {
    answer(root, request, response).catch(() => response.writeHead(500).end());
  });
  return new Promise((resolve) => {
    server.listen(port, '127.0.0.1', () => {
      resolve({
        url: `http://127.0.0.1:${server.address().port}`,
        close: () => new Promise((done) => server.close(() => done())),
      });
    });
  });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === normalize(process.argv[1])) {
  const { url } = await startMockServer({ port: Number(process.argv[2]) || 0 });
  console.log(`${url}/Main.dc.html`);
}
