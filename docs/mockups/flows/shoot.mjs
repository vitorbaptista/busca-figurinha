// Render the two new-flow mockups to crisp PNGs for their GitHub issues.
// Usage: node docs/mockups/flows/shoot.mjs
import puppeteer from 'puppeteer-core';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { existsSync } from 'node:fs';

const DIR = dirname(fileURLToPath(import.meta.url));
const CHROME =
  ['/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser'].find((p) => {
    try { return existsSync(p); } catch { return false; }
  }) || '/usr/bin/google-chrome-stable';

const SHOTS = [
  { file: '01-importar.html', out: '01-importar.png', width: 1340 },
  { file: '02-cacar.html', out: '02-cacar.png', width: 1760 },
];

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox', '--force-color-profile=srgb'] });
const page = await browser.newPage();

for (const s of SHOTS) {
  await page.setViewport({ width: s.width, height: 1000, deviceScaleFactor: 2 });
  await page.goto('file://' + join(DIR, s.file), { waitUntil: 'networkidle0', timeout: 30000 });
  try { await page.evaluate(() => document.fonts.ready); } catch {}
  await new Promise((r) => setTimeout(r, 600));
  const h = await page.evaluate(() => Math.ceil(document.body.scrollHeight));
  await page.setViewport({ width: s.width, height: h, deviceScaleFactor: 2 });
  await new Promise((r) => setTimeout(r, 150));
  await page.screenshot({ path: join(DIR, s.out), type: 'png', fullPage: true });
  console.log('shot', s.out);
}

await browser.close();
console.log('done →', DIR);
