#!/usr/bin/env node
/* One command for working on the site. Rebuilds dist/ the moment a source file
   changes and runs a server beside it, so there is nothing to re-run by hand:
   save a file, refresh the browser, see the change.

   Usage:
     node watch.mjs              static server on :8000 — design and content work
     node watch.mjs --wrangler   wrangler dev instead, so /api/lead works too

   The static server sends `Cache-Control: no-store` with everything, so a plain
   refresh is always enough. No hard refresh, and no stale stylesheet pretending
   your change did not work. */

import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { stat, watch } from 'node:fs/promises';
import { dirname, extname, join, normalize, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const dist = join(root, 'dist');
const useWrangler = process.argv.includes('--wrangler');
const PORT = 8000;

/* dist/ is deliberately absent: the build writes there, and watching it would
   have the build trigger itself for ever. */
const WATCHED = ['content.json', 'assets', 'src'];

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.gif': 'image/gif',
  '.svg': 'image/svg+xml', '.webp': 'image/webp', '.avif': 'image/avif', '.ico': 'image/x-icon',
  '.mp4': 'video/mp4', '.webm': 'video/webm', '.woff': 'font/woff', '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};

/* ---------- Build ---------- */

let building = false;
let queued = false;

function build() {
  if (building) { queued = true; return Promise.resolve(); }
  building = true;
  const started = Date.now();

  return new Promise((resolve) => {
    const child = spawn(process.execPath, ['build.mjs'], {
      cwd: root, stdio: ['ignore', 'pipe', 'inherit'],
    });
    let out = '';
    child.stdout.on('data', (chunk) => { out += chunk; });
    child.on('close', (code) => {
      building = false;
      if (code === 0) {
        const left = (out.match(/^(\d+) placeholders? left/m) || [])[1];
        console.log(
          `  rebuilt in ${Date.now() - started}ms` +
          (left ? ` — ${left} placeholder${left === '1' ? '' : 's'} still in content.json` : ' — no placeholders left')
        );
      } else {
        console.error(`  BUILD FAILED (exit ${code}) — fix the error above and save again`);
      }
      if (queued) { queued = false; build().then(resolve); } else resolve();
    });
  });
}

/* ---------- Watch ---------- */

function watchAll() {
  const ac = new AbortController();
  let timer = null;

  for (const target of WATCHED) {
    (async () => {
      try {
        for await (const event of watch(join(root, target), { recursive: true, signal: ac.signal })) {
          // Editors write swap and dot files constantly; they are not content.
          if (event.filename && event.filename.split(sep).some((part) => part.startsWith('.'))) continue;
          const what = event.filename ? join(target, event.filename) : target;
          clearTimeout(timer);
          timer = setTimeout(() => { console.log(`\n  ${what} changed`); build(); }, 120);
        }
      } catch (error) {
        if (error.name !== 'AbortError') console.error(`  stopped watching ${target}: ${error.message}`);
      }
    })();
  }
  return ac;
}

/* ---------- Static server ---------- */

function serve() {
  createServer(async (req, res) => {
    let path = decodeURIComponent(new URL(req.url, `http://${req.headers.host}`).pathname);
    if (path.endsWith('/')) path += 'index.html';

    const file = join(dist, normalize(path));
    // Never serve outside dist/, whatever the request asks for.
    if (relative(dist, file).startsWith('..')) {
      res.writeHead(403, { 'Content-Type': 'text/plain' }).end('Forbidden');
      return;
    }

    try {
      const info = await stat(file);
      if (info.isDirectory()) throw new Error('directory');
      res.writeHead(200, {
        'Content-Type': TYPES[extname(file).toLowerCase()] || 'application/octet-stream',
        'Content-Length': info.size,
        'Cache-Control': 'no-store, must-revalidate',
      });
      createReadStream(file).pipe(res);
    } catch {
      console.log(`  404  ${path}`);
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end(
        `Not found: ${path}\n\n` +
        `If this is an image, check that the filename in content.json matches\n` +
        `the file actually sitting in assets/img/ — spelling included.\n`
      );
    }
  }).listen(PORT, () => {
    console.log(`\n  http://localhost:${PORT}  — caching is off, a plain refresh is enough`);
    console.log('  Ctrl+C to stop\n');
  });
}

/* ---------- Go ---------- */

console.log('  building…');
await build();

const ac = watchAll();
console.log(`  watching ${WATCHED.join(', ')} — save anything and it rebuilds itself`);

let child = null;
if (useWrangler) {
  child = spawn('npx', ['wrangler', 'dev'], { cwd: root, stdio: 'inherit' });
  child.on('close', (code) => process.exit(code ?? 0));
} else {
  serve();
}

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    ac.abort();
    if (child) child.kill();
    console.log('\n  stopped');
    process.exit(0);
  });
}
