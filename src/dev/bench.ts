// DEV-ONLY accuracy benchmark (served at /bench.html; run headless via `npm run bench`).
// Measures how well the REAL production pipeline (findCodeBoxes → codeCropCandidates →
// recognizeMany → bestMatchFromText, plus the multi-frame confirmer for video)
// recovers sticker codes from the labeled dataset in data/raw/stickers/.
//
// THREE sections:
//  1. Static     — single-frame recall on each labeled photo (deterministic headline).
//  2. Robustness — each single-code close-up under transforms that keep it READABLE
//                  (rotation, blur, noise, downscale, darkness, JPEG). Target: 100%
//                  — "perfect as long as the image is readable".
//  3. Video      — the real front-camera flow over extracted frames + the confirmer.
//
// Ground truth is the FILENAME. Output: Markdown → captures/bench-results.md (/bench-log).
// `?quick` skips the slow video section.
import { findCodeBoxes } from '../ocr/locate';
import { createHybridOcrEngine as createOcrEngine } from '../ocr/hybridEngine';
import { recognizeFrameInOrder } from '../ocr/recognize';
import { createConfirmer } from '../domain/confirm';
import { checklist } from '../data/checklist';
import { CONFIG } from '../config';

const QUICK = new URLSearchParams(location.search).has('quick');
// `?latency` measures how FAST the pipeline runs (not how accurate) over the real
// front-camera video frames — the closest thing we have to live conditions.
const LATENCY = new URLSearchParams(location.search).has('latency');
// `?latencysharp` measures latency over the SHARP static close-ups instead — the real
// use-case (phone flat, one sticker shown close + steady + focus-locked) produces sharp
// frames, where the hybrid recognizer takes its fast path. The blurry video frames hide
// that win (they fall back to tesseract), so this is the honest use-case latency number.
const LATENCY_SHARP = new URLSearchParams(location.search).has('latencysharp');

const root = document.getElementById('out')!;
const status = document.createElement('div');
root.replaceChildren(status);

/** avg / median / p90 / max of a list of ms timings, rounded. */
function stats(xs: number[]): { avg: number; median: number; p90: number; max: number } {
  if (!xs.length) return { avg: 0, median: 0, p90: 0, max: 0 };
  const s = [...xs].sort((a, b) => a - b);
  const at = (p: number) => s[Math.min(s.length - 1, Math.floor(p * s.length))];
  return {
    avg: Math.round(xs.reduce((a, b) => a + b, 0) / xs.length),
    median: Math.round(at(0.5)),
    p90: Math.round(at(0.9)),
    max: Math.round(s[s.length - 1]),
  };
}

/** Pull the expected codes out of a dataset filename (the labels). */
function labelsOf(filename: string): string[] {
  const stem = filename.replace(/\.[a-z0-9]+$/i, '');
  const codes = new Set<string>();
  for (const m of stem.matchAll(/[A-Z]{2,4}\d{1,3}/gi)) codes.add(m[0].toUpperCase());
  return [...codes];
}

async function loadImage(url: string): Promise<HTMLCanvasElement> {
  const img = new Image();
  img.src = url;
  await img.decode();
  const c = document.createElement('canvas');
  c.width = img.naturalWidth;
  c.height = img.naturalHeight;
  c.getContext('2d')!.drawImage(img, 0, 0);
  return c;
}

interface FrameRead {
  found: string[];
  reads: string[];
  dbg?: string;
}

async function recognizeFrame(
  ocr: ReturnType<typeof createOcrEngine>,
  frame: HTMLCanvasElement,
): Promise<FrameRead> {
  const boxes = findCodeBoxes(frame);
  const dbg = boxes
    .slice(0, 3)
    .map(
      (b) =>
        `[s${b.score.toFixed(2)} ${Math.round(b.w)}x${Math.round(b.h)} ${b.orient} t${b.tilt === null ? '-' : Math.round(b.tilt)}]`,
    )
    .join('');
  // Mirror the production strategy: OCR crops in score order, one at a time, skipping a
  // box's flip crop once its upright crop resolves. NOT stop-on-first here, so a static
  // multi-sticker frame still surfaces every distinct code (the robustness/static sets are
  // single-code, so this is identical to stop-on-first for them).
  const { resolved, reads } = await recognizeFrameInOrder(ocr, frame, checklist, false);
  const found = resolved.map((m) => m.entry!.code);
  return { found, reads, dbg: `${boxes.length}box ${dbg}` };
}

