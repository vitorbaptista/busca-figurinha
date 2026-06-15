// DEV-ONLY headless runner for the pill vertical-position probe (mirrors bench.mjs).
// Spawns a dev server, drives /pill-position.html in headless Chrome, prints the JSON
// the page writes to captures/bench-results.md.
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
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

const TIMEOUT_MS = 5 * 60 * 1000;

function startServer() {
  return new Promise((res, rej) => {
    const proc = spawn('npx', ['vite', '--port', '5301', '--clearScreen', 'false'], {
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
  const url = `http://localhost:${server.port}/pill-position.html`;
  await page.goto(url, { waitUntil: 'load', timeout: 60000 });
  await page.waitForFunction(() => document.title === 'bench done', { timeout: TIMEOUT_MS });
  const report = readFileSync(resolve('captures', 'bench-results.md'), 'utf8');
  process.stdout.write('\n' + report + '\n');
} catch (err) {
  console.error('PROBE FAILED:', err.message);
  process.exitCode = 1;
} finally {
  await browser?.close().catch(() => {});
  server?.proc.kill('SIGTERM');
  setTimeout(() => process.exit(process.exitCode ?? 0), 500);
}
