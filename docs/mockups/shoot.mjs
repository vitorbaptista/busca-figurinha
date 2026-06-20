// One-off: screenshot each style mockup into thumbs/<key>.png
import puppeteer from 'puppeteer-core';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { readdirSync, mkdirSync, existsSync } from 'node:fs';

const DIR = dirname(fileURLToPath(import.meta.url));
const THUMBS = join(DIR, 'thumbs');
if (!existsSync(THUMBS)) mkdirSync(THUMBS);

const CHROME =
  ['/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser'].find((p) => {
    try { return existsSync(p); } catch { return false; }
  }) || '/usr/bin/google-chrome-stable';

const files = readdirSync(DIR).filter((f) => f.endsWith('.html') && f !== 'index.html');

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox'] });
const page = await browser.newPage();
// Wide enough that all three phone frames sit in one row. deviceScaleFactor < 1 shrinks the
// output to a lightweight thumbnail (1320 * 0.5 = 660px wide); JPEG keeps the file small.
await page.setViewport({ width: 1320, height: 1040, deviceScaleFactor: 0.5 });

for (const f of files) {
  const key = f.replace(/\.html$/, '');
  await page.goto('file://' + join(DIR, f), { waitUntil: 'networkidle0', timeout: 30000 });
  // Give web fonts / CSS animations a beat to settle.
  await new Promise((r) => setTimeout(r, 700));
  await page.screenshot({
    path: join(THUMBS, key + '.jpg'),
    type: 'jpeg',
    quality: 78,
    clip: { x: 0, y: 0, width: 1320, height: 1040 },
  });
  console.log('shot', key);
}

await browser.close();
console.log('done →', THUMBS);
