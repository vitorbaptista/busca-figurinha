// Locate the printed code box on a Panini sticker back so OCR runs on a tiny crop
// instead of the whole frame (≈10–40× faster and far more accurate). The box is a
// dark rounded pill with light knockout text. We find it by SHAPE — a solid-ish,
// elongated blob with text holes — using a LOCAL adaptive threshold, because the
// box and the card have nearly equal brightness (a global threshold can't separate
// them, but "darker than the local neighbourhood" can). Handles several backs in
// one frame (each box is found independently) and right-angle rotations.
//
// Pure typed-array canvas work — no OpenCV. Detection runs on a downscaled copy.

import { rotateCanvas } from './rotate';

export interface CodeBox {
  /** Bounding box in full-frame pixels. */
  x: number;
  y: number;
  w: number;
  h: number;
  /** 'h' = text runs horizontally (upright or 180°), 'v' = rotated 90°/270°. */
  orient: 'h' | 'v';
  score: number;
}

/** Long side (px) of the downscaled image used for detection. */
const DET_LONG = 720;

export function findCodeBoxes(frame: HTMLCanvasElement): CodeBox[] {
  const fw = frame.width;
  const fh = frame.height;
  if (!fw || !fh) return [];

  const scale = DET_LONG / Math.max(fw, fh);
  const dw = Math.max(1, Math.round(fw * scale));
  const dh = Math.max(1, Math.round(fh * scale));

  const det = document.createElement('canvas');
  det.width = dw;
  det.height = dh;
  const ctx = det.getContext('2d', { willReadFrequently: true });
  if (!ctx) return [];
  ctx.drawImage(frame, 0, 0, dw, dh);
  const data = ctx.getImageData(0, 0, dw, dh).data;

  const n = dw * dh;
  const gray = new Uint8Array(n);
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    gray[p] = (data[i] * 77 + data[i + 1] * 150 + data[i + 2] * 29) >> 8;
  }

  // Foreground = pixels darker than their local background (the dark pill stands
  // out from the card; the light text inside does not).
  const radius = Math.max(6, Math.round(DET_LONG * 0.045));
  const bg = boxBlur(gray, dw, dh, radius);
  const fg = new Uint8Array(n);
  for (let i = 0; i < n; i++) fg[i] = gray[i] < bg[i] - 12 ? 1 : 0;

  // Connected components (4-connectivity, iterative flood fill).
  const labels = new Int32Array(n).fill(-1);
  const stack = new Int32Array(n);
  const boxes: CodeBox[] = [];

  for (let start = 0; start < n; start++) {
    if (fg[start] === 0 || labels[start] !== -1) continue;
    let sp = 0;
    stack[sp++] = start;
    labels[start] = start;
    let minX = dw;
    let minY = dh;
    let maxX = 0;
    let maxY = 0;
    let area = 0;
    while (sp > 0) {
      const idx = stack[--sp];
      const x = idx % dw;
      const y = (idx / dw) | 0;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
      area++;
      if (x > 0 && fg[idx - 1] && labels[idx - 1] === -1) ((labels[idx - 1] = start), (stack[sp++] = idx - 1));
      if (x < dw - 1 && fg[idx + 1] && labels[idx + 1] === -1) ((labels[idx + 1] = start), (stack[sp++] = idx + 1));
      if (y > 0 && fg[idx - dw] && labels[idx - dw] === -1) ((labels[idx - dw] = start), (stack[sp++] = idx - dw));
      if (y < dh - 1 && fg[idx + dw] && labels[idx + dw] === -1) ((labels[idx + dw] = start), (stack[sp++] = idx + dw));
    }

    const w = maxX - minX + 1;
    const h = maxY - minY + 1;
    const scored = scoreBox(w, h, area);
    if (scored) {
      boxes.push({
        x: minX / scale,
        y: minY / scale,
        w: w / scale,
        h: h / scale,
        orient: scored.orient,
        score: scored.score,
      });
    }
  }

  boxes.sort((a, b) => b.score - a.score);
  return nonMaxSuppress(boxes, 0.3).slice(0, 10);
}

/** Geometry gate + score for "is this the code pill?". Returns null if not. */
function scoreBox(w: number, h: number, area: number): { orient: 'h' | 'v'; score: number } | null {
  const fill = area / (w * h);
  const long = Math.max(w, h);
  const short = Math.min(w, h);
  const ar = long / short;

  // The pill is a short, solid, elongated blob. Tight gates reject text fragments
  // (low fill), wide footer/legal bands (high AR), and big regions.
  if (ar < 2.4 || ar > 5.2) return null; // "CIV 12" pill is ~3-4:1 (samples ~3.1)
  if (fill < 0.55 || fill > 0.95) return null; // solid with text holes (~0.72)
  if (long < DET_LONG * 0.03 || long > DET_LONG * 0.45) return null; // size sanity
  if (short < 4) return null;

  const arScore = 1 - Math.min(1, Math.abs(ar - 3.2) / 3);
  const fillScore = 1 - Math.min(1, Math.abs(fill - 0.72) / 0.4);
  return { orient: w >= h ? 'h' : 'v', score: arScore * 0.6 + fillScore * 0.4 };
}

