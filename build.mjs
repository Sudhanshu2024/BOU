#!/usr/bin/env node
/* Builds the publishable site into dist/.
   Usage: node build.mjs [--strict]
   --strict fails the build if any [PLACEHOLDER] is still in the content.

   Only dist/ is served. Source files (content.json, src/, the docs) stay out of
   the deployment, which is why the Pages output directory is `dist`. */

import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { renderPage } from './src/page.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const dist = join(root, 'dist');
const strict = process.argv.includes('--strict');

const content = JSON.parse(await readFile(join(root, 'content.json'), 'utf8'));

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });

const html = renderPage(content);
await writeFile(join(dist, 'index.html'), html, 'utf8');
await cp(join(root, 'assets'), join(dist, 'assets'), { recursive: true });

console.log(`dist/index.html — ${html.split('\n').length} lines, plus assets/`);

/* Walk the content and report anything still in [SQUARE BRACKETS]. */
const placeholders = [];
(function walk(node, path) {
  if (typeof node === 'string') {
    if (/\[[^\]]+\]/.test(node)) placeholders.push(`${path}: ${node}`);
  } else if (Array.isArray(node)) {
    node.forEach((item, i) => walk(item, `${path}[${i}]`));
  } else if (node && typeof node === 'object') {
    for (const [key, value] of Object.entries(node)) {
      if (key === '_readme') continue;
      walk(value, path ? `${path}.${key}` : key);
    }
  }
})(content, '');

if (placeholders.length) {
  console.log(`\n${placeholders.length} placeholder${placeholders.length === 1 ? '' : 's'} left in content.json:`);
  for (const p of placeholders) console.log(`  ${p}`);
  if (strict) {
    console.error('\nBuild failed: --strict and placeholders remain.');
    process.exit(1);
  }
} else {
  console.log('No placeholders left — ready to launch.');
}
