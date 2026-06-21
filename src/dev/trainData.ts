// DEV-ONLY training-data generator for the neural code recognizer (codeNet). Runs in headless
// Chrome (served at /traindata.html, driven by scripts/build-train-data.mjs) so it uses the REAL
// browser canvas + the app's actual Anton font, and the EXACT crop the runtime feeds the model.
//
//   ?mode=synth&count=6000      → render synthetic light-text-on-dark-pill samples (+negatives)
//   ?mode=real                  → harvest the de-rotated raw crops from the labeled Pixel frames
//
// Each record = a letterboxed INPUT_W×INPUT_H grayscale buffer (codeImage.letterboxGray) + a
// label string ("CIV12", or "__neg__"). POSTed in batches to /traindata/save which appends to
// captures/train-data/<file>.{bin,labels.txt}. Synthetic mirrors the native recipe's augment
// ranges (rotation ±4°, blur 0.15–0.85, contrast 0.75–1.35, noise σ2–9, crop jitter) PLUS
// low-contrast variants (the real failure mode: faint light text on a barely-darker pill).

import { letterboxGray, INPUT_W, INPUT_H } from '../ocr/codeImage';
import { checklist } from '../data/checklist';
import { findCodeBoxes, rawCropCandidates } from '../ocr/locate';
import { CONFIG } from '../config';

const Q = new URLSearchParams(location.search);
const MODE = Q.get('mode') || 'synth';
const COUNT = Number(Q.get('count') || '6000');
const status = document.getElementById('out')!;

const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const ri = (a: number, b: number) => Math.floor(rnd(a, b + 1));
const pick = <T>(xs: T[]): T => xs[ri(0, xs.length - 1)];

function uint8ToB64(buf: Uint8Array): string {
  let s = '';
  for (let i = 0; i < buf.length; i += 8192) {
    s += String.fromCharCode.apply(null, buf.subarray(i, i + 8192) as unknown as number[]);
  }
  return btoa(s);
}

async function postBatch(file: string, records: Array<{ label: string; b64: string }>, reset: boolean) {
  await fetch('/traindata/save', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ file, reset, records }),
  });
}

// ---------- Synthetic rendering ----------
const blank = (w: number, h: number): HTMLCanvasElement => {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
};

/** Render one synthetic crop: a dark rounded pill with light knockout text on a lighter card,
 *  augmented. Returns the cropped pill region (+margin), the same shape the detector hands the
 *  recognizer. `code` null → a negative (card/noise, no readable code). */
