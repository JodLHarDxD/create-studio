import { readFileSync, writeFileSync } from 'fs';
import { readdir } from 'fs/promises';
import { join } from 'path';

const ROOT = 'd:/creat studio/src';

const map = [
  // Catch-all rgba(255,255,255,X) → rgba(26,22,18,X) on .tsx files only
  // (keep index.css alone — those inset highlights are legit)
  ['rgba(255,255,255,0.025)', 'rgba(26,22,18,0.04)'],
  ['rgba(255,255,255,0.01)',  'rgba(26,22,18,0.02)'],
  ['rgba(255,255,255,0.07)',  'rgba(26,22,18,0.08)'],
  ['rgba(255,255,255,0.11)',  'rgba(26,22,18,0.13)'],
  ['rgba(255,255,255,0.13)',  'rgba(26,22,18,0.15)'],
  ['rgba(255,255,255,0.14)',  'rgba(26,22,18,0.16)'],
  ['rgba(255,255,255,0.15)',  'rgba(26,22,18,0.18)'],
  ['rgba(255,255,255,0.17)',  'rgba(26,22,18,0.2)'],
  ['rgba(255,255,255,0.18)',  'rgba(26,22,18,0.22)'],
  ['rgba(255,255,255,0.25)',  'rgba(26,22,18,0.28)'],
  ['rgba(255,255,255,0.3)',   'rgba(26,22,18,0.35)'],
  ['rgba(255,255,255,0.4)',   'rgba(26,22,18,0.45)'],
  // Heavy box-shadow on cream needs softer
  ['boxShadow: \'0 32px 64px rgba(0,0,0,0.8)\'', "boxShadow: '0 24px 56px rgba(26,22,18,0.18), 0 6px 16px rgba(26,22,18,0.08)'"],
  ['box-shadow: 0 32px 64px rgba(0,0,0,0.8)', 'box-shadow: 0 24px 56px rgba(26,22,18,0.18), 0 6px 16px rgba(26,22,18,0.08)'],
  ['rgba(0,0,0,0.8)', 'rgba(26,22,18,0.4)'],
  ['rgba(0,0,0,0.75)', 'rgba(26,22,18,0.35)'],
  ['rgba(0,0,0,0.7)', 'rgba(26,22,18,0.3)'],
  ['rgba(0,0,0,0.6)', 'rgba(26,22,18,0.25)'],
  ['rgba(0,0,0,0.5)', 'rgba(26,22,18,0.18)'],
  ['rgba(0,0,0,0.4)', 'rgba(26,22,18,0.14)'],
  ['rgba(0,0,0,0.35)', 'rgba(26,22,18,0.12)'],
  ['rgba(0,0,0,0.3)', 'rgba(26,22,18,0.10)'],
];

async function walk(dir, out = []) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    if (e.name === 'node_modules') continue;
    const full = join(dir, e.name);
    if (e.isDirectory()) await walk(full, out);
    else if (/\.tsx?$/.test(e.name)) out.push(full);
  }
  return out;
}

const files = await walk(ROOT);
let total = 0;
for (const f of files) {
  let s = readFileSync(f, 'utf8');
  const orig = s;
  for (const [k, v] of map) s = s.split(k).join(v);
  if (s !== orig) {
    writeFileSync(f, s, 'utf8');
    total++;
    console.log('  updated:', f.split(/[\\/]/).slice(-2).join('/'));
  }
}
console.log('TOTAL FILES UPDATED:', total);
