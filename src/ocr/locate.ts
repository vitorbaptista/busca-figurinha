// Locate the printed code box on a Panini sticker back so OCR runs on a tiny crop
// instead of the whole frame (≈10–40× faster and far more accurate). The box is a
// dark rounded pill with light knockout text. We find it by SHAPE — a solid-ish,
// elongated blob with text holes — using a LOCAL adaptive threshold, because the
// box and the card have nearly equal brightness (a global threshold can't separate
// them, but "darker than the local neighbourhood" can). Handles several backs in
// one frame (each box is found independently) and right-angle rotations.
//
// Pure typed-array canvas work — no OpenCV. Detection runs on a downscaled copy.

import { rotateCanvas, rotateCanvasDeg } from './rotate';

export interface CodeBox {
  /** Bounding box in full-frame pixels. */
  x: number;
  y: number;
  w: number;
  h: number;
  /** 'h' = text runs horizontally (upright or 180°), 'v' = rotated 90°/270°. */
  orient: 'h' | 'v';
  score: number;
  /** In-plane tilt (degrees) of the pill's long axis relative to the box orientation,
   *  estimated from the dark component's pixel moments. A handheld sticker is tilted a
   *  few degrees; de-rotating the crop by -tilt brings the text horizontal for OCR.
   *  null when the component is too round to give a trustworthy axis. */
  tilt: number | null;
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
    // Pixel-moment accumulators for the component's principal-axis (tilt) estimate.
    let sx = 0;
    let sy = 0;
    let sxx = 0;
    let syy = 0;
    let sxy = 0;
    while (sp > 0) {
      const idx = stack[--sp];
      const x = idx % dw;
      const y = (idx / dw) | 0;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
      area++;
      sx += x;
      sy += y;
      sxx += x * x;
      syy += y * y;
      sxy += x * y;
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
        tilt: componentTilt(scored.orient, area, sx, sy, sxx, syy, sxy),
      });
    }
  }

  boxes.sort((a, b) => b.score - a.score);
  const kept = nonMaxSuppress(boxes, 0.3).slice(0, 10);

  // Only the strongest, most pill-shaped boxes get de-rotated. A weak box (low score)
  // is usually NOT a code pill, and de-rotating it tends to manufacture a clean-looking
  // but spurious read (e.g. a stray dark blob that resolves to the "00" logo) — a false
  // positive a trading app must never produce. The real code pill always scores near the
  // top, so we drop the tilt on any box more than TILT_SCORE_MARGIN below the best.
  const best = kept.length ? kept[0].score : 0;
  for (const b of kept) {
    if (b.score < best - TILT_SCORE_MARGIN) b.tilt = null;
  }
  return kept;
}

/** A box is only de-rotated when its measured lean is in [MIN_TILT_DEG, MAX_TILT_DEG].
 *  Below the minimum the upright crop reads fine and de-rotation risks dropping a digit
 *  into a wrong real code; above the maximum the component is likely mis-segmented and
 *  the 90°-turn candidates cover it. */
const MIN_TILT_DEG = 6;
const MAX_TILT_DEG = 30;

/** A box is only de-rotated if its score is within this margin of the frame's best box.
 *  Weaker boxes are rarely the real pill, and de-rotating them invents false positives. */
const TILT_SCORE_MARGIN = 0.08;

/** In-plane tilt (degrees) of a component's long axis, from its pixel moments. For an
 *  'h' box the long axis is near horizontal, so the tilt IS the long-axis angle; for a
 *  'v' box the long axis is near vertical, so the tilt relative to the 90°-turned crop
 *  is (angle - 90). Returns null when the component isn't clearly elongated (a round
 *  mass has no meaningful axis) or the tilt is too large to be a small off-axis lean
 *  (beyond that the axis-aligned + 90° candidates already cover it). All inputs are in
 *  the downscaled detection space, which is fine — angle is scale-invariant. */
