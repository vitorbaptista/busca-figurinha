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
const CHROME =
  ['/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser'].find((p) => {
    try {
      readFileSync(p);
      return true;
    } catch {
      return false;
    }
  }) || '/usr/bin/google-chrome-stable';

const TIMEOUT_MS = 5 * 60 * 1000;

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
  const q = LATENCY ? '?latency' : QUICK ? '?quick' : '';
  const url = `http://localhost:${server.port}/bench.html${q}`;
  await page.goto(url, { waitUntil: 'load', timeout: 60000 });
  await page.waitForFunction(() => document.title === 'bench done', { timeout: TIMEOUT_MS });
  const report = readFileSync(resolve('captures', 'bench-results.md'), 'utf8');
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