function renderSynthetic(code: string | null): HTMLCanvasElement {
  // Base canvas big enough for a pill + card margin.
  const W = ri(150, 260);
  const H = ri(54, 96);
  const base = blank(W, H);
  const ctx = base.getContext('2d', { willReadFrequently: true })!;

  // Card background (lighter) with a gentle gradient + slight tone.
  const cardGray = ri(150, 235);
  ctx.fillStyle = `rgb(${cardGray},${cardGray},${cardGray})`;
  ctx.fillRect(0, 0, W, H);

  // Dark rounded pill. Low-contrast variant (30% of the time) keeps pill close to the text gray.
  const lowContrast = Math.random() < 0.3;
  const pillGray = lowContrast ? ri(70, 120) : ri(28, 78);
  const textGray = lowContrast ? Math.min(245, pillGray + ri(35, 80)) : ri(190, 248);
  const pw = ri(W * 0.62, W * 0.92);
  const ph = ri(H * 0.5, H * 0.8);
  const px = (W - pw) / 2 + rnd(-6, 6);
  const py = (H - ph) / 2 + rnd(-4, 4);
  const r = ph / 2;
  ctx.fillStyle = `rgb(${pillGray},${pillGray},${pillGray})`;
  ctx.beginPath();
  ctx.moveTo(px + r, py);
  ctx.arcTo(px + pw, py, px + pw, py + ph, r);
  ctx.arcTo(px + pw, py + ph, px, py + ph, r);
  ctx.arcTo(px, py + ph, px, py, r);
  ctx.arcTo(px, py, px + pw, py, r);
  ctx.closePath();
  ctx.fill();

  if (code) {
    // Format "TEAM 12" / "TEAM12" (82% spaced, like the native display form).
    const m = /^([A-Z]+)(\d+)$/.exec(code);
    const text = m && Math.random() < 0.82 ? `${m[1]} ${m[2]}` : code;
    const fontPx = Math.round(ph * rnd(0.5, 0.72));
    ctx.font = `${fontPx}px Anton, Oswald, Impact, sans-serif`;
    ctx.fillStyle = `rgb(${textGray},${textGray},${textGray})`;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';
    ctx.fillText(text, px + pw / 2 + rnd(-4, 4), py + ph / 2 + rnd(-2, 2));
  } else {
    // Negative: maybe some non-code text / fine print on the card.
    if (Math.random() < 0.5) {
      ctx.fillStyle = `rgb(${ri(60, 140)},${ri(60, 140)},${ri(60, 140)})`;
      ctx.font = `${ri(8, 16)}px Oswald, sans-serif`;
      ctx.fillText(pick(['FIFA WORLD CUP', 'OFFICIAL', 'PANINI', '2026', '© FIFA']), W / 2, H / 2);
    }
  }

  // ---- Augment into the output crop with ctx filters (blur/contrast/brightness) + rotation ----
  const angle = (rnd(-5, 5) * Math.PI) / 180;
  // Heavier defocus range — the real hand-held frames are softer than the old 0.15–1.1.
  const blurPx = Math.random() < 0.6 ? rnd(0.2, 2.2) : 0;
  const contrast = rnd(0.7, 1.4);
  const bright = rnd(0.8, 1.2);
  const out = blank(W, H);
  const octx = out.getContext('2d', { willReadFrequently: true })!;
  octx.fillStyle = `rgb(${cardGray},${cardGray},${cardGray})`;
  octx.fillRect(0, 0, W, H);
  octx.filter = `blur(${blurPx}px) contrast(${contrast}) brightness(${bright})`;
  octx.translate(W / 2, H / 2);
  octx.rotate(angle);
  octx.drawImage(base, -W / 2, -H / 2);
  octx.setTransform(1, 0, 0, 1, 0, 0);
  octx.filter = 'none';

  // Directional motion blur (hand shake along the code) — the dominant real degradation. Composite
  // a few faint shifted copies to smear horizontally (and occasionally vertically).
  if (Math.random() < 0.45) {
    const k = ri(2, 8);
    const vert = Math.random() < 0.25;
    octx.globalAlpha = 1 / (k + 1);
    for (let s = 1; s <= k; s++) octx.drawImage(out, vert ? 0 : s, vert ? s : 0);
    octx.globalAlpha = 1;
  }
  // Small/far pill: lose thin-stroke detail via downscale→upscale (real pills are only 22–48px tall).
  if (Math.random() < 0.45) {
    const f = rnd(0.32, 0.72);
    const tmp = blank(Math.max(8, Math.round(W * f)), Math.max(4, Math.round(H * f)));
    const tctx = tmp.getContext('2d', { willReadFrequently: true })!;
    tctx.imageSmoothingEnabled = true;
    tctx.drawImage(out, 0, 0, tmp.width, tmp.height);
    octx.imageSmoothingEnabled = true;
    octx.drawImage(tmp, 0, 0, W, H);
  }

  // Sensor noise.
  const sigma = Math.random() < 0.5 ? rnd(2, 9) : 0;
  if (sigma > 0) {
    const img = octx.getImageData(0, 0, W, H);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      const n = (Math.random() + Math.random() + Math.random() - 1.5) * sigma;
      d[i] = d[i + 1] = d[i + 2] = Math.max(0, Math.min(255, d[i] + n));
    }
    octx.putImageData(img, 0, 0);
  }

  // Crop the pill region + jittered margin (mirrors cropRegion's ~0.18 pad).
  const padX = pw * rnd(0.1, 0.28);
  const padY = ph * rnd(0.1, 0.3);
  const cx = Math.max(0, px - padX);
  const cy = Math.max(0, py - padY);
  const cw = Math.min(W - cx, pw + padX * 2);
  const ch = Math.min(H - cy, ph + padY * 2);
  const crop = blank(Math.round(cw), Math.round(ch));
  crop.getContext('2d', { willReadFrequently: true })!.drawImage(out, cx, cy, cw, ch, 0, 0, crop.width, crop.height);
  return crop;
}

async function loadImage(url: string): Promise<HTMLCanvasElement> {
  const img = new Image();
  img.src = url;
  await img.decode();
  const c = blank(img.naturalWidth, img.naturalHeight);
  c.getContext('2d')!.drawImage(img, 0, 0);
  return c;
}