function componentTilt(
  orient: 'h' | 'v',
  area: number,
  sx: number,
  sy: number,
  sxx: number,
  syy: number,
  sxy: number,
): number | null {
  if (area < 12) return null;
  const cx = sx / area;
  const cy = sy / area;
  const uxx = sxx / area - cx * cx;
  const uyy = syy / area - cy * cy;
  const uxy = sxy / area - cx * cy;

  // Elongation: require the long axis to clearly dominate, else the angle is noise.
  const tr = uxx + uyy;
  const det = uxx * uyy - uxy * uxy;
  const disc = Math.sqrt(Math.max(0, (tr * tr) / 4 - det));
  const l1 = tr / 2 + disc;
  const l2 = tr / 2 - disc;
  if (l2 <= 0 || l1 / l2 < 1.8) return null;

  // Long-axis angle (degrees), in (-90, 90].
  let deg = (0.5 * Math.atan2(2 * uxy, uxx - uyy) * 180) / Math.PI;
  while (deg > 90) deg -= 180;
  while (deg <= -90) deg += 180;

  // Tilt relative to the box's nominal orientation.
  let tilt = orient === 'h' ? deg : deg - 90;
  while (tilt > 45) tilt -= 90;
  while (tilt < -45) tilt += 90;

  // Only de-rotate a box with a CLEAR off-axis lean. Below MIN_TILT_DEG the upright
  // axis-aligned crop already reads cleanly, and de-rotating it only risks the OCR
  // dropping a thin digit (e.g. "CIV 12" → "CIV 2" = a real but WRONG code) — a false
  // positive a trading app must never produce. Above MAX_TILT_DEG the component is
  // usually mis-segmented and the 90°-turn candidates already cover that band.
  if (tilt < -MAX_TILT_DEG || tilt > MAX_TILT_DEG) return null;
  if (Math.abs(tilt) < MIN_TILT_DEG) return null;
  return tilt;
}

/** Geometry gate + score for "is this the code pill?". Returns null if not. */
function scoreBox(w: number, h: number, area: number): { orient: 'h' | 'v'; score: number } | null {
  const fill = area / (w * h);
  const long = Math.max(w, h);
  const short = Math.min(w, h);
  const ar = long / short;

  // Loose sanity gates — the real code pill ranks highest by score; we keep the top
  // candidates and let the OCR + per-line matching reject any false positives. (The
  // pill's fill varies with framing: ~0.5 close up, ~0.7 farther, so don't gate hard.)
  if (ar < 2.0 || ar > 6.0) return null; // "CIV 12" pill is ~3-4:1 (samples ~3.1)
  if (fill < 0.35 || fill > 0.95) return null; // solid-ish blob with text holes
  if (long < DET_LONG * 0.03 || long > DET_LONG * 0.4) return null; // size sanity
  if (short < 4) return null;

  const arScore = 1 - Math.min(1, Math.abs(ar - 3.2) / 3);
  const fillScore = 1 - Math.min(1, Math.abs(fill - 0.6) / 0.4);
  return { orient: w >= h ? 'h' : 'v', score: arScore * 0.5 + fillScore * 0.5 };
}

/** Crop rotations (degrees, canvas clockwise-positive) to APPLY once a box is judged
 *  TILTED. The pill's moment axis reliably tells us a box is off-axis, but its
 *  magnitude/sign are too noisy on a downscaled component to pin the exact correction,
 *  so we sweep a small fixed spread that brackets both lean directions across the
 *  realistic handheld range (~±16°). OCR all of them; the conservative matcher keeps
 *  only the flat one.
 *
 *  This sweep runs ONLY for a clearly-tilted, top-scoring box — never an upright or
 *  weak box — because de-rotating those just manufactures garbled reads that can snap
 *  to a wrong real code (the false positive a trading app must never produce). */
const TILT_SWEEP = [2, -4, 8, 14, -10, 16, -16];

/** Crop rotations to try for a box: the fixed sweep when the box is tilted, else none.
 *  `tilt` is the box's measured lean (null = upright/non-pill → no de-rotation). */
function tiltAngles(tilt: number | null): number[] {
  return tilt === null ? [] : TILT_SWEEP;
}

/** Orientation candidates for a box, rotated toward upright but NOT yet prepared.
 *  Always includes the two axis-aligned candidates (0°/180° or 90°/270°) that resolve
 *  the upside-down ambiguity, PLUS a few extra crops de-rotated by the pill's measured
 *  tilt and small fixed leans so a handheld, slightly-rotated sticker still lands
 *  upright for OCR.
 *
 *  Splitting this out lets the dev harness try alternative prep functions on the exact
 *  same raw crops the app uses. */
export function rawCropCandidates(frame: HTMLCanvasElement, box: CodeBox): HTMLCanvasElement[] {
  const { axis, rotated } = rawCropGroups(frame, box);
  return [...axis, ...rotated];
}

/** Raw crops split into AXIS-aligned (0°/180°/90°/270°) and tilt-corrected groups.
 *  They get prepared differently: the axis crops are sharpened (rescuing thin strokes a
 *  soft capture washed out), but the de-rotated crops are NOT — the rotation resample
 *  already softens them and a second sharpening fragments the digits (e.g. a tilted
 *  "CIV 12" breaks into "CIV" + "12"). */