// ---------- Augmentations (canvas transforms that keep the code readable) ----------
type Canvas = HTMLCanvasElement;
const clamp = (v: number) => (v < 0 ? 0 : v > 255 ? 255 : v);
function blank(w: number, h: number): Canvas {
  const c = document.createElement('canvas');
  c.width = Math.max(1, w);
  c.height = Math.max(1, h);
  return c;
}
function rotate(src: Canvas, deg: number): Canvas {
  const rad = (deg * Math.PI) / 180;
  const cos = Math.abs(Math.cos(rad));
  const sin = Math.abs(Math.sin(rad));
  const nw = Math.round(src.width * cos + src.height * sin);
  const nh = Math.round(src.width * sin + src.height * cos);
  const c = blank(nw, nh);
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#7a7a7a'; // neutral fill for the corners, not black (avoids fake dark blobs)
  ctx.fillRect(0, 0, nw, nh);
  ctx.translate(nw / 2, nh / 2);
  ctx.rotate(rad);
  ctx.drawImage(src, -src.width / 2, -src.height / 2);
  return c;
}
function filtered(src: Canvas, filter: string): Canvas {
  const c = blank(src.width, src.height);
  const ctx = c.getContext('2d')!;
  ctx.filter = filter;
  ctx.drawImage(src, 0, 0);
  return c;
}
// Seeded PRNG so the noise augmentation is DETERMINISTIC — the benchmark must give
// the same score every run, or "100%" is just luck and an agent can't measure progress.
let _seed = 0;
function rng(): number {
  _seed = (_seed + 0x6d2b79f5) | 0;
  let t = Math.imul(_seed ^ (_seed >>> 15), 1 | _seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
function noise(src: Canvas, sigma: number): Canvas {
  _seed = 0x5715c0de; // reset → identical noise pattern every run
  const c = blank(src.width, src.height);
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(src, 0, 0);
  const img = ctx.getImageData(0, 0, c.width, c.height);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (rng() + rng() + rng() - 1.5) * sigma; // ~gaussian
    d[i] = clamp(d[i] + n);
    d[i + 1] = clamp(d[i + 1] + n);
    d[i + 2] = clamp(d[i + 2] + n);
  }
  ctx.putImageData(img, 0, 0);
  return c;
}
function rescale(src: Canvas, factor: number): Canvas {
  const small = blank(src.width * factor, src.height * factor);
  small.getContext('2d')!.drawImage(src, 0, 0, small.width, small.height);
  const c = blank(src.width, src.height);
  c.getContext('2d')!.drawImage(small, 0, 0, c.width, c.height);
  return c;
}
async function jpeg(src: Canvas, q: number): Promise<Canvas> {
  const img = new Image();
  img.src = src.toDataURL('image/jpeg', q);
  await img.decode();
  const c = blank(src.width, src.height);
  c.getContext('2d')!.drawImage(img, 0, 0);
  return c;
}
// A mild horizontal-shear perspective/skew: the top edge slides sideways relative to
// the bottom, as if the sticker is tilted slightly away from the camera. Kept gentle
// (the code stays plainly readable) and the canvas is grown so nothing is clipped.
function skew(src: Canvas, kx: number): Canvas {
  const extra = Math.ceil(Math.abs(kx) * src.height);
  const c = blank(src.width + extra, src.height);
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#7a7a7a';
  ctx.fillRect(0, 0, c.width, c.height);
  // translate so the sheared content stays inside the widened canvas
  ctx.setTransform(1, 0, kx, 1, kx < 0 ? extra : 0, 0);
  ctx.drawImage(src, 0, 0);
  return c;
}
// Compose two augmentations left-to-right (e.g. blur then rotate). Async-aware so a
// JPEG step can participate.
function compose(
  ...steps: Array<(c: Canvas) => Canvas | Promise<Canvas>>
): (c: Canvas) => Promise<Canvas> {
  return async (c: Canvas) => {
    let cur = c;
    for (const step of steps) cur = await step(cur);
    return cur;
  };
}

const AUGS: Array<{ name: string; run: (c: Canvas) => Canvas | Promise<Canvas> }> = [
  { name: 'orig', run: (c) => c },
  // Right-angle turns and the previously-tested small leans.
  { name: 'rot90', run: (c) => rotate(c, 90) },
  { name: 'rot180', run: (c) => rotate(c, 180) },
  { name: 'rot270', run: (c) => rotate(c, 270) },
  { name: 'rot+12', run: (c) => rotate(c, 12) },
  { name: 'rot-12', run: (c) => rotate(c, -12) },
  // Full rotation sweep: every code must read upright at ANY in-plane angle. These
  // fall in the ~15-75° gap the de-rotator used to miss; the code stays plainly
  // human-readable at each (a sticker held at 45° is still trivially legible).
  { name: 'rot+15', run: (c) => rotate(c, 15) },
  { name: 'rot-15', run: (c) => rotate(c, -15) },
  { name: 'rot+30', run: (c) => rotate(c, 30) },
  { name: 'rot-30', run: (c) => rotate(c, -30) },
  { name: 'rot+45', run: (c) => rotate(c, 45) },
  { name: 'rot-45', run: (c) => rotate(c, -45) },
  { name: 'rot+60', run: (c) => rotate(c, 60) },
  { name: 'rot-60', run: (c) => rotate(c, -60) },
  { name: 'rot+75', run: (c) => rotate(c, 75) },
  { name: 'rot-75', run: (c) => rotate(c, -75) },
  // Degradations.
  { name: 'blur', run: (c) => filtered(c, 'blur(1.4px)') },
  { name: 'noise', run: (c) => noise(c, 16) },
  { name: 'scale0.5', run: (c) => rescale(c, 0.5) },
  { name: 'dark', run: (c) => filtered(c, 'brightness(0.6)') },
  { name: 'jpeg40', run: (c) => jpeg(c, 0.4) },
  // Mild perspective/skew (sticker tilted slightly away from the camera). A ~9° shear —
  // plainly readable, the level a handheld photo realistically introduces.
  { name: 'skew+', run: (c) => skew(c, 0.16) },
  { name: 'skew-', run: (c) => skew(c, -0.16) },
  // Combined transforms: real captures stack degradations. Each pair is still well
  // within human readability.
  { name: 'blur+rot+25', run: compose((c) => filtered(c, 'blur(1.1px)'), (c) => rotate(c, 25)) },
  { name: 'noise+dark', run: compose((c) => noise(c, 12), (c) => filtered(c, 'brightness(0.65)')) },
];

const set = (xs: string[]) => new Set(xs);
const inter = (a: Set<string>, b: Set<string>) => [...a].filter((x) => b.has(x));
const minus = (a: Set<string>, b: Set<string>) => [...a].filter((x) => !b.has(x));

(async () => {
  status.textContent = 'init OCR…';
  const ocr = createOcrEngine();
  await ocr.init();

  const list = (await (await fetch('/dataset/list')).json()) as {
    images: string[];
    videos: string[];
    frames: string[];
  };

  // ---- Latency mode (?latency / ?latencysharp): how FAST is one pipeline pass? ----
  if (LATENCY || LATENCY_SHARP) {
    const det: number[] = [];
    const ocrT: number[] = [];
    const total: number[] = [];
    const cropsN: number[] = [];
    const withCode: number[] = []; // total ms only for frames that actually resolved a code
    // Sharp mode: loop the SHARP, SINGLE-sticker close-ups (the real use-case: one sticker
    // shown close) several times for a stable timing sample. Multi-code images (an underscore
    // in the name, e.g. RSA17_EGY5_..._.jpg) are a 6-up stress test, NOT the use-case, so they
    // are excluded — their tiny merged pills fall to the tesseract phase and would mask the
    // single-sticker latency. Non-sharp mode uses the real blurry video frames.
    const SHARP_REPEATS = 40;
    const singleCode = list.images.filter((n) => !n.replace(/\.[a-z]+$/i, '').includes('_'));
    const latFrames: string[] = LATENCY_SHARP
      ? Array.from({ length: SHARP_REPEATS }, () => singleCode.map((n) => `/dataset/${n}`)).flat()
      : list.frames.map((n) => `/dataset/frames/${n}`);
    for (let i = 0; i < latFrames.length; i++) {
      status.textContent = `latency ${i + 1}/${latFrames.length}…`;
      const frame = await loadImage(latFrames[i]);
      // Measure the EXACT production strategy: detection, then OCR crops in score order
      // one at a time, stopping at the first crop that resolves a real checklist code
      // (stopOnFirstCode=true — the prominent pill is box[0], so a clean frame is one OCR).
      // onDetected splits detection time from OCR time without forking the measured path.
      const t0 = performance.now();
      let t1 = t0;
      const { resolved, crops } = await recognizeFrameInOrder(ocr, frame, checklist, true, () => {
        t1 = performance.now();
      });
      const t2 = performance.now();
      const got = resolved.length > 0;
      if (i >= 3) {
        // drop first 3 as warm-up (JIT / first OCR dispatch)
        det.push(t1 - t0);
        ocrT.push(t2 - t1);
        total.push(t2 - t0);
        cropsN.push(crops);
        if (got) withCode.push(t2 - t0);
      }
    }
    const row = (label: string, s: ReturnType<typeof stats>) =>
      `| ${label} | ${s.avg} | ${s.median} | ${s.p90} | ${s.max} |`;
    const avgCrops = cropsN.length ? (cropsN.reduce((a, b) => a + b, 0) / cropsN.length).toFixed(1) : '0';
    const srcLabel = LATENCY_SHARP
      ? `**${total.length}** passes over the SHARP static close-ups (the real use-case: one sticker shown close, steady, focus-locked)`
      : `**${total.length}** real front-camera video frames (blurry — a worst-case lower bound)`;
    const md = [
      `# Sticker detection LATENCY benchmark${LATENCY_SHARP ? ' — SHARP / use-case' : ''}`,
      '',
      `One pipeline pass mirroring the LIVE burst (findCodeBoxes → recognizeFrameInOrder:`,
      `top-N boxes best-first, ink-bearing upright crops OCR'd in parallel, flip round only`,
      `for boxes that didn't resolve, STOP the frame at the first checklist match) over`,
      `${srcLabel}; first 3 dropped as warm-up. All times in **ms**.`,
      '',
      '| stage (ms) | avg | median | p90 | max |',
      '|---|---|---|---|---|',
      row('detection', stats(det)),
      row('OCR', stats(ocrT)),
      row('**total / frame**', stats(total)),
      row(`total — frames with a code (${withCode.length})`, stats(withCode)),
      '',
      `- avg crops OCR'd per frame: **${avgCrops}** (this is what dominates the OCR time).`,
      `- the live app may run several passes before a code commits, so user-felt latency ≈ this × a few.`,
      '',
      '_done_',
    ].join('\n');
    await fetch('/bench-log', { method: 'POST', body: md }).catch(() => {});
    await ocr.terminate();
    status.textContent = 'latency done';
    document.title = 'bench done';
    return;
  }

  // ---- 1. Static images: single-frame recall ----
  const staticMd = ['## Static images (single-frame recall)', ''];
  staticMd.push('| image | expected | found | missed | false+ |', '|---|---|---|---|---|');
  let staticHit = 0;
  let staticTotal = 0;
  let staticFalse = 0;
  const bases: Array<{ code: string; canvas: HTMLCanvasElement }> = [];
  for (const name of list.images.sort()) {
    status.textContent = `static ${name}…`;
    const expected = set(labelsOf(name));
    if (expected.size === 0) continue;
    const frame = await loadImage(`/dataset/${name}`);
    // Single-code sharp photos are the bases for the robustness section.
    if (expected.size === 1) bases.push({ code: [...expected][0], canvas: frame });
    const { found, reads } = await recognizeFrame(ocr, frame);
    const f = set(found);
    const missed = minus(expected, f);
    const falsePos = minus(f, expected);
    staticHit += inter(expected, f).length;
    staticTotal += expected.size;
    staticFalse += falsePos.length;
    staticMd.push(
      `| ${name} | ${[...expected].sort().join(' ')} | ${inter(expected, f).sort().join(' ') || '—'} | ` +
        `**${missed.sort().join(' ') || '—'}** | ${falsePos.sort().join(' ') || '—'} |`,
    );
    staticMd.push('', `  reads: \`${reads.join(' | ').slice(0, 200)}\``, '');
  }

  // ---- 2. Robustness: each single-code close-up under readable transforms ----
  status.textContent = 'robustness…';
  const robMd = [
    '## Robustness (augmented readable variants)',
    '',
    'Each single-code close-up under transforms that keep it readable. Target: every cell ✓.',
    '',
    `| augmentation | ${bases.map((b) => b.code).join(' | ')} | recall |`,
    `|---|${bases.map(() => '---|').join('')}`,
  ];
  let robHit = 0;
  let robTotal = 0;
  let robFalse = 0;
  const robMissByAug = new Map<string, string[]>();
  for (const aug of AUGS) {
    status.textContent = `robustness ${aug.name}…`;
    const cells: string[] = [];
    let hits = 0;
    for (const base of bases) {
      const variant = await aug.run(base.canvas);
      const { found, dbg, reads } = await recognizeFrame(ocr, variant);
      void reads;
      const ok = found.includes(base.code);
      const falsePos = found.filter((c) => c !== base.code);
      robTotal++;
      robFalse += falsePos.length;
      if (ok) {
        hits++;
        robHit++;
        cells.push(falsePos.length ? `✓+FP\`${falsePos.join(',')}\` READS:${reads.join(' / ')}` : '✓');
      } else {
        cells.push(`✗ \`${found.join(',') || '—'}\` ${dbg ?? ''} READS:${reads.join(' / ')}`);
        robMissByAug.set(aug.name, [...(robMissByAug.get(aug.name) ?? []), base.code]);
      }
    }
    robMd.push(`| ${aug.name} | ${cells.join(' | ')} | ${hits}/${bases.length} |`);
  }

  // ---- 3. Video: temporal session recall (real front-camera flow) ----
  let videoMd: string[] = [];
  let videoLine = '- Video: skipped (?quick)';
  if (!QUICK && list.frames.length && list.videos.length) {
    const expected = set(labelsOf(list.videos[0]));
    const confirmer = createConfirmer(CONFIG.match.confirmations);
    const everSeen = new Set<string>();
    const confirmed = new Set<string>();
    const perFrame: string[] = ['', '<details><summary>per-frame</summary>', ''];
    let dims = '';
    for (const fname of list.frames) {
      status.textContent = `video ${fname}…`;
      const frame = await loadImage(`/dataset/frames/${fname}`);
      if (!dims) dims = `${frame.width}x${frame.height}`;
      const { found, reads } = await recognizeFrame(ocr, frame);
      found.forEach((c) => everSeen.add(c));
      confirmer.add(found).forEach((c) => confirmed.add(c));
      perFrame.push(`- ${fname}: [${found.sort().join(' ') || '—'}]  \`${reads.join(' | ').slice(0, 80) || '—'}\``);
    }
    perFrame.push('', '</details>', '');
    const hit = inter(expected, confirmed);
    videoLine = `- **Video session recall: ${hit.length}/${expected.size}** (confirmed: ${hit.sort().join(' ') || '—'})`;
    videoMd = [
      `## Video (${list.videos[0]}, ${list.frames.length} frames, ${dims})`,
      '',
      `- **Session recall (confirmed): ${hit.length}/${expected.size}** — ${hit.sort().join(' ') || '—'}`,
      `- Missed: **${minus(expected, confirmed).sort().join(' ') || '—'}**`,
      `- False confirmations: ${minus(confirmed, expected).sort().join(' ') || '—'}`,
      `- Read at least once (confirmation ceiling): ${[...everSeen].sort().join(' ') || '—'}`,
      ...perFrame,
    ];
  }

  // ---- Headline ----
  const robPct = robTotal ? Math.round((robHit / robTotal) * 100) : 0;
  const staticPct = staticTotal ? Math.round((staticHit / staticTotal) * 100) : 0;
  const hardAugs = [...robMissByAug.entries()].map(([a, cs]) => `${a}(${cs.join(',')})`);
  const headline = [
    '# Sticker detection accuracy benchmark',
    '',
    '## Headline',
    '',
    `- **Robustness recall: ${robHit}/${robTotal} (${robPct}%)** ← target 100% (readable variants)`,
    `- Static recall: ${staticHit}/${staticTotal} (${staticPct}%)`,
    videoLine,
    `- **False positives (wrong codes) — robustness: ${robFalse}, static: ${staticFalse}** _(must be 0)_`,
    hardAugs.length ? `- Robustness failures: ${hardAugs.join(', ')}` : '- Robustness: all variants pass 🎉',
    '',
  ];

  const report = [...headline, ...robMd, '', ...videoMd, '', ...staticMd, '', '_done_'].join('\n');
  await fetch('/bench-log', { method: 'POST', body: report }).catch(() => {});
  await ocr.terminate();
  status.textContent = 'done — see captures/bench-results.md';
  document.title = 'bench done';
})();
