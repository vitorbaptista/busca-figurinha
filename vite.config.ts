import { defineConfig, type Plugin } from 'vite';
import preact from '@preact/preset-vite';
import { VitePWA } from 'vite-plugin-pwa';
import { appendFileSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { execSync } from 'node:child_process';

// GitHub Pages serves from a repo subpath. Set GH_PAGES=1 in CI to use it.
const base = process.env.GH_PAGES ? '/busca-figurinha/' : '/';

// Version shown in Ajustes, injected at build time so it's never a stale hardcoded string.
// semver is the human-readable release (bump in package.json); the short commit hash auto-updates
// every deploy, so the displayed identity always traces to an exact build even if semver isn't bumped.
const appVersion = (JSON.parse(readFileSync(resolve('package.json'), 'utf8')) as { version: string })
  .version;
const commitHash = (() => {
  try {
    return execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim();
  } catch {
    return 'dev'; // git absent (e.g. a tarball build) → graceful fallback
  }
})();

// Dev-only: lets the app (in ?debug) POST a captured camera frame so we can save
// real device frames to ./captures and iterate on OCR offline. Not part of the build.
function captureSaver(): Plugin {
  return {
    name: 'capture-saver',
    apply: 'serve',
    configureServer(server) {
      // Serve the OCR test fixtures (gitignored, never built) so the dev harness can
      // load them without shipping them in public/.
      server.middlewares.use('/samples', (req, res) => {
        const name = (req.url || '').replace(/^\//, '').replace(/[^a-z0-9._-]/gi, '');
        try {
          const buf = readFileSync(resolve('dev-fixtures', name));
          res.setHeader('Content-Type', 'image/jpeg');
          res.end(buf);
        } catch {
          res.statusCode = 404;
          res.end();
        }
      });

      // The labeled accuracy benchmark dataset (committed in data/raw/stickers).
      // `/dataset/list` returns the images + extracted video frames; `/dataset/<path>`
      // serves a file. Used by bench.html (dev-only; never built).
      const DATASET = resolve('data/raw/stickers');
      server.middlewares.use('/dataset', (req, res) => {
        const url = (req.url || '/').split('?')[0];
        if (url === '/list' || url === '/list/') {
          let images: string[] = [];
          let videos: string[] = [];
          let frames: string[] = [];
          try {
            const all = readdirSync(DATASET);
            images = all.filter((f) => /\.(jpe?g|png)$/i.test(f));
            videos = all.filter((f) => /\.(mp4|mov|webm)$/i.test(f));
          } catch {
            /* dataset dir may be absent */
          }
          try {
            frames = readdirSync(resolve(DATASET, 'frames'))
              .filter((f) => /\.(jpe?g|png)$/i.test(f))
              .sort();
          } catch {
            /* frames not extracted yet */
          }
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ images, videos, frames }));
          return;
        }
        // Serve a file under the dataset dir (sanitized: no .., only safe chars).
        const rel = url.replace(/^\//, '').replace(/\.\.+/g, '').replace(/[^a-z0-9._/-]/gi, '');
        try {
          const buf = readFileSync(resolve(DATASET, rel));
          res.setHeader('Content-Type', 'image/jpeg');
          res.end(buf);
        } catch {
          res.statusCode = 404;
          res.end();
        }
      });

      // The labeled REAL-FRAME accuracy dataset (local artifacts; gitignored). Used by
      // bench-pixel.html (dev-only, never built) to measure the real web pipeline against
      // manually-verified Pixel frames. `/pixel/manifest` returns the ground-truth rows;
      // `/pixel/frame?id=<frame_id>` serves that frame's full PNG; `/pixel/log` writes the
      // report to captures/bench-pixel-results.md. Dataset dir is overridable via env so a
      // future relabeled capture can be pointed at without code change.
      const PIXEL_DATASET = resolve(
        process.env.PIXEL_DATASET || 'captures/datasets/combined-live-20260616-20260617',
      );
      // Minimal CSV parse (the GT file has no quoted fields; notes use ';' not ','). Splits on
      // commas, trims, and keeps only the leading expected columns so a stray trailing comma
      // can't shift the indices that matter.
      const parseGt = (): Array<Record<string, string>> => {
        const text = readFileSync(resolve(PIXEL_DATASET, 'ground_truth_verification.csv'), 'utf8');
        const lines = text.split(/\r?\n/).filter((l) => l.length > 0);
        const header = lines[0].split(',');
        return lines.slice(1).map((line) => {
          const cells = line.split(',');
          const row: Record<string, string> = {};
          header.forEach((h, i) => (row[h.trim()] = (cells[i] ?? '').trim()));
          return row;
        });
      };
      server.middlewares.use('/pixel', (req, res) => {
        const url = (req.url || '/').split('?')[0];
        const query = new URLSearchParams((req.url || '').split('?')[1] || '');
        if (url === '/manifest' || url === '/manifest/') {
          try {
            const rows = parseGt()
              .filter((r) => r.status === 'confirmed' || r.status === 'not_sticker')
              .map((r) => ({
                frameId: r.frame_id,
                verifiedCode: r.verified_code,
                status: r.status,
                split: r.split,
                sourceDir: r.source_dir,
                frameNumber: Number(r.frame_number),
              }));
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(rows));
          } catch (err) {
            res.statusCode = 500;
            res.end(String(err));
          }
          return;
        }
        if (url === '/frame' || url === '/frame/') {
          // Resolve raw/<source_dir>/debug/frame-<n>/frame.png from the frame_id row.
          const id = query.get('id') || '';
          try {
            const row = parseGt().find((r) => r.frame_id === id);
            if (!row) {
              res.statusCode = 404;
              res.end();
              return;
            }
            const safeDir = row.source_dir.replace(/\.\.+/g, '').replace(/[^a-z0-9._-]/gi, '');
            const n = Number(row.frame_number);
            const file = resolve(PIXEL_DATASET, 'raw', safeDir, 'debug', `frame-${n}`, 'frame.png');
            const buf = readFileSync(file);
            res.setHeader('Content-Type', 'image/png');
            res.end(buf);
          } catch {
            res.statusCode = 404;
            res.end();
          }
          return;
        }
        if (url === '/log') {
          if (req.method !== 'POST') {
            res.statusCode = 405;
            res.end();
            return;
          }
          let body = '';
          req.on('data', (chunk) => (body += chunk));
          req.on('end', () => {
            try {
              mkdirSync(resolve('captures'), { recursive: true });
              writeFileSync(resolve('captures', 'bench-pixel-results.md'), body);
              res.statusCode = 200;
              res.end('ok');
            } catch (err) {
              res.statusCode = 500;
              res.end(String(err));
            }
          });
          return;
        }
        res.statusCode = 404;
        res.end();
      });

      // Training-data sink (dev-only): the in-browser generator (src/dev/trainData.ts) POSTs
      // batches of letterboxed grayscale crops + labels here; we append raw bytes to
      // captures/train-data/<file>.bin (9216 u8 per record) and labels to <file>.labels.txt,
      // for the tfjs-node trainer to read. ?reset=1 truncates first.
      server.middlewares.use('/traindata/save', (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.end();
          return;
        }
        let body = '';
        req.on('data', (chunk) => (body += chunk));
        req.on('end', () => {
          try {
            const { file, reset, records } = JSON.parse(body) as {
              file: string;
              reset?: boolean;
              records: Array<{ label: string; b64: string }>;
            };
            const safe = (file || 'data').replace(/[^a-z0-9_-]/gi, '');
            const dir = resolve('captures', 'train-data');
            mkdirSync(dir, { recursive: true });
            const binPath = resolve(dir, `${safe}.bin`);
            const lblPath = resolve(dir, `${safe}.labels.txt`);
            if (reset) {
              writeFileSync(binPath, Buffer.alloc(0));
              writeFileSync(lblPath, '');
            }
            const bins: Buffer[] = [];
            let labels = '';
            for (const r of records) {
              bins.push(Buffer.from(r.b64, 'base64'));
              labels += r.label + '\n';
            }
            appendFileSync(binPath, Buffer.concat(bins));
            appendFileSync(lblPath, labels);
            res.statusCode = 200;
            res.end('ok');
          } catch (err) {
            res.statusCode = 500;
            res.end(String(err));
          }
        });
      });

      // Benchmark report sink (separate from /__log so a bench run and a harness run
      // don't clobber each other). Writes captures/bench-results.md.
      server.middlewares.use('/bench-log', (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.end();
          return;
        }
        let body = '';
        req.on('data', (chunk) => (body += chunk));
        req.on('end', () => {
          try {
            mkdirSync(resolve('captures'), { recursive: true });
            writeFileSync(resolve('captures', 'bench-results.md'), body);
            res.statusCode = 200;
            res.end('ok');
          } catch (err) {
            res.statusCode = 500;
            res.end(String(err));
          }
        });
      });
      server.middlewares.use('/__capture', (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.end();
          return;
        }
        let body = '';
        req.on('data', (chunk) => (body += chunk));
        req.on('end', () => {
          try {
            const { name, dataUrl } = JSON.parse(body) as { name: string; dataUrl: string };
            const b64 = dataUrl.replace(/^data:image\/\w+;base64,/, '');
            const dir = resolve('captures');
            mkdirSync(dir, { recursive: true });
            const safe = (name || 'frame').replace(/[^a-z0-9_-]/gi, '').slice(0, 60);
            writeFileSync(resolve(dir, `${safe}.jpg`), Buffer.from(b64, 'base64'));
            res.statusCode = 200;
            res.end('ok');
          } catch (err) {
            res.statusCode = 500;
            res.end(String(err));
          }
        });
      });
      // Dev-only: text results sink so harness output can be read from disk even
      // when the renderer is busy (Tesseract may run on the main thread).
      server.middlewares.use('/__log', (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.end();
          return;
        }
        let body = '';
        req.on('data', (chunk) => (body += chunk));
        req.on('end', () => {
          try {
            const dir = resolve('captures');
            mkdirSync(dir, { recursive: true });
            writeFileSync(resolve(dir, 'ocr-results.txt'), body);
            res.statusCode = 200;
            res.end('ok');
          } catch (err) {
            res.statusCode = 500;
            res.end(String(err));
          }
        });
      });
    },
  };
}

