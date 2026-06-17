// Harvest real glyph templates from manually verified prepared crops.
//
// This intentionally runs in a real browser through Vite because the atlas feature path is
// browser-canvas based. It appends selected, human-verified crop glyphs to
// src/ocr/glyphAtlasReal.ts; run scripts/export-atlas.mjs afterwards to refresh Android's
// glyph_atlas.bin.
import { execFileSync, spawn } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { gunzipSync } from 'node:zlib';
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

const REAL_PATH = resolve('src/ocr/glyphAtlasReal.ts');
const FEAT_LEN = 298;

const HARVESTS = [
  {
    label: 'IRQ20',
    fixture: resolve('android/app/src/test/resources/stickers/IRQ20_pixel_live_crop2.pgm.gz'),
  },
  {
    label: 'SWE8',
    fixture: resolve('android/app/src/test/resources/stickers/SWE8_pixel_close_crop0.pgm.gz'),
  },
  {
    label: 'SWE8',
    fixture: resolve('android/app/src/test/resources/stickers/SWE8_pixel_live_frame4_crop0.pgm.gz'),
  },
  {
    label: 'SWE8',
    fixture: resolve('android/app/src/test/resources/stickers/SWE8_pixel_live_dark_frame49_crop0.pgm.gz'),
  },
  {
    label: 'NED12',
    fixture: resolve('android/app/src/test/resources/stickers/NED12_pixel_live_dark_frame3_crop0.pgm.gz'),
    slices: [
      { label: 'N', x: 89, y: 47, w: 12, h: 34 },
      { label: 'E', x: 105, y: 42, w: 25, h: 46 },
      { label: 'D', x: 128, y: 45, w: 29, h: 44 },
      { label: '1', x: 166, y: 55, w: 22, h: 34 },
      { label: '2', x: 188, y: 59, w: 29, h: 33 },
    ],
  },
  {
    label: 'MEX15',
    fixture: resolve('android/app/src/test/resources/stickers/MEX15_pixel_live_frame48_crop0.pgm.gz'),
    slices: [
      { label: 'M', x: 82, y: 49, w: 28, h: 39 },
      { label: 'E', x: 106, y: 49, w: 25, h: 39 },
      { label: 'X', x: 126, y: 49, w: 26, h: 39 },
      { label: '1', x: 160, y: 42, w: 25, h: 42 },
      { label: '5', x: 184, y: 42, w: 31, h: 42 },
    ],
  },
  {
    label: 'MEX15',
    fixture: resolve('android/app/src/test/resources/stickers/MEX15_pixel_live_frame49_crop0.pgm.gz'),
    slices: [
      { label: 'M', x: 88, y: 46, w: 27, h: 44 },
      { label: 'E', x: 111, y: 46, w: 30, h: 44 },
      { label: 'X', x: 136, y: 51, w: 30, h: 39 },
      { label: '1', x: 176, y: 52, w: 25, h: 47 },
      { label: '5', x: 200, y: 42, w: 36, h: 57 },
    ],
  },
  {
    label: 'RSA19',
    fixture: resolve('android/app/src/test/resources/stickers/RSA19_pixel_live_crop0.pgm.gz'),
    slices: [
      { label: 'R', x: 149, y: 69, w: 36, h: 59 },
      { label: 'S', x: 188, y: 67, w: 38, h: 62 },
      { label: 'A', x: 226, y: 67, w: 38, h: 62 },
      { label: '1', x: 280, y: 68, w: 39, h: 60 },
      { label: '9', x: 319, y: 67, w: 50, h: 62 },
    ],
  },
  {
    label: 'AUT4',
    fixture: resolve('android/app/src/test/resources/stickers/AUT4_pixel_live_crop0.pgm.gz'),
    slices: [
      { label: 'A', x: 144, y: 66, w: 34, h: 53 },
      { label: 'U', x: 179, y: 68, w: 33, h: 54 },
      { label: 'T', x: 212, y: 68, w: 32, h: 54 },
      { label: '4', x: 263, y: 73, w: 45, h: 55 },
    ],
  },
  {
    label: 'RSA17',
    fixture: resolve('android/app/src/test/resources/stickers/RSA17_pixel_live_crop0.pgm.gz'),
    slices: [
      { label: 'R', x: 80, y: 53, w: 37, h: 31 },
      { label: 'S', x: 95, y: 51, w: 22, h: 33 },
      { label: 'A', x: 117, y: 51, w: 21, h: 30 },
      { label: '1', x: 142, y: 45, w: 18, h: 32 },
      { label: '7', x: 160, y: 45, w: 21, h: 32 },
    ],
  },
  {
    label: 'PAN1',
    fixture: resolve('android/app/src/test/resources/stickers/PAN1_pixel_live_crop0.pgm.gz'),
  },
  {
    label: 'GHA19',
    fixture: resolve('android/app/src/test/resources/stickers/GHA19_pixel_live_crop0.pgm.gz'),
  },
  {
    label: 'CIV12',
    fixture: resolve('android/app/src/test/resources/stickers/CIV12_pixel_live_frame59_crop0.pgm.gz'),
  },
  {
    label: 'RSA6',
    fixture: resolve('android/app/src/test/resources/stickers/RSA6_pixel_live_crop0.pgm.gz'),
  },
  {
    label: 'AUT8',
    fixture: resolve('android/app/src/test/resources/stickers/AUT8_pixel_live_crop0.pgm.gz'),
  },
  {
    label: 'AUS2',
    fixture: resolve('android/app/src/test/resources/stickers/AUS2_pixel_live_crop0.pgm.gz'),
  },
  {
    label: 'NZL18',
    fixture: resolve('android/app/src/test/resources/stickers/NZL18_pixel_live_crop0.pgm.gz'),
  },
  {
    label: 'CIV4',
    fixture: resolve('android/app/src/test/resources/stickers/CIV4_pixel_live_crop0.pgm.gz'),
  },
  {
    label: 'AUS18',
    fixture: resolve('android/app/src/test/resources/stickers/AUS18_pixel_live_crop0.pgm.gz'),
  },
  {
    label: 'MEX15',
    fixture: resolve('captures/datasets/combined-live-20260616-20260617/raw/pixel-live-20260617-090351/debug/frame-240/crop2.png'),
  },
  {
    label: 'MEX15',
    fixture: resolve('captures/datasets/combined-live-20260616-20260617/raw/pixel-live-20260617-090351/debug/frame-243/crop0.png'),
    slices: [
      { label: 'M', x: 123, y: 84, w: 25, h: 47 },
      { label: 'E', x: 148, y: 84, w: 37, h: 47 },
      { label: 'X', x: 190, y: 85, w: 26, h: 43 },
      { label: '1', x: 240, y: 80, w: 26, h: 49 },
      { label: '5', x: 266, y: 78, w: 43, h: 51 },
    ],
  },
  {
    label: 'MEX15',
    fixture: resolve('captures/datasets/combined-live-20260616-20260617/raw/pixel-live-20260617-090351/debug/frame-245/crop0.png'),
  },
  {
    label: 'TUN10',
    fixture: resolve('captures/datasets/combined-live-20260616-20260617/raw/pixel-live-20260617-090351/debug/frame-227/crop0.png'),
  },
  {
    label: 'TUN10',
    fixture: resolve('captures/datasets/combined-live-20260616-20260617/raw/pixel-live-20260617-090351/debug/frame-237/crop0.png'),
  },
];

