// Headless exporter for the glyph atlas. Spawns a Vite dev server, drives /atlas-export.html
// in headless system Chrome (the atlas MUST render in a real browser — node-canvas mis-renders
// per CLAUDE.md), reads the packed base64 the page builds, and writes the binary asset the
// native Android app loads. One command:
//
//   node scripts/export-atlas.mjs
//
// Output: android/app/src/main/assets/glyph_atlas.bin  (binary, format documented in
// src/dev/atlasExport.ts and parsed by android/.../ocr/Atlas.kt).
import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import puppeteer from 'puppeteer-core';

const CHROME =
  ['/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser'].find((p) => {
    try {
      readFileSync(p);
      return true;
    } catch {
      return false;
    }
  }) || '/usr/bin/google-chrome-stable';

const OUT = resolve('android/app/src/main/assets/glyph_atlas.bin');
const TIMEOUT_MS = 90 * 1000;

function startServer() {
  return new Promise((res, rej) => {
    const proc = spawn('npx', ['vite', '--port', '5311', '--clearScreen', 'false'], {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: process.env,
    });
    let out = '';
    const onData = (b) => {
      out += b.toString();
      const m = out.match(/Local:\s+http:\/\/localhost:(\d+)/);
      if (m) {
        proc.stdout.off('data', onData);
        res({ proc, port: Number(m[1]) });
      }
    };
    proc.stdout.on('data', onData);
    proc.stderr.on('data', (b) => (out += b.toString()));
    proc.on('exit', (code) => rej(new Error(`vite exited (${code})\n${out.slice(-500)}`)));
    setTimeout(() => rej(new Error(`vite did not start in 30s\n${out.slice(-500)}`)), 30000);
  });
}

let server;
let browser;
try {
  server = await startServer();
  browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
  const page = await browser.newPage();
  page.on('pageerror', (e) => console.error('[page error]', e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') console.error('[console]', m.text());
  });

  await page.goto(`http://localhost:${server.port}/atlas-export.html`, {
    waitUntil: 'load',
    timeout: TIMEOUT_MS,
  });
  await page.waitForFunction('window.__ATLAS_READY__ === true', { timeout: TIMEOUT_MS });

  const result = await page.evaluate(() => ({
    b64: window.__ATLAS_B64__ || null,
    info: window.__ATLAS_INFO__ || null,
    error: window.__ATLAS_ERROR__ || null,
  }));

  if (result.error) throw new Error(`atlas build failed in page: ${result.error}`);
  if (!result.b64) throw new Error('no atlas produced (window.__ATLAS_B64__ empty)');

  const bytes = Buffer.from(result.b64, 'base64');
  // Sanity-check the header we will hand to Kotlin.
  const magic = bytes.slice(0, 4).toString('ascii');
  const count = bytes.readInt32LE(4);
  const featLen = bytes.readInt32LE(8);
  if (magic !== 'ATL1') throw new Error(`bad magic ${magic}`);
  if (featLen !== 298) throw new Error(`unexpected FEAT_LEN ${featLen} (expected 298)`);
  const expected = 12 + count + count * featLen * 4;
  if (bytes.length !== expected) throw new Error(`size ${bytes.length} != expected ${expected}`);

  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, bytes);
  console.log(`wrote ${OUT}`);
  console.log(`  templates=${count} featLen=${featLen} bytes=${bytes.length} (${(bytes.length / 1024).toFixed(1)} KB)`);
} finally {
  await browser?.close();
  server?.proc?.kill();
}