export default defineConfig({
  base,
  define: {
    __APP_VERSION__: JSON.stringify(appVersion),
    __APP_COMMIT__: JSON.stringify(commitHash),
  },
  // Allow tunneling the dev server through ngrok (e.g. to test on a real phone).
  // A leading dot matches the domain and all its subdomains, so any *.ngrok-free.app URL works.
  server: {
    allowedHosts: ['.ngrok-free.app'],
  },
  // Ship only the app. ocr-test.html (a dev-only OCR harness) is still served in
  // `vite dev` but is left out of the production build.
  build: {
    rollupOptions: {
      input: resolve('index.html'),
    },
  },
  plugins: [
    captureSaver(),
    preact(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/icon.svg'],
      // Tesseract pulls its wasm/worker/lang data from a CDN at runtime; cache them
      // so the scanner keeps working offline after the first successful load.
      workbox: {
        // Include the codeNet model (model.json + weights.bin) so the neural recognizer works
        // offline after first load, like the rest of the app.
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}', 'models/**/*.{json,bin}'],
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/.*tesseract.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'tesseract-assets',
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 60 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      manifest: {
        name: 'Troca Figurinhas — Copa 2026',
        short_name: 'Figurinhas',
        description: 'Escaneie figurinhas da Copa 2026 e saiba na hora quais guardar.',
        lang: 'pt-BR',
        theme_color: '#0b7d3b',
        background_color: '#0f1115',
        display: 'standalone',
        orientation: 'portrait',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.ts'],
  },
});