/** Build the upright + 180°-flipped OCR crops for a detected box, each prepared
 *  (rotated upright, upscaled, binarized to dark-text-on-white, padded). The two
 *  candidates resolve the 0°/180° (or 90°/270°) ambiguity at OCR time. */
export function codeCropCandidates(frame: HTMLCanvasElement, box: CodeBox): HTMLCanvasElement[] {
  // A little padding so the pill has a margin of card around it — the prep step
  // flood-clears that margin, which cleanly isolates the text.
  const region = cropRegion(frame, box, 0.18);
  const base = box.orient === 'h' ? rotateCanvas(region, 0) : rotateCanvas(region, 90);
  const flip = box.orient === 'h' ? rotateCanvas(region, 180) : rotateCanvas(region, 270);
  return [prepForOcr(base), prepForOcr(flip)];
}

/** Crop a padded region (in full-frame pixels) into its own canvas. */
function cropRegion(frame: HTMLCanvasElement, box: CodeBox, padFrac: number): HTMLCanvasElement {
  const padX = box.w * padFrac;
  const padY = box.h * padFrac;
  const x = Math.min(frame.width - 1, Math.max(0, Math.floor(box.x - padX)));
  const y = Math.min(frame.height - 1, Math.max(0, Math.floor(box.y - padY)));
  const w = Math.min(frame.width - x, Math.ceil(box.w + padX * 2));
  const h = Math.min(frame.height - y, Math.ceil(box.h + padY * 2));

  const out = document.createElement('canvas');
  out.width = Math.max(1, w);
  out.height = Math.max(1, h);
  const ctx = out.getContext('2d', { willReadFrequently: true });
  // Guard against a non-positive source rect (edge box) — drawImage throws on it.
  if (ctx && w > 0 && h > 0) ctx.drawImage(frame, x, y, w, h, 0, 0, w, h);
  return out;
}

/** Stack prepared crops into ONE image (one code per row) so OCR runs a single
 *  pass instead of N calls — the dominant speed win. Each row is left-aligned on a
 *  white field with a gap so Tesseract segments them as separate lines. */
export function stackCrops(crops: HTMLCanvasElement[], gap = 18): HTMLCanvasElement {
  const out = document.createElement('canvas');
  if (crops.length === 0) {
    out.width = 1;
    out.height = 1;
    return out;
  }
  const width = Math.max(...crops.map((c) => c.width));
  const height = crops.reduce((s, c) => s + c.height + gap, gap);
  out.width = width;
  out.height = height;
  const ctx = out.getContext('2d', { willReadFrequently: true });
  if (!ctx) return out;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, width, height);
  let y = gap;
  for (const c of crops) {
    ctx.drawImage(c, 0, y);
    y += c.height + gap;
  }
  return out;
}

/** Target text-band height (px) Tesseract reads best; we upscale the crop to it.
 *  Generous so thin strokes (the "I" in CIV) survive binarization. */
const TARGET_H = 96;
const BORDER = 16;

/** Upscale to a good OCR size and binarize to dark-text-on-white with a quiet
 *  border. The code is LIGHT text on a DARK pill, so ink (black) = the light pixels
 *  and the dark pill becomes white. Everything connected to the border (the card
 *  margin around the pill, and any inverted dark-on-light region) is then cleared,
 *  which both isolates the text and turns false-positive boxes (legal text, logos)
 *  into blanks that match nothing. */
