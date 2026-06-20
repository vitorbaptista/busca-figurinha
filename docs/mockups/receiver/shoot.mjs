// Render each receiver-flow mockup to a crisp PNG for the GitHub issue.
// Usage: node docs/mockups/receiver/shoot.mjs
import puppeteer from 'puppeteer-core';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { existsSync } from 'node:fs';

const DIR = dirname(fileURLToPath(import.meta.url));
const CHROME =
  ['/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser'].find((p) => {
    try { return existsSync(p); } catch { return false; }
  }) || '/usr/bin/google-chrome-stable';

// Per-file viewport width chosen so the layout never wraps; fullPage captures the height.
const SHOTS = [
  { file: '01-tela.html', out: '01-tela.png', width: 1380 },
  { file: '02-jornada.html', out: '02-jornada.png', width: 1760 },
  { file: '03-loop.html', out: '03-loop.png', width: 1260 },
];

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox', '--force-color-profile=srgb'] });
const page = await browser.newPage();

for (const s of SHOTS) {
  await page.setViewport({ width: s.width, height: 1000, deviceScaleFactor: 2 });
  await page.goto('file://' + join(DIR, s.file), { waitUntil: 'networkidle0', timeout: 30000 });
  try { await page.evaluate(() => document.fonts.ready); } catch {}
  await new Promise((r) => setTimeout(r, 600)); // let webfonts + emoji settle
  // Size the viewport to the content so a short page doesn't get clamped to 1000px of green padding.
  const h = await page.evaluate(() => Math.ceil(document.body.scrollHeight));
  await page.setViewport({ width: s.width, height: h, deviceScaleFactor: 2 });
  await new Promise((r) => setTimeout(r, 150));
  await page.screenshot({ path: join(DIR, s.out), type: 'png', fullPage: true });
  console.log('shot', s.out);
}

await browser.close();
console.log('done →', DIR);
