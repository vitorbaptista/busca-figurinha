// DEV-ONLY accuracy benchmark (served at /bench.html). Measures how well the REAL
// production pipeline (findCodeBoxes → codeCropCandidates → recognizeMany →
// bestMatchFromText, plus the multi-frame confirmer for the video) recovers the
// sticker codes from the labeled dataset in data/raw/stickers/.
//
// Ground truth is the FILENAME: "RSA17_EGY5_CIV12_RSA19_EGY4_AUT4.jpg" expects those
// six codes; the video frames inherit the labels of the .mp4 they were extracted
// from. Add a labeled image to data/raw/stickers/ (or re-extract frames) and the
// benchmark picks it up automatically — no code change needed.
//
// Output: a Markdown report written to captures/bench-results.md via /bench-log, so
// the headline accuracy can be tracked across attempts without scraping the DOM.
import { findCodeBoxes, codeCropCandidates } from '../ocr/locate';
import { createOcrEngine } from '../ocr/engine';
import { bestMatchFromText } from '../domain/matching';
import { createConfirmer } from '../domain/confirm';
import { checklist } from '../data/checklist';
import { CONFIG } from '../config';

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

/** Run the exact production recognize path on one frame; return resolved codes. */
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

const set = (xs: string[]) => new Set(xs);
const inter = (a: Set<string>, b: Set<string>) => [...a].filter((x) => b.has(x));
const minus = (a: Set<string>, b: Set<string>) => [...a].filter((x) => !b.has(x));

(async () => {
  status.textContent = 'init OCR…';
  const ocr = createOcrEngine();
  await ocr.init();

  const md: string[] = ['# Sticker detection accuracy benchmark', ''];
  let staticHit = 0;
  let staticTotal = 0;
  let staticFalse = 0;
  const missByCode = new Map<string, number>(); // expected code -> times missed (static)

  const list = (await (await fetch('/dataset/list')).json()) as {
    images: string[];
    videos: string[];
    frames: string[];
  };

  // ---- Static images: single-frame recall (the deterministic headline) ----
  md.push('## Static images (single-frame recall)', '');
  md.push('| image | expected | found | missed | false+ |', '|---|---|---|---|---|');
  for (const name of list.images.sort()) {
    status.textContent = `image ${name}…`;
    const expected = set(labelsOf(name));
    if (expected.size === 0) continue;
    const frame = await loadImage(`/dataset/${name}`);
    const { found, reads } = await recognizeFrame(ocr, frame);
    const f = set(found);
    const hit = inter(expected, f);
    const missed = minus(expected, f);
    const falsePos = minus(f, expected);
    staticHit += hit.length;
    staticTotal += expected.size;
    staticFalse += falsePos.length;
    for (const c of missed) missByCode.set(c, (missByCode.get(c) ?? 0) + 1);
    md.push(
      `| ${name} | ${[...expected].sort().join(' ')} | ${hit.sort().join(' ') || '—'} | ` +
        `**${missed.sort().join(' ') || '—'}** | ${falsePos.sort().join(' ') || '—'} |`,
    );
    md.push('', `  reads: \`${reads.join(' | ').slice(0, 240)}\``, '');
  }

  // ---- Video: temporal session recall (real front-camera flow) ----
  let videoLines: string[] = [];
  if (list.frames.length && list.videos.length) {
    status.textContent = 'video frames…';
    const expected = set(labelsOf(list.videos[0]));
    const confirmer = createConfirmer(CONFIG.match.confirmations);
    const everSeen = new Set<string>();
    const confirmed = new Set<string>();
    const perFrame: string[] = ['', '<details><summary>per-frame</summary>', ''];
    let firstFrameDims = '';
    for (const fname of list.frames) {
      const frame = await loadImage(`/dataset/frames/${fname}`);
      if (!firstFrameDims) firstFrameDims = `${frame.width}x${frame.height}`;
      const { found, reads } = await recognizeFrame(ocr, frame);
      found.forEach((c) => everSeen.add(c));
      confirmer.add(found).forEach((c) => confirmed.add(c));
      perFrame.push(
        `- ${fname}: found [${found.sort().join(' ') || '—'}]  reads \`${reads.join(' | ').slice(0, 90) || '—'}\``,
      );
    }
    perFrame.push('', '</details>', '');
    const sessionHit = inter(expected, confirmed);
    const sessionMiss = minus(expected, confirmed);
    const falseConf = minus(confirmed, expected);
    // "ceiling" = best possible if confirmation were perfect (any frame read it once).
    const ceilingMiss = minus(expected, everSeen);
    videoLines = [
      `## Video (${list.videos[0]}, ${list.frames.length} frames @ ~1fps, ${firstFrameDims})`,
      '',
      `Simulates the live front-camera flow with the ${CONFIG.match.confirmations}-frame confirmer.`,
      '',
      `- **Session recall (confirmed): ${sessionHit.length}/${expected.size}** — ${sessionHit.sort().join(' ') || '—'}`,
      `- Missed (never confirmed): **${sessionMiss.sort().join(' ') || '—'}**`,
      `- False confirmations: ${falseConf.sort().join(' ') || '—'}`,
      `- Read at least once on some frame (confirmation ceiling): ${[...everSeen].sort().join(' ') || '—'}`,
      `- Never read on any frame: ${ceilingMiss.sort().join(' ') || '—'}`,
      ...perFrame,
    ];
  } else {
    videoLines = [
      '## Video',
      '',
      '_No frames found. Extract them once:_',
      '```',
      'ffmpeg -y -i data/raw/stickers/<video>.mp4 -vf fps=1 -q:v 3 data/raw/stickers/frames/f%03d.jpg',
      '```',
      '',
    ];
  }

  // ---- Headline + hardest stickers ----
  const recallPct = staticTotal ? Math.round((staticHit / staticTotal) * 100) : 0;
  const hardest = [...missByCode.entries()].sort((a, b) => b[1] - a[1]);
  const headline = [
    '## Headline',
    '',
    `- **Static recall: ${staticHit}/${staticTotal} (${recallPct}%)**`,
    `- Static false positives (wrong codes reported): **${staticFalse}** _(must stay 0 — a wrong code is a bad trade)_`,
    hardest.length
      ? `- Hardest codes (missed most): ${hardest.map(([c, n]) => `${c}×${n}`).join(', ')}`
      : '- No static misses 🎉',
    '',
  ];

  const report = [md[0], md[1], ...headline, ...videoLines, ...md.slice(2), '', '_done_'].join('\n');
  await fetch('/bench-log', { method: 'POST', body: report }).catch(() => {});
  await ocr.terminate();
  status.textContent = 'done — see captures/bench-results.md';
  document.title = 'bench done';
})();