function rawCropGroups(
  frame: HTMLCanvasElement,
  box: CodeBox,
): { axis: HTMLCanvasElement[]; rotated: HTMLCanvasElement[] } {
  // A little padding so the pill has a margin of card around it — the prep step
  // flood-clears that margin, which cleanly isolates the text.
  const region = cropRegion(frame, box, 0.18);

  // Axis-aligned base: 'h' is already horizontal, 'v' needs a 90° turn first.
  const baseTurn = box.orient === 'h' ? 0 : 90;
  const base = rotateCanvas(region, baseTurn as 0 | 90);
  const flip = rotateCanvas(base, 180);
  const axis = [base, flip];

  // De-rotated crops: rotating the upright base brings a tilted pill flat. A tilted
  // pill's axis-aligned bbox is much taller than the pill, so after rotation the (now
  // horizontal) text sits in a tall canvas full of empty card; prepForOcr scales by the
  // FULL crop height, which would shrink the text band too far. So we tighten the
  // rotated crop to the dark pill's horizontal band first, restoring a text-sized crop.
  // We add both the rotated crop and its 180° flip (the code may be upside down).
  // tiltAngles returns the rotation to APPLY directly (canvas clockwise-positive).
  const rotated: HTMLCanvasElement[] = [];
  for (const deg of tiltAngles(box.tilt)) {
    const r = tightenToPillBand(rotateCanvasDeg(base, deg));
    rotated.push(r, rotateCanvas(r, 180));
  }
  return { axis, rotated };
}

/** Crop a de-rotated canvas down to the horizontal band containing the dark pill, so
 *  the (now upright) text fills the crop and survives prepForOcr's height-based scaling.
 *  We find the rows whose darkest pixels form the pill body (darker than the overall
 *  mean) and keep that band plus a small margin; columns are kept full-width so the
 *  whole code stays in view. Falls back to the input unchanged when no clear band is
 *  found (e.g. a near-blank crop). */
function tightenToPillBand(src: HTMLCanvasElement): HTMLCanvasElement {
  const w = src.width;
  const h = src.height;
  if (w < 8 || h < 8) return src;
  const ctx = src.getContext('2d', { willReadFrequently: true });
  if (!ctx) return src;
  const data = ctx.getImageData(0, 0, w, h).data;

  // Per-row count of "dark" pixels (the pill body is darker than the card/grey fill).
  // Threshold from the global mean keeps this robust to brightness.
  let sum = 0;
  const n = w * h;
  for (let i = 0; i < data.length; i += 4) {
    sum += (data[i] * 77 + data[i + 1] * 150 + data[i + 2] * 29) >> 8;
  }
  const mean = sum / n;
  const thresh = mean * 0.7;

  const rowDark = new Int32Array(h);
  for (let y = 0; y < h; y++) {
    let c = 0;
    for (let x = 0; x < w; x++) {
      const p = (y * w + x) * 4;
      const g = (data[p] * 77 + data[p + 1] * 150 + data[p + 2] * 29) >> 8;
      if (g < thresh) c++;
    }
    rowDark[y] = c;
  }

  // A pill row is one with a meaningful run of dark pixels. Find the tallest contiguous
  // band of such rows (the pill body), then add a margin so glyph tops/bottoms survive.
  const rowMin = w * 0.12;
  let bestStart = -1;
  let bestLen = 0;
  let curStart = -1;
  for (let y = 0; y <= h; y++) {
    const on = y < h && rowDark[y] >= rowMin;
    if (on && curStart < 0) curStart = y;
    if (!on && curStart >= 0) {
      const len = y - curStart;
      if (len > bestLen) {
        bestLen = len;
        bestStart = curStart;
      }
      curStart = -1;
    }
  }
  if (bestStart < 0 || bestLen >= h * 0.85) return src; // no clear band, or already tight

  const margin = Math.round(bestLen * 0.5) + 2;
  const y0 = Math.max(0, bestStart - margin);
  const y1 = Math.min(h, bestStart + bestLen + margin);
  const bh = y1 - y0;
  if (bh <= 0 || bh >= h) return src;

  const out = document.createElement('canvas');
  out.width = w;
  out.height = bh;
  const octx = out.getContext('2d', { willReadFrequently: true });
  if (!octx) return src;
  octx.drawImage(src, 0, y0, w, bh, 0, 0, w, bh);
  return out;
}

