// Feature extraction for the pure-JS glyph classifier (createGlyphOcrEngine).
//
// The OCR engine receives a PREPARED crop from locate.ts: pure black/white, ink (the
// light knockout text) = 0/black, background = 255/white, with the card margin already
// flood-cleared. So all this module ever sees is a clean binary bitmap of a few glyphs
// on white. We segment it into glyph components and turn each into a compact,
// translation/scale-NORMALIZED feature vector that a nearest-neighbour classifier can
// match against the rendered atlas (glyphAtlas.ts). The vector deliberately mixes a
// coarse downsampled grid (overall shape) with zoning density + projection profiles
// (robust to the blur/aliasing of soft video frames) — the brief's "feature-vector,
// not raw-pixel NCC" idea, which survives the font mismatch better than pixel NCC.

/** Side of the square downsampled grid the glyph bitmap is normalized to. 16×16 keeps
 *  enough shape to separate B/8/E while staying blur-tolerant — a finer 20×20 grid
 *  sharpened the soft-video glyphs into noise and lost rotation robustness. */
export const GRID = 16;

/** Side of the zoning grid (ZONE×ZONE density blocks). 3×3 quadrant mass, blur-robust. */
const ZONE = 3;

/** A segmented glyph: its tight ink bounding box in the source crop plus its feature
 *  vector. x/w are kept so the caller can order glyphs left-to-right and judge spacing
 *  (the gap before the number). */
export interface GlyphBox {
  x: number;
  y: number;
  w: number;
  h: number;
  /** Ink pixel count — used to drop specks and to weight ambiguous reads. */
  area: number;
  feat: Float32Array;
  /** Aspect ratio h/w of the tight box — a strong prior (I/1 are tall-thin, M/W wide). */
  ar: number;
}

/** Weight on the aspect-ratio feature. The grid + profiles are translation/scale
 *  normalized and so are blind to overall proportion (a stretched "I" fills the grid
 *  like a "B"); this explicit, strongly-weighted AR channel restores the thin/wide
 *  distinction the letterboxed grid mostly captures but the cosine can still blur. */
const AR_WEIGHT = 1.2;

/** Length of one feature vector. Layout (all in [0,1] before the L2-normalize):
 *   - GRID*GRID    letterboxed (aspect-preserving) downsampled coverage cells
 *   - GRID         column ink profile (vertical projection)
 *   - GRID         row ink profile (horizontal projection)
 *   - ZONE*ZONE    zoning density
 *   - 1            aspect-ratio channel (AR_WEIGHT · normalized width/height)
 *  Concatenated then L2-normalized so cosine == dot product. */
export const FEAT_LEN = GRID * GRID + GRID + GRID + ZONE * ZONE + 1;

/** Read a prepared crop into a flat ink mask (1 = ink/black, 0 = white). */
export function cropToMask(crop: HTMLCanvasElement): { mask: Uint8Array; w: number; h: number } {
  const w = crop.width;
  const h = crop.height;
  const ctx = crop.getContext('2d', { willReadFrequently: true });
  if (!ctx) return { mask: new Uint8Array(0), w: 0, h: 0 };
  const d = ctx.getImageData(0, 0, w, h).data;
  const mask = new Uint8Array(w * h);
  for (let p = 0, i = 0; i < d.length; i += 4, p++) mask[p] = d[i] < 128 ? 1 : 0;
  return { mask, w, h };
}

/** Segment a binary ink mask into glyph components (8-connected), returning their tight
 *  bounding boxes ordered left-to-right. Tiny specks and the rare too-large blob are
 *  dropped. Components are then split/merged by simple column logic in segmentGlyphs. */
