import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import { VitePWA } from 'vite-plugin-pwa';

// GitHub Pages serves from a repo subpath. Set GH_PAGES=1 in CI to use it.
const base = process.env.GH_PAGES ? '/figurinhas-app/' : '/';

export default defineConfig({
  base,
  plugins: [
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
