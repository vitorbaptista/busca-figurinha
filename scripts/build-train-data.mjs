// Drives headless Chrome over /traindata.html to generate the codeNet training data:
// synthetic samples + real harvested crops → captures/train-data/*.{bin,labels.txt}.
//   node scripts/build-train-data.mjs [--count=8000] [--synth-only] [--real-only]
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import puppeteer from 'puppeteer-core';

const arg = (k, d) => {
  const m = process.argv.find((a) => a.startsWith(`--${k}=`));
  return m ? m.split('=')[1] : d;
};
const COUNT = arg('count', '8000');
const SYNTH_ONLY = process.argv.includes('--synth-only');
const REAL_ONLY = process.argv.includes('--real-only');
const CHROME =
  ['/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser'].find((p) => {
    try { readFileSync(p); return true; } catch { return false; }
  }) || '/usr/bin/google-chrome-stable';

function startServer() {
  return new Promise((res, rej) => {
    const proc = spawn('npx', ['vite', '--port', '5310', '--clearScreen', 'false'], {
      stdio: ['ignore', 'pipe', 'pipe'], env: process.env,
    });
    let out = '';
    const onData = (b) => {
      out += b.toString();
      const m = out.match(/Local:\s+http:\/\/localhost:(\d+)/);
      if (m) { proc.stdout.off('data', onData); res({ proc, port: Number(m[1]) }); }
    };
    proc.stdout.on('data', onData);
    proc.stderr.on('data', (b) => (out += b.toString()));
    proc.on('exit', (code) => rej(new Error(`vite exited (${code})\n${out.slice(-500)}`)));
    setTimeout(() => rej(new Error(`vite did not start\n${out.slice(-500)}`)), 30000);
  });
}

let server, browser;
try {
  server = await startServer();
  browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const run = async (q, label) => {
    const page = await browser.newPage();
    page.on('console', (m) => { const t = m.text(); if (/error/i.test(t)) console.error('[page]', t); });
    page.on('pageerror', (e) => console.error('[pageerror]', e.message));
    console.log(`\n▶ ${label} …`);
    await page.goto(`http://localhost:${server.port}/traindata.html${q}`, { waitUntil: 'load', timeout: 60000 });
    await page.waitForFunction(() => document.title === 'bench done', { timeout: 20 * 60 * 1000 });
    console.log(`✓ ${label}: ${await page.$eval('#out', (e) => e.textContent)}`);
    await page.close();
  };
  if (!REAL_ONLY) await run(`?mode=synth&count=${COUNT}`, `synth (${COUNT})`);
  if (!SYNTH_ONLY) await run('?mode=real', 'real harvest');
} catch (err) {
  console.error('BUILD-TRAIN-DATA FAILED:', err.message);
  process.exitCode = 1;
} finally {
  await browser?.close().catch(() => {});
  server?.proc.kill('SIGTERM');
  setTimeout(() => process.exit(process.exitCode ?? 0), 500);
}