function components(
  mask: Uint8Array,
  w: number,
  h: number,
): Array<{ x0: number; y0: number; x1: number; y1: number; area: number }> {
  const labels = new Int32Array(w * h).fill(-1);
  const stack = new Int32Array(w * h);
  const out: Array<{ x0: number; y0: number; x1: number; y1: number; area: number }> = [];
  for (let s = 0; s < mask.length; s++) {
    if (mask[s] === 0 || labels[s] !== -1) continue;
    let sp = 0;
    stack[sp++] = s;
    labels[s] = s;
    let x0 = w;
    let y0 = h;
    let x1 = 0;
    let y1 = 0;
    let area = 0;
    while (sp > 0) {
      const i = stack[--sp];
      const x = i % w;
      const y = (i / w) | 0;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
      area++;
      // 8-connectivity so an aliased stroke (the thin "I") stays one component.
      for (let dy = -1; dy <= 1; dy++) {
        const ny = y + dy;
        if (ny < 0 || ny >= h) continue;
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const nx = x + dx;
          if (nx < 0 || nx >= w) continue;
          const ni = ny * w + nx;
          if (mask[ni] === 1 && labels[ni] === -1) {
            labels[ni] = s;
            stack[sp++] = ni;
          }
        }
      }
    }
    out.push({ x0, y0, x1, y1, area });
  }
  return out;
}

/**
 * Segment the prepared crop into ordered glyph boxes. Strategy:
 *  1. find connected ink components;
 *  2. estimate the text band (median glyph height) and drop specks far below it and
 *     blobs far above it (card noise, merged smears);
 *  3. order left-to-right; merge components that overlap heavily in x (a broken stroke,
 *     e.g. the dot+body that a soft "i"-like stroke can fragment into) so each real
 *     glyph is one box.
 * Returns boxes WITHOUT features (compute those per kept box, after the band filter).
 */
export function segmentBoxes(
  mask: Uint8Array,
  w: number,
  h: number,
): Array<{ x0: number; y0: number; x1: number; y1: number; area: number }> {
  const comps = components(mask, w, h);
  if (comps.length === 0) return [];

  // Robust text-band height = median component height (the digits/letters dominate).
  const heights = comps.map((c) => c.y1 - c.y0 + 1).sort((a, b) => a - b);
  const medH = heights[heights.length >> 1] || 1;
  // Keep components whose height is a plausible glyph: not a speck, not a giant smear.
  const kept = comps.filter((c) => {
    const ch = c.y1 - c.y0 + 1;
    const cw = c.x1 - c.x0 + 1;
    if (ch < medH * 0.32) return false; // speck / stray dot
    if (ch > medH * 1.9) return false; // merged blob / border remnant
    if (cw > w * 0.7) return false; // a smear spanning the crop
    if (c.area < 6) return false;
    return true;
  });
  if (kept.length === 0) return [];

  kept.sort((a, b) => a.x0 - b.x0);

  // Merge boxes that overlap heavily in x AND sit at compatible heights — a single glyph
  // that segmentation split (a soft stroke breaking into two stacked pieces). We do NOT
  // merge side-by-side glyphs: those barely overlap in x.
  const merged: typeof kept = [];
  for (const c of kept) {
    const last = merged[merged.length - 1];
    if (last) {
      const ox0 = Math.max(last.x0, c.x0);
      const ox1 = Math.min(last.x1, c.x1);
      const overlap = ox1 - ox0 + 1;
      const minW = Math.min(last.x1 - last.x0 + 1, c.x1 - c.x0 + 1);
      if (overlap > minW * 0.6) {
        last.x0 = Math.min(last.x0, c.x0);
        last.y0 = Math.min(last.y0, c.y0);
        last.x1 = Math.max(last.x1, c.x1);
        last.y1 = Math.max(last.y1, c.y1);
        last.area += c.area;
        continue;
      }
    }
    merged.push({ ...c });
  }

  // SPLIT wide components. A condensed glyph is taller than wide (AR≈1.4–1.9 h/w), so a
  // box much WIDER than the band height holds ≥2 touching glyphs (the soft-video case:
  // "GY" binarizes into one bridged blob, mis-reading as a wide "W"/"M"). Cut such a box
  // at its deepest interior column-ink VALLEY, recursively, until each piece is a
  // plausible single-glyph width. Touching glyphs in a tight font are joined by a thin
  // bridge, so the valley between their bodies is a reliable cut. We never split a box
  // that's already glyph-narrow, so clean frames are untouched.
  const out: typeof merged = [];
  for (const c of merged) splitWide(mask, w, c, medH, out);
  out.sort((a, b) => a.x0 - b.x0);
  return splitFirstMergedGlyphInShortCode(mask, w, medH, out);
}