/** Build the upright + 180°-flipped OCR crops for a detected box, each prepared
 *  (rotated upright, upscaled, binarized to dark-text-on-white, padded). The two
 *  candidates resolve the 0°/180° (or 90°/270°) ambiguity at OCR time. */
export function codeCropCandidates(frame: HTMLCanvasElement, box: CodeBox): HTMLCanvasElement[] {
  const { axis, rotated } = rawCropGroups(frame, box);
  return [...axis.map((c) => prepForOcr(c, true)), ...rotated.map((c) => prepForOcr(c, false))];
}

/** DEV-ONLY hooks for the probe harness (brute-force angle sweep). Not used by app. */
export function _rawRegion(frame: HTMLCanvasElement, box: CodeBox): HTMLCanvasElement {
  const region = cropRegion(frame, box, 0.18);
  return box.orient === 'h' ? rotateCanvas(region, 0) : rotateCanvas(region, 90);
}
export function _rotDeg(c: HTMLCanvasElement, deg: number): HTMLCanvasElement {
  return tightenToPillBand(rotateCanvasDeg(c, deg));
}
export function _prep(c: HTMLCanvasElement): HTMLCanvasElement {
  return prepForOcr(c, false);
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
/** Unsharp-mask strength (percent) applied before binarization to rescue thin strokes
 *  from a soft/blurry capture. Gentle — enough to recover the "I"/"1" without turning
 *  sensor noise into ink. */
const UNSHARP_AMOUNT = 30;
/** A real code pill is a few sparse glyphs — well under this share of ink after the
 *  card margin is cleared. A crop with more ink than this is a photo or a paragraph
 *  of legal text (a face-up sticker, the back's fine print); we blank it so OCR
 *  returns instantly instead of grinding through dozens of characters (which made a
 *  busy multi-sticker frame take >12s on a phone). */
const MAX_INK_FRACTION = 0.28;

/** Upscale to a good OCR size and binarize to dark-text-on-white with a quiet
 *  border. The code is LIGHT text on a DARK pill, so ink (black) = the light pixels
 *  and the dark pill becomes white. Everything connected to the border (the card
 *  margin around the pill, and any inverted dark-on-light region) is then cleared,
 *  which both isolates the text and turns false-positive boxes (legal text, logos)
 *  into blanks that match nothing. */
function prepForOcr(src: HTMLCanvasElement, sharpen: boolean): HTMLCanvasElement {
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

  const gray = new Uint8Array(count);
  for (let i = 0, p = 0; i < px.length; i += 4, p++) {
    gray[p] = (px[i] * 77 + px[i + 1] * 150 + px[i + 2] * 29) >> 8;
  }

  // Unsharp mask (axis-aligned crops only): restore local contrast on thin strokes that
  // a soft/blurry capture washed out (the "I" in CIV, the "1" in 12 fade into the pill
  // and otsu then drops them, mis-reading "CIV 12" as "CV2"). sharp = gray + amount·(gray
  // − localMean), clamped. Gentle radius/amount so it sharpens edges without amplifying
  // noise. Skipped on de-rotated crops: the rotation resample already softens them and a
  // second sharpening fragments the digits ("CIV 12" → "CIV" + "12").
  const hist = new Array<number>(256).fill(0);
  if (sharpen) {
    const usRadius = Math.max(1, Math.round(TARGET_H * 0.04));
    const mean = boxBlur(gray, cw, ch, usRadius);
    for (let p = 0; p < count; p++) {
      const s = gray[p] + ((gray[p] - mean[p]) * UNSHARP_AMOUNT) / 100;
      const v = s < 0 ? 0 : s > 255 ? 255 : s | 0;
      gray[p] = v;
      hist[v]++;
    }
  } else {
    for (let p = 0; p < count; p++) hist[gray[p]]++;
  }
  const threshold = otsu(hist, count);

  // Ink (0) = light pixels (the knockout text); dark pill → white (255).
  const bin = new Uint8Array(count);
  for (let p = 0; p < count; p++) bin[p] = gray[p] > threshold ? 0 : 255;

  floodClearFromBorder(bin, cw, ch);

  // Sparse-ink gate: a code is a few glyphs; anything denser is a photo or fine
  // print. Blank it so the OCR call returns at once (the per-crop speed guard).
  let ink = 0;
  for (let p = 0; p < count; p++) if (bin[p] === 0) ink++;
  if (ink > count * MAX_INK_FRACTION) bin.fill(255);

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
