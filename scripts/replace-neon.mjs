import { readFileSync, writeFileSync } from 'fs';
import { readdir } from 'fs/promises';
import { join } from 'path';

const ROOT = 'd:/creat studio/src';

const map = [
  // Neon semantic colors → editorial muted equivalents
  ['#4ade80', '#4A6B3A'],
  ['#f87171', '#B53C2A'],
  ['#fbbf24', '#C99A2E'],
  ['rgba(74,222,128,', 'rgba(74,107,58,'],
  ['rgba(74, 222, 128,', 'rgba(74,107,58,'],
  ['rgba(248,113,113,', 'rgba(181,60,42,'],
  ['rgba(248, 113, 113,', 'rgba(181,60,42,'],
  ['rgba(251,191,36,', 'rgba(201,154,46,'],
  ['rgba(251, 191, 36,', 'rgba(201,154,46,'],
  // Leftover warm dark stragglers
  ['#2a2826', '#C4BDB1'],
  ['#2A2826', '#C4BDB1'],
  // background: 'rgba(3,3,3,*)' modal scrim → soft espresso
  ['rgba(3,3,3,0.85)', 'rgba(26,22,18,0.35)'],
  ['rgba(3,3,3,0.8)',  'rgba(26,22,18,0.3)'],
  ['rgba(3,3,3,0.6)',  'rgba(26,22,18,0.2)'],
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