/** Width (as a multiple of glyph HEIGHT) above which a box is assumed to hold ≥2 touching
 *  glyphs. A condensed glyph is taller than wide (the widest, M/W, reach ~1.0× the
 *  height); 1.25 catches a 2-glyph merge while leaving real single glyphs whole. */
const MERGE_W_RATIO = 1.25;

/** In weak Pixel crops the first two letters of a 3-letter code can bridge into a component
 *  that is wider than one condensed glyph, but still below the normal "definitely merged"
 *  threshold. This lower threshold is only used in the narrow 4-component code-shape rescue. */
const SHORT_CODE_FIRST_MERGE_W_RATIO = 1.1;

/** Estimated single-glyph width as a fraction of the band height — the ideal seam between
 *  two merged glyphs sits ~one of these in from the left. */
const GLYPH_W_FRAC = 0.62;

/** Recursively split a wide (merged) box into its constituent glyphs at the interior
 *  column-ink valley nearest the ideal one-glyph boundary, appending the single-glyph
 *  pieces to `out`. WIDTH-DRIVEN: only a box ≥MERGE_W_RATIO× as wide as tall is split (so
 *  a real single glyph is never cut), and within it the seam is taken regardless of bridge
 *  thickness — touching glyphs in this tight font are joined by a solid bridge a depth gate
 *  would miss. This is what lets a soft "GY" smear read as G+Y instead of a phantom "W". */
function splitWide(
  mask: Uint8Array,
  w: number,
  box: { x0: number; y0: number; x1: number; y1: number; area: number },
  medH: number,
  out: Array<{ x0: number; y0: number; x1: number; y1: number; area: number }>,
): void {
  const bw = box.x1 - box.x0 + 1;
  const bh = box.y1 - box.y0 + 1;
  const tallness = Math.max(bh, medH * 0.85); // band height, robust to a short merged blob
  if (bw < tallness * MERGE_W_RATIO || bw < 14) {
    out.push(box);
    return;
  }
  // Column ink counts within the box.
  const col = new Int32Array(bw);
  for (let y = box.y0; y <= box.y1; y++) {
    const row = y * w;
    for (let x = box.x0; x <= box.x1; x++) if (mask[row + x] === 1) col[x - box.x0]++;
  }
  // Seam ≈ one glyph-width in from the left; search a window around it for the least ink.
  const glyphW = Math.max(8, tallness * GLYPH_W_FRAC);
  const ideal = Math.min(bw - 4, Math.max(4, Math.round(glyphW)));
  const lo = Math.max(3, ideal - Math.round(glyphW * 0.5));
  const hi = Math.min(bw - 4, ideal + Math.round(glyphW * 0.5));
  let cut = -1;
  let cutVal = Infinity;
  for (let x = lo; x <= hi; x++) {
    if (col[x] < cutVal) {
      cutVal = col[x];
      cut = x;
    }
  }
  if (cut < lo) {
    out.push(box);
    return;
  }
  const left = { x0: box.x0, y0: box.y0, x1: box.x0 + cut - 1, y1: box.y1, area: 0 };
  const right = { x0: box.x0 + cut, y0: box.y0, x1: box.x1, y1: box.y1, area: 0 };
  // Recompute tight y/area for each half so a half holding a shorter glyph keeps its box.
  for (const half of [left, right]) {
    let y0 = box.y1;
    let y1 = box.y0;
    let area = 0;
    for (let y = box.y0; y <= box.y1; y++) {
      const row = y * w;
      for (let x = half.x0; x <= half.x1; x++) {
        if (mask[row + x] === 1) {
          area++;
          if (y < y0) y0 = y;
          if (y > y1) y1 = y;
        }
      }
    }
    if (area < 6) continue; // empty half — drop
    half.y0 = y0;
    half.y1 = y1;
    half.area = area;
    splitWide(mask, w, half, medH, out);
  }
}

