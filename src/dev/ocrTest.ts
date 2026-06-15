// Dev-only harness (served at /ocr-test.html) to visualise the locate→crop→OCR
// pipeline on real frames, so the detection can be tuned without the phone.
import { findCodeBoxes, codeCropCandidates, stackCrops } from '../ocr/locate';
import { createOcrEngine } from '../ocr/engine';
import { matchLines } from '../domain/matching';
import { checklist } from '../data/checklist';

const IMAGES = [
  '/samples/realframe.jpg',
  '/samples/CIV12.jpg',
  '/samples/EGY4.jpg',
  '/samples/composite2.jpg',
];

const root = document.getElementById('out')!;
root.innerHTML = '';
const status = document.createElement('div');
const out = document.createElement('div');
root.appendChild(status);
root.appendChild(out);

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

const summary: string[] = [];

function postImg(name: string, canvas: HTMLCanvasElement) {
  void fetch('/__capture', {
    method: 'POST',
    body: JSON.stringify({ name, dataUrl: canvas.toDataURL('image/jpeg', 0.9) }),
  }).catch(() => {});
}

(async () => {
  status.textContent = 'initializing OCR…';
  const ocr = createOcrEngine();
  // The engine's logger fires on every recognize, so keep it on its own status line.
  await ocr.init((r) => (status.textContent = 'OCR ' + Math.round(r * 100) + '%'));

  for (const src of IMAGES) {
    const section = document.createElement('div');
    section.className = 'section';
    const title = document.createElement('div');
    title.className = 'title';
    title.textContent = src;
    section.appendChild(title);
    out.appendChild(section);

    let frame: HTMLCanvasElement;
    try {
      frame = await loadImage(src);
    } catch {
      title.textContent = src + ' (missing)';
      continue;
    }

    const t0 = performance.now();
    const boxes = findCodeBoxes(frame);
    const detMs = Math.round(performance.now() - t0);

    // Overlay: downscaled frame with detected boxes drawn.
    const ow = Math.min(420, frame.width);
    const os = ow / frame.width;
    const overlay = document.createElement('canvas');
    overlay.width = ow;
    overlay.height = Math.round(frame.height * os);
    const octx = overlay.getContext('2d')!;
    octx.drawImage(frame, 0, 0, overlay.width, overlay.height);
    octx.strokeStyle = '#16a34a';
    octx.lineWidth = 2;
    octx.font = '12px monospace';
    octx.fillStyle = '#16a34a';
    boxes.forEach((b, i) => {
      octx.strokeRect(b.x * os, b.y * os, b.w * os, b.h * os);
      octx.fillText(String(i), b.x * os, b.y * os - 2);
    });
    section.appendChild(overlay);
    const name = src.split('/').pop()!.replace('.jpg', '');
    postImg('overlay-' + name, overlay);

    const info = document.createElement('div');
    info.textContent = `detect ${detMs}ms · ${boxes.length} candidate boxes`;
    section.appendChild(info);

    // Build all orientation crop candidates for every box, stack into one image,
    // and OCR a single time (the speed win).
    const allCrops = boxes.flatMap((b) => codeCropCandidates(frame, b));
    const stack = stackCrops(allCrops);
    const r0 = performance.now();
    const res = await ocr.recognize(stack);
    const ocrMs = Math.round(performance.now() - r0);
    const matches = matchLines(res.text, checklist);
    const found = matches.map((m) => m.entry!.code);

    const wrap = document.createElement('div');
    wrap.className = 'crop';
    wrap.appendChild(stack);
    section.appendChild(wrap);
    postImg('stack-' + name, stack);

    const result = document.createElement('div');
    result.className = 'found';
    result.textContent = `FOUND: ${found.join(', ') || '(none)'} · ${allCrops.length} crops · ocr ${ocrMs}ms`;
    section.appendChild(result);

    const rawReads = res.text.replace(/\s+/g, ' ').trim();
    summary.push(
      `${src}\n  detect ${detMs}ms, ${boxes.length} boxes, ${allCrops.length} crops, ocr ${ocrMs}ms\n` +
        `  FOUND: ${found.join(', ') || '(none)'}\n  read: "${rawReads}"`,
    );
    // Persist after each image so a later failure can't lose earlier results.
    void fetch('/__log', { method: 'POST', body: summary.join('\n\n') }).catch(() => {});
  }

  void fetch('/__log', { method: 'POST', body: summary.join('\n\n') }).catch(() => {});
  status.textContent = 'done';
  document.title = 'OCR test done';
})();