function startServer() {
  return new Promise((res, rej) => {
    const proc = spawn('npx', ['vite', '--port', '5312', '--clearScreen', 'false'], {
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

function parseExistingRealAtlas(text) {
  const labels = text.match(/REAL_LABELS\s*=\s*"([^"]*)"/)?.[1] || '';
  const arrayBody = text.match(/REAL_FEATS_Q\s*=\s*Int8Array\.from\(\[([\s\S]*)\]\);/)?.[1] || '';
  const values = arrayBody
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map(Number);
  if (values.length !== labels.length * FEAT_LEN) {
    throw new Error(`existing atlas mismatch: labels=${labels.length} values=${values.length}`);
  }
  return { labels, values };
}

function writeRealAtlas(labels, values) {
  const chunks = [];
  for (let i = 0; i < values.length; i += 40) {
    chunks.push(values.slice(i, i + 40).join(','));
  }
  const out = `// AUTO-GENERATED by scripts/harvest-pixel-glyphs.mjs - real glyph feature vectors harvested from
// manually verified prepared crops, int8-quantized (value*127). These BLEND into
// the rendered atlas (glyphAtlas.ts) as in-font templates for the classes that appear in
// real captures. Rendered coverage of all 36 classes stays mandatory, so unseen codes do
// not depend on these samples. Do not hand-edit.
export const REAL_FEAT_LEN = ${FEAT_LEN};
export const REAL_LABELS = "${labels}";
export const REAL_FEATS_Q = Int8Array.from([
${chunks.join(',\n')}
]);
`;
  writeFileSync(REAL_PATH, out, 'utf8');
}

function parsePgm(bytes, path) {
  let pos = 0;
  const readToken = () => {
    while (pos < bytes.length) {
      const c = bytes[pos];
      if (c === 35) {
        while (pos < bytes.length && bytes[pos] !== 10) pos += 1;
      } else if (c <= 32) {
        pos += 1;
      } else {
        break;
      }
    }
    const start = pos;
    while (pos < bytes.length && bytes[pos] > 32) pos += 1;
    return bytes.subarray(start, pos).toString('ascii');
  };
  const magic = readToken();
  const width = Number(readToken());
  const height = Number(readToken());
  const max = Number(readToken());
  if (magic !== 'P5' || !width || !height || max !== 255) {
    throw new Error(`${path}: unsupported PGM header ${magic} ${width}x${height} ${max}`);
  }
  if (bytes[pos] <= 32) pos += 1;
  const pixels = bytes.subarray(pos, pos + width * height);
  if (pixels.length !== width * height) {
    throw new Error(`${path}: expected ${width * height} pixels, got ${pixels.length}`);
  }
  return { width, height, pixels: Array.from(pixels) };
}

function readImage(path) {
  if (path.endsWith('.pgm.gz')) {
    return parsePgm(gunzipSync(readFileSync(path)), path);
  }
  if (path.endsWith('.png')) {
    const bytes = execFileSync('magick', [path, '-colorspace', 'Gray', '-depth', '8', 'pgm:-']);
    return parsePgm(bytes, path);
  }
  throw new Error(`${path}: unsupported fixture format`);
}

function removePreviousHarvests(existing) {
  let labels = existing.labels;
  let values = [...existing.values];
  let changed = true;
  while (changed) {
    changed = false;
    for (const item of HARVESTS) {
      if (!labels.endsWith(item.label)) continue;
      labels = labels.slice(0, -item.label.length);
      values = values.slice(0, -item.label.length * FEAT_LEN);
      changed = true;
    }
  }
  return { labels, values };
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
  await page.goto(`http://localhost:${server.port}/atlas-export.html`, { waitUntil: 'load', timeout: 90000 });

  const harvested = [];
  for (const item of HARVESTS) {
    const image = readImage(item.fixture);
    const result = await page.evaluate(async ({ image, label, slices }) => {
      const { cropToMask, extractGlyphs, glyphFeature } = await import('/src/ocr/glyphFeatures.ts');
      const canvasFromPixels = (pixels, width, height) => {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        const data = ctx.createImageData(width, height);
        for (let i = 0; i < pixels.length; i += 1) {
          const v = pixels[i];
          const off = i * 4;
          data.data[off] = v;
          data.data[off + 1] = v;
          data.data[off + 2] = v;
          data.data[off + 3] = 255;
        }
        ctx.putImageData(data, 0, 0);
        return canvas;
      };

      if (slices) {
        const labels = [];
        const feats = [];
        const boxes = [];
        for (const slice of slices) {
          const pixels = [];
          for (let y = 0; y < slice.h; y += 1) {
            const row = (slice.y + y) * image.width + slice.x;
            for (let x = 0; x < slice.w; x += 1) pixels.push(image.pixels[row + x]);
          }
          const canvas = canvasFromPixels(pixels, slice.w, slice.h);
          const { mask, w, h } = cropToMask(canvas);
          let x0 = w;
          let y0 = h;
          let x1 = -1;
          let y1 = -1;
          let area = 0;
          for (let yy = 0; yy < h; yy += 1) {
            const row = yy * w;
            for (let xx = 0; xx < w; xx += 1) {
              if (mask[row + xx] !== 1) continue;
              area += 1;
              if (xx < x0) x0 = xx;
              if (yy < y0) y0 = yy;
              if (xx > x1) x1 = xx;
              if (yy > y1) y1 = yy;
            }
          }
          if (area < 6 || x1 < x0 || y1 < y0) {
            return { error: `${slice.label}: expected manual glyph ink, got area ${area}` };
          }
          labels.push(slice.label);
          feats.push(...Array.from(glyphFeature(mask, w, { x0, y0, x1, y1 })));
          boxes.push({
            label: slice.label,
            x: slice.x + x0,
            y: slice.y + y0,
            w: x1 - x0 + 1,
            h: y1 - y0 + 1,
            ar: (y1 - y0 + 1) / (x1 - x0 + 1),
          });
        }
        return { labels: labels.join(''), feats, boxes };
      }

      const canvas = canvasFromPixels(image.pixels, image.width, image.height);
      const glyphs = extractGlyphs(canvas);
      if (glyphs.length !== label.length) {
        return {
          error: `${label}: expected ${label.length} glyphs, got ${glyphs.length}`,
          boxes: glyphs.map((glyph) => ({ x: glyph.x, y: glyph.y, w: glyph.w, h: glyph.h, ar: glyph.ar })),
        };
      }
      return {
        labels: label,
        feats: glyphs.flatMap((glyph) => Array.from(glyph.feat)),
        boxes: glyphs.map((glyph) => ({ x: glyph.x, y: glyph.y, w: glyph.w, h: glyph.h, ar: glyph.ar })),
      };
    }, { image, label: item.label, slices: item.slices });
    if (result.error) throw new Error(`${result.error}: ${JSON.stringify(result.boxes)}`);
    console.log(`${item.label}: ${JSON.stringify(result.boxes)}`);
    harvested.push(result);
  }

  const existing = removePreviousHarvests(parseExistingRealAtlas(readFileSync(REAL_PATH, 'utf8')));
  let labels = existing.labels;
  const values = [...existing.values];
  for (const item of harvested) {
    labels += item.labels;
    for (const feat of item.feats) {
      values.push(Math.max(-127, Math.min(127, Math.round(feat * 127))));
    }
  }
  writeRealAtlas(labels, values);
  console.log(`wrote ${REAL_PATH}: labels=${labels.length} templates`);
} finally {
  await browser?.close();
  server?.proc?.kill();
}