function prepForOcr(src: HTMLCanvasElement): HTMLCanvasElement {
  const sh = src.height || 1;
  const factor = Math.max(1, TARGET_H / sh);
  const cw = Math.max(1, Math.round(src.width * factor));
  const ch = Math.max(1, Math.round(src.height * factor));

  const out = document.createElement('canvas');
  out.width = cw + BORDER * 2;
  out.height = ch + BORDER * 2;
  const ctx = out.getContext('2d', { willReadFrequently: true });
  if (!ctx) return out;

  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, out.width, out.height);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(src, BORDER, BORDER, cw, ch);

  const img = ctx.getImageData(BORDER, BORDER, cw, ch);
  const px = img.data;
  const count = cw * ch;

  const hist = new Array<number>(256).fill(0);
  const gray = new Uint8Array(count);
  for (let i = 0, p = 0; i < px.length; i += 4, p++) {
    const g = (px[i] * 77 + px[i + 1] * 150 + px[i + 2] * 29) >> 8;
    gray[p] = g;
    hist[g]++;
  }
  const threshold = otsu(hist, count);

  // Ink (0) = light pixels (the knockout text); dark pill → white (255).
  const bin = new Uint8Array(count);
  for (let p = 0; p < count; p++) bin[p] = gray[p] > threshold ? 0 : 255;

  floodClearFromBorder(bin, cw, ch);

  for (let i = 0, p = 0; i < px.length; i += 4, p++) {
    const v = bin[p];
    px[i] = px[i + 1] = px[i + 2] = v;
    px[i + 3] = 255;
  }
  ctx.putImageData(img, BORDER, BORDER);
  return out;
}

/** Flip every ink (0) pixel reachable from the image border to white, removing the
 *  card frame/margin around the pill while leaving the interior text untouched. */
function floodClearFromBorder(bin: Uint8Array, w: number, h: number): void {
  const stack: number[] = [];
  const visit = (i: number) => {
    if (bin[i] === 0) {
      bin[i] = 255;
      stack.push(i);
    }
  };
  for (let x = 0; x < w; x++) {
    visit(x);
    visit((h - 1) * w + x);
  }
  for (let y = 0; y < h; y++) {
    visit(y * w);
    visit(y * w + (w - 1));
  }
  while (stack.length) {
    const i = stack.pop()!;
    const x = i % w;
    const y = (i / w) | 0;
    if (x > 0) visit(i - 1);
    if (x < w - 1) visit(i + 1);
    if (y > 0) visit(i - w);
    if (y < h - 1) visit(i + w);
  }
}

function otsu(hist: number[], total: number): number {
  let sum = 0;
  for (let t = 0; t < 256; t++) sum += t * hist[t];
  let sumB = 0;
  let wB = 0;
  let maxVar = 0;
  let threshold = 127;
  for (let t = 0; t < 256; t++) {
    wB += hist[t];
    if (wB === 0) continue;
    const wF = total - wB;
    if (wF === 0) break;
    sumB += t * hist[t];
    const mB = sumB / wB;
    const mF = (sum - sumB) / wF;
    const between = wB * wF * (mB - mF) * (mB - mF);
    if (between > maxVar) {
      maxVar = between;
      threshold = t;
    }
  }
  return threshold;
}

/** Integral-image box blur → local mean. */
function boxBlur(gray: Uint8Array, w: number, h: number, r: number): Uint8Array {
  const iw = w + 1;
  const integral = new Float64Array(iw * (h + 1));
  for (let y = 1; y <= h; y++) {
    for (let x = 1; x <= w; x++) {
      integral[y * iw + x] =
        gray[(y - 1) * w + (x - 1)] +
        integral[(y - 1) * iw + x] +
        integral[y * iw + (x - 1)] -
        integral[(y - 1) * iw + (x - 1)];
    }
  }
  const out = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    const y0 = Math.max(0, y - r);
    const y1 = Math.min(h - 1, y + r);
    for (let x = 0; x < w; x++) {
      const x0 = Math.max(0, x - r);
      const x1 = Math.min(w - 1, x + r);
      const area = (x1 - x0 + 1) * (y1 - y0 + 1);
      const sum =
        integral[(y1 + 1) * iw + (x1 + 1)] -
        integral[y0 * iw + (x1 + 1)] -
        integral[(y1 + 1) * iw + x0] +
        integral[y0 * iw + x0];
      out[y * w + x] = (sum / area) | 0;
    }
  }
  return out;
}

/** Greedy non-maximum suppression by intersection-over-union. */
function nonMaxSuppress(boxes: CodeBox[], iouThresh: number): CodeBox[] {
  const kept: CodeBox[] = [];
  for (const b of boxes) {
    let overlaps = false;
    for (const k of kept) {
      if (iou(b, k) > iouThresh) {
        overlaps = true;
        break;
      }
    }
    if (!overlaps) kept.push(b);
  }
  return kept;
}

function iou(a: CodeBox, b: CodeBox): number {
  const x1 = Math.max(a.x, b.x);
  const y1 = Math.max(a.y, b.y);
  const x2 = Math.min(a.x + a.w, b.x + b.w);
  const y2 = Math.min(a.y + a.h, b.y + b.h);
  const inter = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
  const union = a.w * a.h + b.w * b.h - inter;
  return union > 0 ? inter / union : 0;
}
