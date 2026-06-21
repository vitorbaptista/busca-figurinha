// Rasterizes public/icons/icon.svg into the PNG sizes the PWA manifest + index.html reference,
// plus the home-screen shortcut glyphs. Run: node scripts/gen-icons.mjs  (requires sharp).
//
// The maskable icon is the same artwork — icon.svg already keeps its content inside the central
// safe zone on a solid background, so no extra padding is needed. apple-touch-icon is what iOS
// uses for "Add to Home Screen" (it ignores the SVG favicon); the solid bg means no transparency.

import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const iconsDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons');
const svgPath = join(iconsDir, 'icon.svg');

// Sizes rasterized straight from the app icon SVG.
const outputs = [
  { file: 'icon-192.png', size: 192 },
  { file: 'icon-512.png', size: 512 },
  { file: 'icon-maskable-512.png', size: 512 },
  { file: 'apple-touch-icon-180.png', size: 180 },
];

// Long-press launcher shortcuts — simple white glyphs on the app's green tile (matching the icon).
const shortcutBg = `<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#16a34a"/><stop offset="1" stop-color="#0b7d3b"/></linearGradient></defs>
  <rect width="96" height="96" rx="22" fill="url(#g)"/>`;
const shortcuts = [
  {
    file: 'shortcut-scan-96.png',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96">${shortcutBg}
      <g fill="none" stroke="#ffffff" stroke-width="7" stroke-linecap="round">
        <circle cx="42" cy="42" r="20"/><line x1="57" y1="57" x2="72" y2="72"/></g></svg>`,
  },
  {
    file: 'shortcut-trade-96.png',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96">${shortcutBg}
      <g fill="none" stroke="#ffffff" stroke-width="7" stroke-linecap="round" stroke-linejoin="round">
        <path d="M26 38 H64"/><path d="M56 30 L64 38 L56 46"/>
        <path d="M70 58 H32"/><path d="M40 50 L32 58 L40 66"/></g></svg>`,
  },
];

let sharp;
try {
  ({ default: sharp } = await import('sharp'));
} catch {
  console.error(
    'Could not load "sharp". Install it as a dev dependency, then re-run:\n' +
      '  npm i -D sharp\n' +
      '  node scripts/gen-icons.mjs',
  );
  process.exit(1);
}

const svg = await readFile(svgPath);

for (const { file, size } of outputs) {
  const png = await sharp(svg, { density: 384 }).resize(size, size).png().toBuffer();
  await writeFile(join(iconsDir, file), png);
  console.log(`wrote icons/${file} (${size}x${size})`);
}

for (const { file, svg: glyph } of shortcuts) {
  const png = await sharp(Buffer.from(glyph), { density: 384 }).resize(96, 96).png().toBuffer();
  await writeFile(join(iconsDir, file), png);
  console.log(`wrote icons/${file} (96x96)`);
}

console.log('Done.');