function splitFirstMergedGlyphInShortCode(
  mask: Uint8Array,
  w: number,
  medH: number,
  boxes: Array<{ x0: number; y0: number; x1: number; y1: number; area: number }>,
): Array<{ x0: number; y0: number; x1: number; y1: number; area: number }> {
  if (boxes.length !== 4) return boxes;
  const first = boxes[0];
  const firstW = first.x1 - first.x0 + 1;
  const firstH = first.y1 - first.y0 + 1;
  const tallness = Math.max(firstH, medH * 0.85);
  if (firstW < tallness * SHORT_CODE_FIRST_MERGE_W_RATIO || firstW >= tallness * MERGE_W_RATIO) {
    return boxes;
  }

  const split: typeof boxes = [];
  splitWideForced(mask, w, first, medH, split);
  if (split.length !== 2) return boxes;

  const rescued = [...split, ...boxes.slice(1)];
  rescued.sort((a, b) => a.x0 - b.x0);
  return rescued;
}

function splitWideForced(
  mask: Uint8Array,
  w: number,
  box: { x0: number; y0: number; x1: number; y1: number; area: number },
  medH: number,
  out: Array<{ x0: number; y0: number; x1: number; y1: number; area: number }>,
): void {
  const bw = box.x1 - box.x0 + 1;
  if (bw < 14) {
    out.push(box);
    return;
  }
  const bh = box.y1 - box.y0 + 1;
  const tallness = Math.max(bh, medH * 0.85);
  const col = new Int32Array(bw);
  for (let y = box.y0; y <= box.y1; y++) {
    const row = y * w;
    for (let x = box.x0; x <= box.x1; x++) if (mask[row + x] === 1) col[x - box.x0]++;
  }
  const glyphW = Math.max(8, tallness * GLYPH_W_FRAC);
  const ideal = Math.min(bw - 4, Math.max(4, Math.round(glyphW)));
  const minPart = Math.max(8, Math.round(tallness * 0.32));
  const lo = Math.max(minPart, Math.round(tallness * 0.35));
  const hi = Math.min(bw - minPart, Math.round(tallness * 1.15));
  let cut = -1;
  let cutVal = Infinity;
  let cutDist = Infinity;
  for (let x = lo; x <= hi; x++) {
    const dist = Math.abs(x - ideal);
    if (col[x] < cutVal || (col[x] === cutVal && dist < cutDist)) {
      cutVal = col[x];
      cut = x;
      cutDist = dist;
    }
  }
  if (cut < lo) {
    out.push(box);
    return;
  }

  const left = { x0: box.x0, y0: box.y0, x1: box.x0 + cut - 1, y1: box.y1, area: 0 };
  const right = { x0: box.x0 + cut, y0: box.y0, x1: box.x1, y1: box.y1, area: 0 };
  for (const half of [left, right]) {
    let y0 = box.y1;
    let y1 = box.y0;
    let area = 0;
    for (let y = box.y0; y <= box.y1; y++) {
      const row = y * w;
      for (let x = half.x0; x <= half.x1; x++) {
        if (mask[row + x] === 1) {
          area++;
          if (y < y0) y0 = y;
          if (y > y1) y1 = y;
        }
      }
    }
    if (area < 6) continue;
    half.y0 = y0;
    half.y1 = y1;
    half.area = area;
    out.push(half);
  }
}

/**
 * Compute the normalized feature vector for one glyph box in the ink mask.
 * The glyph is resampled into a GRID×GRID grayscale coverage grid by AREA AVERAGING
 * (each output cell = fraction of source ink pixels mapping into it), which is far more
 * blur-robust than nearest-pixel sampling: a soft, anti-aliased stroke still produces a
 * smooth coverage ramp the atlas (rendered + blurred) also has.
 *
 * Crucially we PRESERVE ASPECT RATIO: the glyph is scaled by its LONGER side and
 * letterboxed (centered with empty margins) into the square grid, so a thin "I" lands
 * in the centre columns with blank sides — visibly different from a wide "B" that fills
 * the grid. Stretching to fill (the naive downsample) made I/1 collapse onto B/8. An
 * explicit AR channel reinforces the same distinction.
 */
