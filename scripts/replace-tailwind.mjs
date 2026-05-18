import { readFileSync, writeFileSync } from 'fs';
import { readdir } from 'fs/promises';
import { join } from 'path';

const ROOT = 'd:/creat studio/src';

const map = [
  // class strings — dark bg/text Tailwind → editorial
  ['bg-black/80 backdrop-blur-sm', 'backdrop-blur-md'],
  ['bg-black/80', 'bg-[rgba(26,22,18,0.4)]'],
  ['bg-black/60', 'bg-[rgba(26,22,18,0.3)]'],
  ['bg-black/40', 'bg-[rgba(26,22,18,0.2)]'],
  ['bg-black', 'bg-[#F4EFE6]'],
  ['bg-white/[0.02]', 'bg-[rgba(26,22,18,0.03)]'],
  ['bg-white/5', 'bg-[rgba(26,22,18,0.05)]'],
  ['bg-white/10', 'bg-[rgba(26,22,18,0.10)]'],
  ['bg-white/20', 'bg-[rgba(26,22,18,0.18)]'],
  ['bg-white/90', 'bg-[#1A1612]/90'],
  ['bg-white', 'bg-[#1A1612]'],
  ['text-white/20', 'text-[#9B948A]/60'],
  ['text-white/30', 'text-[#9B948A]'],
  ['text-white/40', 'text-[#6B645C]'],
  ['text-white/60', 'text-[#6B645C]'],
  ['text-white/70', 'text-[#1A1612]/80'],
  ['text-white/90', 'text-[#1A1612]'],
  ['text-white', 'text-[#1A1612]'],
  ['text-black', 'text-[#F4EFE6]'],
  ['border-white/5', 'border-[rgba(26,22,18,0.07)]'],
  ['border-white/10', 'border-[rgba(26,22,18,0.10)]'],
  ['border-white/15', 'border-[rgba(26,22,18,0.13)]'],
  ['border-white/20', 'border-[rgba(26,22,18,0.18)]'],
  ['border-white', 'border-[#1A1612]'],
  ['hover:bg-white/5', 'hover:bg-[rgba(26,22,18,0.05)]'],
  ['hover:bg-white/90', 'hover:bg-[#1A1612]/90'],
  ['hover:text-white', 'hover:text-[#1A1612]'],
  ['placeholder:text-white/20', 'placeholder:text-[#9B948A]/60'],
  // Tailwind hex bracket forms still pointing to dark
  ['bg-[#0a0a0a]', 'bg-[#EFEAE0]'],
  ['bg-[#1e1e1e]', 'bg-[#E8E2D6]'],
  ['bg-[#252526]', 'bg-[#DDD5C6]'],
  ['bg-[#030303]', 'bg-[#EFEAE0]'],
  ['bg-[#080808]', 'bg-[#F4EFE6]'],
  ['text-[#cccccc]', 'text-[#1A1612]'],
  ['text-[#858585]', 'text-[#6B645C]'],
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
