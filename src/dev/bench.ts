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
import { findCodeBoxes, codeCropCandidates } from '../ocr/locate';
import { createOcrEngine } from '../ocr/engine';
import { bestMatchFromText } from '../domain/matching';
import { createConfirmer } from '../domain/confirm';
import { checklist } from '../data/checklist';
import { CONFIG } from '../config';

const QUICK = new URLSearchParams(location.search).has('quick');

const root = document.getElementById('out')!;
const status = document.createElement('div');
root.replaceChildren(status);

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
}

async function recognizeFrame(
  ocr: ReturnType<typeof createOcrEngine>,
  frame: HTMLCanvasElement,
): Promise<FrameRead> {
  const boxes = findCodeBoxes(frame);
  const crops = boxes.flatMap((b) => codeCropCandidates(frame, b));
  const results = crops.length ? await ocr.recognizeMany(crops) : [];
  const found = new Set<string>();
  const reads: string[] = [];
  for (const r of results) {
    const clean = r.text.replace(/\s+/g, ' ').trim();
    if (clean) reads.push(clean);
    const m = bestMatchFromText(r.text, checklist);
    if (m?.entry) found.add(m.entry.code);
  }
  return { found: [...found], reads };
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
function noise(src: Canvas, sigma: number): Canvas {
  const c = blank(src.width, src.height);
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(src, 0, 0);
  const img = ctx.getImageData(0, 0, c.width, c.height);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (Math.random() + Math.random() + Math.random() - 1.5) * sigma; // ~gaussian
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

const AUGS: Array<{ name: string; run: (c: Canvas) => Canvas | Promise<Canvas> }> = [
  { name: 'orig', run: (c) => c },
  { name: 'rot90', run: (c) => rotate(c, 90) },
  { name: 'rot180', run: (c) => rotate(c, 180) },
  { name: 'rot270', run: (c) => rotate(c, 270) },
  { name: 'rot+12', run: (c) => rotate(c, 12) },
  { name: 'rot-12', run: (c) => rotate(c, -12) },
  { name: 'blur', run: (c) => filtered(c, 'blur(1.4px)') },
  { name: 'noise', run: (c) => noise(c, 16) },
  { name: 'scale0.5', run: (c) => rescale(c, 0.5) },
  { name: 'dark', run: (c) => filtered(c, 'brightness(0.6)') },
  { name: 'jpeg40', run: (c) => jpeg(c, 0.4) },
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
      const { found } = await recognizeFrame(ocr, variant);
      const ok = found.includes(base.code);
      const falsePos = found.filter((c) => c !== base.code);
      robTotal++;
      robFalse += falsePos.length;
      if (ok) {
        hits++;
        robHit++;
        cells.push('✓');
      } else {
        cells.push(`✗ \`${found.join(',') || '—'}\``);
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
