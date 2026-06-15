// DEV-ONLY harness (served at /ocr-test.html). Runs the EXACT production recognize
// path (findCodeBoxes → codeCropCandidates → per-crop OCR → bestMatchFromText) on
// saved phone frames, and reports the final resolved checklist codes. This is the
// end-to-end check that the live scan would succeed. Results → captures/ocr-results.txt.
import { findCodeBoxes, codeCropCandidates } from '../ocr/locate';
import { createOcrEngine } from '../ocr/engine';
import { bestMatchFromText } from '../domain/matching';
import { checklist } from '../data/checklist';

// Every saved frame, with the codes a human reads on it (ground truth, '?' = unknown).
const CASES: Array<{ src: string; expect: string[] }> = [
  { src: '/samples/civ.jpg', expect: ['CIV12'] },
  { src: '/samples/CIV12.jpg', expect: ['CIV12'] },
  { src: '/samples/EGY4.jpg', expect: ['EGY4'] },
  { src: '/samples/realframe.jpg', expect: [] }, // 4 backs + 2 face-up
  { src: '/samples/composite2.jpg', expect: [] },
  { src: '/samples/composite4.jpg', expect: [] },
];

const root = document.getElementById('out')!;
root.innerHTML = '';
const status = document.createElement('div');
root.appendChild(status);

async function loadImage(src: string): Promise<HTMLCanvasElement> {
  const img = new Image();
  img.src = src;
  await img.decode();
  const c = document.createElement('canvas');
  c.width = img.naturalWidth;
  c.height = img.naturalHeight;
  c.getContext('2d')!.drawImage(img, 0, 0);
  return c;
}

(async () => {
  status.textContent = 'init OCR…';
  const ocr = createOcrEngine();
  await ocr.init();

  const lines: string[] = [];
  for (const { src, expect } of CASES) {
    let frame: HTMLCanvasElement;
    try {
      frame = await loadImage(src);
    } catch {
      lines.push(`${src}\n  (missing)`);
      continue;
    }
    const t0 = performance.now();
    const boxes = findCodeBoxes(frame);
    const crops = boxes.flatMap((b) => codeCropCandidates(frame, b));
    const results = await ocr.recognizeMany(crops);
    const found = new Set<string>();
    const reads: string[] = [];
    for (const r of results) {
      const clean = r.text.replace(/\s+/g, ' ').trim();
      if (clean) reads.push(clean);
      const m = bestMatchFromText(r.text, checklist);
      if (m?.entry) found.add(m.entry.code);
    }
    const ms = Math.round(performance.now() - t0);
    const got = [...found];
    const ok = expect.length === 0 ? '·' : expect.every((e) => found.has(e)) ? '✓' : '✗';
    lines.push(
      `${src}  ${ms}ms ${boxes.length}box ${crops.length}crop\n  got [${got.join(', ')}] ${ok}\n  reads: ${reads.join(' | ').slice(0, 150)}`,
    );
    void fetch('/__log', { method: 'POST', body: lines.join('\n\n') }).catch(() => {});
  }
  lines.push('\n=== done ===');
  void fetch('/__log', { method: 'POST', body: lines.join('\n\n') }).catch(() => {});
  await ocr.terminate();
  status.textContent = 'done';
  document.title = 'OCR test done';
})();
