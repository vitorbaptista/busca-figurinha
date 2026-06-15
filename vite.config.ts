import { defineConfig, type Plugin } from 'vite';
import preact from '@preact/preset-vite';
import { VitePWA } from 'vite-plugin-pwa';
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

// GitHub Pages serves from a repo subpath. Set GH_PAGES=1 in CI to use it.
const base = process.env.GH_PAGES ? '/busca-figurinha/' : '/';

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
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
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
