import { readFileSync, writeFileSync } from 'fs';
import { readdir } from 'fs/promises';
import { join } from 'path';

const ROOT = 'd:/creat studio/src';

const map = [
  // Black-on-terracotta button text → cream
  ["color: '#000',", "color: '#F4EFE6',"],
  ["color: '#000' }", "color: '#F4EFE6' }"],
  // Semantic colors (cool dark theme → editorial light theme)
  // RED
  ['border-red-500/30 bg-red-500/10 text-red-400', 'border-[#B53C2A]/30 bg-[#B53C2A]/08 text-[#B53C2A]'],
  ['border-red-500/30 bg-red-500/10', 'border-[#B53C2A]/30 bg-[#B53C2A]/08'],
  ['border-red-500/30 bg-red-500/5', 'border-[#B53C2A]/30 bg-[#B53C2A]/06'],
  ['bg-red-400', 'bg-[#B53C2A]'],
  ['text-red-400', 'text-[#B53C2A]'],
  ['text-red-300', 'text-[#B53C2A]'],
  // BLUE
  ['text-blue-400 border-blue-400/30', 'text-[#2A4A6B] border-[#2A4A6B]/30'],
  ['text-blue-400 hover:text-blue-300', 'text-[#2A4A6B] hover:text-[#1A3A5B]'],
  ['text-blue-400', 'text-[#2A4A6B]'],
  ['border-blue-400/30', 'border-[#2A4A6B]/30'],
  // GREEN
  ['text-green-400', 'text-[#4A6B3A]'],
  ['border-green-400/30 bg-green-500/10 text-green-100', 'border-[#4A6B3A]/30 bg-[#4A6B3A]/10 text-[#1A1612]'],
  // YELLOW
  ['text-yellow-400', 'text-[#C99A2E]'],
  ['border-yellow-400/30 bg-yellow-500/10 text-yellow-100', 'border-[#C99A2E]/30 bg-[#C99A2E]/10 text-[#1A1612]'],
  // RED (Toast)
  ['border-red-400/30 bg-red-500/10 text-red-100', 'border-[#B53C2A]/30 bg-[#B53C2A]/10 text-[#1A1612]'],
  // Orange leftovers
  ['text-orange-500', 'text-[#BF4A2A]'],
  ['bg-orange-500', 'bg-[#BF4A2A]'],
  ['from-orange-500', 'from-[#BF4A2A]'],
  ['via-orange-500/5', 'via-[#BF4A2A]/10'],
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
