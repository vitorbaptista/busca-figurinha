// Headless runner for the detection-accuracy benchmark. Spawns a dev server on a
// free port, drives /bench.html in headless system Chrome until it finishes, then
// prints captures/bench-results.md. Makes `npm run bench` a single command that any
// agent can run in its own worktree to self-measure accuracy.
//
//   node scripts/bench.mjs           # full run (static + robustness + video)
//   node scripts/bench.mjs --quick   # skip the slow video section
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import puppeteer from 'puppeteer-core';

const QUICK = process.argv.includes('--quick');
const LATENCY = process.argv.includes('--latency');
const LATENCY_SHARP = process.argv.includes('--latency-sharp');
// `--pixel` runs the REAL-FRAME (Pixel dataset) accuracy benchmark instead. Any extra
// `--key=value` args (split, roiTop, roiRect, fastConf, maxBoxes, limit, note) are forwarded
// to /bench-pixel.html as query params so ROI/gate sweeps need no rebuild:
//   node scripts/bench.mjs --pixel --split=test --roiRect=0.18,0.32,0.82,0.58 --maxBoxes=2
const PIXEL = process.argv.includes('--pixel');
const PIXEL_KEYS = ['split', 'roiTop', 'roiRect', 'fastConf', 'maxBoxes', 'fgDelta', 'engine', 'limit', 'note', 'debugFrame', 'deriveAliases', 'gatePost', 'gateMargin', 'gateMLP', 'recenter', 'model', 'model2', 'ttaMode', 'ttaVotes', 'ttaPost', 'ttaMargin', 'ttaSoft', 'ttaHigh', 'ttaJit', 'ttaMaxBoxes'];
const pixelQuery = () => {
  const p = new URLSearchParams();
  for (const arg of process.argv.slice(2)) {
    const m = arg.match(/^--([a-zA-Z]+)=(.*)$/);
    if (m && PIXEL_KEYS.includes(m[1])) p.set(m[1], m[2]);
  }
  const s = p.toString();
  return s ? `?${s}` : '';
};
const CHROME =
  ['/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser'].find((p) => {
    try {
      readFileSync(p);
      return true;
    } catch {
      return false;
    }
  }) || '/usr/bin/google-chrome-stable';

// The pixel bench runs the full pipeline (with tesseract fallback) over ~370 frames, so it
// needs a longer ceiling than the synthetic bench.
const TIMEOUT_MS = (PIXEL ? 15 : 5) * 60 * 1000;

function startServer() {
  return new Promise((res, rej) => {
    const proc = spawn('npx', ['vite', '--port', '5300', '--clearScreen', 'false'], {
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
  const q = LATENCY_SHARP ? '?latencysharp' : LATENCY ? '?latency' : QUICK ? '?quick' : '';
  const url = PIXEL
    ? `http://localhost:${server.port}/bench-pixel.html${pixelQuery()}`
    : `http://localhost:${server.port}/bench.html${q}`;
  await page.goto(url, { waitUntil: 'load', timeout: 60000 });
  await page.waitForFunction(() => document.title === 'bench done', { timeout: TIMEOUT_MS });
  const report = readFileSync(
    resolve('captures', PIXEL ? 'bench-pixel-results.md' : 'bench-results.md'),
    'utf8',
  );
  process.stdout.write('\n' + report + '\n');
} catch (err) {
  console.error('BENCH FAILED:', err.message);
  process.exitCode = 1;
} finally {
  await browser?.close().catch(() => {});
  server?.proc.kill('SIGTERM');
  // Vite can linger; force-exit so the command returns promptly.
  setTimeout(() => process.exit(process.exitCode ?? 0), 500);
}
