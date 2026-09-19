#!/usr/bin/env node
/* Builds index.html from content.json.
   Usage: node build.mjs [--strict]
   --strict fails the build if any [PLACEHOLDER] is still in the content. */

import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { renderPage } from './src/page.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const strict = process.argv.includes('--strict');

const content = JSON.parse(await readFile(join(root, 'content.json'), 'utf8'));
const html = renderPage(content);
await writeFile(join(root, 'index.html'), html, 'utf8');

console.log(`index.html — ${html.split('\n').length} lines from content.json`);

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
