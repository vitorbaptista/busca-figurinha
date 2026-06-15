// Rasterizes public/icons/icon.svg into the PNG sizes the PWA manifest references.
// Run with: node scripts/gen-icons.mjs   (requires sharp: npm i -D sharp)
//
// The maskable icon is the same artwork — icon.svg already keeps its content inside
// the central safe zone on a solid background, so no extra padding is needed.

import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const iconsDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons');
const svgPath = join(iconsDir, 'icon.svg');

const outputs = [
  { file: 'icon-192.png', size: 192 },
  { file: 'icon-512.png', size: 512 },
  { file: 'icon-maskable-512.png', size: 512 },
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

console.log('Done.');
