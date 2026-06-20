// One-off: screenshot each phone frame in colecao-falta.html into falta/<id>.png (+ an overview).
import puppeteer from 'puppeteer-core';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { mkdirSync, existsSync } from 'node:fs';

const DIR = dirname(fileURLToPath(import.meta.url));
const OUT = join(DIR, 'falta');
if (!existsSync(OUT)) mkdirSync(OUT);

const CHROME =
  ['/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser'].find((p) => {
    try { return existsSync(p); } catch { return false; }
  }) || '/usr/bin/google-chrome-stable';

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox'] });
const page = await browser.newPage();
await page.setViewport({ width: 1820, height: 1100, deviceScaleFactor: 2 });
await page.goto('file://' + join(DIR, 'colecao-falta.html'), { waitUntil: 'networkidle0', timeout: 30000 });
await new Promise((r) => setTimeout(r, 800)); // let webfonts settle

for (const id of ['opt1', 'opt2', 'opt3', 'opt4']) {
  const el = await page.$('#' + id);
  await el.screenshot({ path: join(OUT, id + '.png'), type: 'png' });
  console.log('shot', id);
}

// Overview: the whole stage of 4 phones + captions, on a neutral dark bg.
await page.setViewport({ width: 1760, height: 1240, deviceScaleFactor: 1.4 });
await new Promise((r) => setTimeout(r, 300));
const full = await page.screenshot({ path: join(OUT, 'overview.png'), type: 'png', fullPage: true });
console.log('shot overview', full.length, 'bytes');

await browser.close();
console.log('done →', OUT);
