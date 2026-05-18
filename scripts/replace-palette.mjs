import { readFileSync, writeFileSync, statSync } from 'fs';
import { readdir } from 'fs/promises';
import { join } from 'path';

const ROOT = 'd:/creat studio/src';

// Ordered: longest keys first to avoid partial overwrites
const map = [
  // Surfaces (dark → cream/paper)
  ['#09090E', '#F4EFE6'],
  ['#0D0D13', '#EFEAE0'],
  ['#111118', '#E8E2D6'],
  ['#16161E', '#DDD5C6'],
  ['#1C1C24', '#C9C0AE'],
  ['#23232C', '#B6AC97'],
  ['#1A1A22', '#FBF8F2'],
  ['#1F1F28', '#ECE6DA'],
  // Legacy obsidian
  ['#030303', '#EFEAE0'],
  ['#050505', '#EFEAE0'],
  ['#080808', '#F4EFE6'],
  ['#0a0a0a', '#EFEAE0'],
  ['#0A0A0A', '#EFEAE0'],
  ['#1e1e1e', '#E8E2D6'],
  ['#1E1E1E', '#E8E2D6'],
  ['#252526', '#DDD5C6'],
  // Text (cool white → espresso)
  ['#EBEBF0', '#1A1612'],
  ['#8A8AA0', '#6B645C'],
  ['#505068', '#9B948A'],
  ['#2E2E40', '#C4BDB1'],
  ['#2E2E42', '#C4BDB1'],
  // Legacy warm text
  ['#cccccc', '#1A1612'],
  ['#CCCCCC', '#1A1612'],
  ['#858585', '#6B645C'],
  ['#a09590', '#6B645C'],
  ['#A09590', '#6B645C'],
  ['#5e5855', '#9B948A'],
  ['#5E5855', '#9B948A'],
  ['#3a3836', '#C4BDB1'],
  ['#3A3836', '#C4BDB1'],
  ['#f7f3ee', '#1A1612'],
  ['#F7F3EE', '#1A1612'],
  // Indigo accent → terracotta
  ['#5E6AD2', '#BF4A2A'],
  ['#5e6ad2', '#BF4A2A'],
  // RGBA indigo → RGBA terracotta
  ['rgba(94,106,210,',   'rgba(191,74,42,'],
  ['rgba(94, 106, 210,', 'rgba(191, 74, 42,'],
  // White overlays → espresso overlays
  ['rgba(255,255,255,0.015)','rgba(26,22,18,0.02)'],
  ['rgba(255,255,255,0.02)', 'rgba(26,22,18,0.03)'],
  ['rgba(255,255,255,0.03)', 'rgba(26,22,18,0.04)'],
  ['rgba(255,255,255,0.04)', 'rgba(26,22,18,0.05)'],
  ['rgba(255,255,255,0.05)', 'rgba(26,22,18,0.07)'],
  ['rgba(255,255,255,0.06)', 'rgba(26,22,18,0.08)'],
  ['rgba(255,255,255,0.08)', 'rgba(26,22,18,0.10)'],
  ['rgba(255,255,255,0.09)', 'rgba(26,22,18,0.11)'],
  ['rgba(255,255,255,0.10)', 'rgba(26,22,18,0.13)'],
  ['rgba(255,255,255,0.1)',  'rgba(26,22,18,0.13)'],
  ['rgba(255,255,255,0.12)', 'rgba(26,22,18,0.15)'],
  ['rgba(255,255,255,0.16)', 'rgba(26,22,18,0.18)'],
  ['rgba(255,255,255,0.20)', 'rgba(26,22,18,0.22)'],
  ['rgba(255,255,255,0.2)',  'rgba(26,22,18,0.22)'],
  ['rgba(255, 255, 255, 0.05)', 'rgba(26,22,18,0.07)'],
  ['rgba(255, 255, 255, 0.08)', 'rgba(26,22,18,0.10)'],
  ['rgba(255, 255, 255, 0.1)',  'rgba(26,22,18,0.13)'],
  // Font swaps
  ['"Syne", sans-serif',                              '"Fraunces", serif'],
  ['"Syne", ui-sans-serif, system-ui, sans-serif',    '"Fraunces", "Iowan Old Style", Georgia, serif'],
  ['"Syne", ui-sans-serif',                           '"Fraunces", serif'],
  ['"DM Sans", sans-serif',                           '"Inter", sans-serif'],
  ['"DM Sans", ui-sans-serif, system-ui, sans-serif', '"Inter", ui-sans-serif, system-ui, sans-serif'],
];

async function walk(dir, out = []) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    if (e.name === 'node_modules') continue;
    const full = join(dir, e.name);
    if (e.isDirectory()) await walk(full, out);
    else if (/\.(tsx?|css)$/.test(e.name)) out.push(full);
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
    console.log('  updated:', f.replace(ROOT + '\\', '').replace(ROOT + '/', ''));
  }
}
console.log('TOTAL FILES UPDATED:', total);