export function glyphFeature(
  mask: Uint8Array,
  w: number,
  box: { x0: number; y0: number; x1: number; y1: number },
): Float32Array {
  const bx = box.x0;
  const by = box.y0;
  const bw = box.x1 - box.x0 + 1;
  const bh = box.y1 - box.y0 + 1;

  // Aspect-preserving fit: scale by the longer side so the glyph fills one grid
  // dimension and is centred (letterboxed) in the other.
  const longer = Math.max(bw, bh);
  const sx = (GRID * bw) / longer; // glyph width in grid cells
  const sy = (GRID * bh) / longer; // glyph height in grid cells
  const offx = (GRID - sx) / 2;
  const offy = (GRID - sy) / 2;

  const grid = new Float32Array(GRID * GRID);
  const counts = new Float32Array(GRID * GRID);
  for (let y = 0; y < bh; y++) {
    const gy = Math.min(GRID - 1, (offy + (y * sy) / bh) | 0);
    const row = (by + y) * w + bx;
    for (let x = 0; x < bw; x++) {
      const gx = Math.min(GRID - 1, (offx + (x * sx) / bw) | 0);
      const gi = gy * GRID + gx;
      counts[gi]++;
      if (mask[row + x] === 1) grid[gi]++;
    }
  }
  for (let i = 0; i < grid.length; i++) grid[i] = counts[i] > 0 ? grid[i] / counts[i] : 0;

  // Column (vertical) + row (horizontal) ink projection profiles, each GRID long, in [0,1].
  const colp = new Float32Array(GRID);
  const rowp = new Float32Array(GRID);
  for (let i = 0; i < GRID * GRID; i++) {
    const gx = i % GRID;
    const gy = (i / GRID) | 0;
    colp[gx] += grid[i];
    rowp[gy] += grid[i];
  }
  for (let i = 0; i < GRID; i++) {
    colp[i] /= GRID;
    rowp[i] /= GRID;
  }

  // ZONE×ZONE zoning density.
  const zone = new Float32Array(ZONE * ZONE);
  for (let i = 0; i < GRID * GRID; i++) {
    const gx = i % GRID;
    const gy = (i / GRID) | 0;
    const zx = Math.min(ZONE - 1, (gx * ZONE / GRID) | 0);
    const zy = Math.min(ZONE - 1, (gy * ZONE / GRID) | 0);
    zone[zy * ZONE + zx] += grid[i];
  }
  const per = (GRID * GRID) / (ZONE * ZONE);
  for (let i = 0; i < ZONE * ZONE; i++) zone[i] /= per;

  // Aspect-ratio channel: normalized width/height in [0,1] (1 = as-wide-as-tall, →0 for
  // a thin tall glyph). Weighted up so it meaningfully steers the cosine.
  const arFeat = (AR_WEIGHT * Math.min(bw, bh)) / Math.max(bw, bh);

  // Concatenate and L2-normalize (cosine NN == dot product).
  const feat = new Float32Array(FEAT_LEN);
  let o = 0;
  for (let i = 0; i < grid.length; i++) feat[o++] = grid[i];
  for (let i = 0; i < GRID; i++) feat[o++] = colp[i];
  for (let i = 0; i < GRID; i++) feat[o++] = rowp[i];
  for (let i = 0; i < ZONE * ZONE; i++) feat[o++] = zone[i];
  feat[o++] = arFeat;

  let norm = 0;
  for (let i = 0; i < feat.length; i++) norm += feat[i] * feat[i];
  norm = Math.sqrt(norm) || 1;
  for (let i = 0; i < feat.length; i++) feat[i] /= norm;
  return feat;
}

/** Segment + featurize a prepared crop into ordered GlyphBoxes (left-to-right). */
export function extractGlyphs(crop: HTMLCanvasElement): GlyphBox[] {
  const { mask, w, h } = cropToMask(crop);
  if (w === 0) return [];
  const boxes = segmentBoxes(mask, w, h);
  return boxes.map((b) => ({
    x: b.x0,
    y: b.y0,
    w: b.x1 - b.x0 + 1,
    h: b.y1 - b.y0 + 1,
    area: b.area,
    feat: glyphFeature(mask, w, b),
    ar: (b.y1 - b.y0 + 1) / (b.x1 - b.x0 + 1),
  }));
}

/** Cosine similarity of two L2-normalized vectors == dot product. */
export function cosine(a: Float32Array, b: Float32Array): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}