(async () => {
  await document.fonts.load('32px Anton');
  await document.fonts.load('16px Oswald');
  const codes = checklist.entries.map((e) => e.code);

  if (MODE === 'synth') {
    let batch: Array<{ label: string; b64: string }> = [];
    let first = true;
    let made = 0;
    const flush = async () => {
      if (!batch.length) return;
      await postBatch('syn', batch, first);
      first = false;
      batch = [];
    };
    // FULL closed-set coverage: cycle EVERY code (re-shuffled each pass) so each of the 980 album
    // codes is rendered ~equally often — "overfit to all possible codes" is the goal (the output
    // space is the fixed album, and at inference we only ever see one of these). Per-code variety
    // (each rendered many times with independent augmentation) teaches the code, not a single render.
    let pass: string[] = [];
    let ci = 0;
    while (made < COUNT) {
      // ~16% negatives (card/logo/fine-print — teach the recognizer to REJECT non-pills, the FP guard).
      const neg = Math.random() < 0.16;
      let code: string | null = null;
      if (!neg) {
        if (ci >= pass.length) {
          pass = [...codes];
          for (let i = pass.length - 1; i > 0; i--) { const j = ri(0, i); [pass[i], pass[j]] = [pass[j], pass[i]]; }
          ci = 0;
        }
        code = pass[ci++];
      }
      const crop = renderSynthetic(code);
      const buf = letterboxGray(crop);
      batch.push({ label: neg ? '__neg__' : code!, b64: uint8ToB64(buf) });
      made++;
      if (batch.length >= 150) {
        status.textContent = `synth ${made}/${COUNT}…`;
        await flush();
      }
    }
    await flush();
    status.textContent = `synth done: ${made}`;
    document.title = 'bench done';
    return;
  }

  // ---- Real harvest: de-rotated raw crops from the labeled frames, split-aware. ----
  // Use the chosen rect ROI so detection matches the production-candidate config.
  (CONFIG as unknown as { detect: { roiRect: unknown } }).detect.roiRect = {
    left: 0.18,
    top: 0.32,
    right: 0.82,
    bottom: 0.58,
  };
  const manifest = (await (await fetch('/pixel/manifest')).json()) as Array<{
    frameId: string;
    verifiedCode: string;
    status: string;
    split: string;
  }>;
  const buckets: Record<string, Array<{ label: string; b64: string }>> = {};
  const resetDone: Record<string, boolean> = {};
  const push = async (split: string, rec: { label: string; b64: string }) => {
    const file = `real_${split}`;
    (buckets[file] ??= []).push(rec);
    if (buckets[file].length >= 100) {
      await postBatch(file, buckets[file], !resetDone[file]);
      resetDone[file] = true;
      buckets[file] = [];
    }
  };
  for (let i = 0; i < manifest.length; i++) {
    const row = manifest[i];
    status.textContent = `real ${i + 1}/${manifest.length}…`;
    const frame = await loadImage(`/pixel/frame?id=${encodeURIComponent(row.frameId)}`);
    const boxes = findCodeBoxes(frame).slice(0, 3); // score-sorted, best first
    if (row.status === 'confirmed') {
      // The best-scoring box is the pill (label = code) ONLY when detection is confident; a weak
      // top box on a shattered frame is junk, so skip it (the model learns those from synthetic
      // low-contrast variants instead). EVERY other box on the frame is a non-pill (logo, header,
      // legal text) → label __neg__, which teaches the recognizer to REJECT them (the FP guard).
      for (let bi = 0; bi < boxes.length; bi++) {
        const crop = rawCropCandidates(frame, boxes[bi])[0];
        const rec = { label: bi === 0 ? row.verifiedCode : '__neg__', b64: uint8ToB64(letterboxGray(crop)) };
        if (bi === 0 && boxes[bi].score < 0.7) continue; // weak top box on a shattered frame = junk
        await push(row.split, rec);
      }
    } else {
      for (const b of boxes) {
        const crop = rawCropCandidates(frame, b)[0];
        await push(row.split, { label: '__neg__', b64: uint8ToB64(letterboxGray(crop)) });
      }
    }
  }
  for (const [file, recs] of Object.entries(buckets)) {
    if (recs.length) await postBatch(file, recs, !resetDone[file]);
  }
  status.textContent = `real done; INPUT ${INPUT_W}x${INPUT_H}`;
  document.title = 'bench done';
})();
