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
import { CONFIG } from '../config';

export interface CodeBox {
  /** Axis-aligned bounding box in full-frame pixels. For a rotated pill this is the
   *  square-ish box that wraps the tilted blob; the crop is de-rotated by `tilt` to
   *  bring the pill horizontal before OCR. */
  x: number;
  y: number;
  w: number;
  h: number;
  /** 'h' = text runs horizontally (upright or 180°), 'v' = rotated 90°/270°. Kept for
   *  the bench debug line; with moment-based detection the de-rotation angle (`tilt`)
   *  carries the real orientation, so this is only a coarse landscape/portrait hint. */
  orient: 'h' | 'v';
  score: number;
  /** In-plane angle (degrees, canvas clockwise-positive) the crop must be rotated by to
   *  bring the pill's long axis horizontal, from the dark component's pixel moments.
   *  Rotation-invariant: works for a steeply-tilted pill (30–75°) whose axis-aligned
   *  box is nearly square. null when the component is too round to give a trustworthy
   *  axis, or the box is too weak to safely de-rotate (false-positive guard). */
  tilt: number | null;
  /** Moment-derived pill short side (px, full-frame). After de-rotating the square bbox
   *  about its centre the pill is a horizontal strip ~this tall through the middle, so we
   *  crop a centred strip of this height (+margin) — far more reliable than searching the
   *  de-rotated square for a dark band (which can grab the card's legal-text block). */
  pillW: number;
  /** Moment fill = area / (L·W): how solidly the blob fills its equivalent rectangle. A
   *  real pill is solid (~0.7); a hollow stray "0" blob or sparse legal text is lower. */
  fill: number;
  /** Whether this box may use the taller small-source OCR target. Set in findCodeBoxes:
   *  the boost rescues a genuinely small/far PILL's thin strokes, but it also sharpens a
   *  hollow stray blob (a "0" ring) into a phantom "00", so it's gated on score AND fill. */
  boost: boolean;
}

/** Rotation-invariant shape descriptors of a connected component, from its pixel
 *  moments. Unlike the axis-aligned w×h, these hold at ANY in-plane rotation: a code
 *  pill tilted 45° has a near-square bounding box (AR≈1) but its moment AR is still
 *  ~3–4. `angle` is the long-axis angle in degrees, in (-90, 90], measured from the
 *  +x axis; de-rotating a crop by -angle brings the pill horizontal. */
interface MomentShape {
  /** Rotation-invariant aspect ratio L/W (equivalent-rectangle side lengths). */
  ar: number;
  /** Fill = area / (L·W): how fully the blob fills its equivalent rectangle. */
  fill: number;
  /** Equivalent-rectangle long side L (px, detection space). */
  size: number;
  /** Equivalent-rectangle short side W (px, detection space). */
  short: number;
  /** Larger eigenvalue of the central second-moment matrix. */
  l1: number;
  /** Smaller eigenvalue. l1/l2 ≫ 1 ⇒ clearly elongated (a trustworthy axis). */
  l2: number;
  /** Long-axis angle in degrees, (-90, 90], from +x. */
  angle: number;
}

/** Compute the rotation-invariant shape from a component's accumulated pixel moments.
 *  Shared by the geometry gate (scoreBox) and the de-rotation angle — they must agree.
 *  Returns null when the component is too small to be meaningful. */
function momentShape(
  area: number,
  sx: number,
  sy: number,
  sxx: number,
  syy: number,
  sxy: number,
): MomentShape | null {
  if (area < 12) return null;
  const cx = sx / area;
  const cy = sy / area;
  const uxx = sxx / area - cx * cx;
  const uyy = syy / area - cy * cy;
  const uxy = sxy / area - cx * cy;

  // Eigenvalues of the 2×2 central second-moment matrix [[uxx,uxy],[uxy,uyy]].
  const tr = uxx + uyy;
  const det = uxx * uyy - uxy * uxy;
  const disc = Math.sqrt(Math.max(0, (tr * tr) / 4 - det));
  const l1 = tr / 2 + disc;
  const l2 = tr / 2 - disc;

  // Side lengths of the uniform rectangle with the same second moments (var = s²/12).
  const L = Math.sqrt(Math.max(0, 12 * l1));
  const W = Math.sqrt(Math.max(0, 12 * l2));
  if (W <= 0 || L <= 0) return null;

  // Long-axis angle (degrees), in (-90, 90].
  let angle = (0.5 * Math.atan2(2 * uxy, uxx - uyy) * 180) / Math.PI;
  while (angle > 90) angle -= 180;
  while (angle <= -90) angle += 180;

  return { ar: L / W, fill: area / (L * W), size: L, short: W, l1, l2, angle };
}

/** Long side (px) of the downscaled image used for detection. Detection runs on EVERY frame
 *  and is a guaranteed per-frame cost, with the connected-component work ~O(area) — so this
 *  scales with its square. Held at 720 (not the cheaper 600): the finer raster keeps a far
 *  multi-up pill (~30px) crisp enough for the second DET_BG_RADII pass and the size gate to
 *  catch — which is exactly the recall the real-life video frames depend on (0→4 of 6). The
 *  extra raster cost is affordable: detection still measures ~28ms median, well inside the
 *  100ms per-frame budget, since detection isn't the bottleneck (OCR of the located crops
 *  is). */
const DET_LONG = 720;

/** Local-background radii (as a fraction of DET_LONG) the pill detector runs at — detection
 *  runs once PER radius and unions the results. The long-proven 0.045 radius segments
 *  close-up and held-at-distance pills across the readable set on its own; the finer 0.025
 *  radius rescues a far/multi-up pill hollowed-out next to the big FIFA logo. The second pass
 *  is what recovers the real-life video pills (CIV12/EGY5/RSA17/RSA19 — 0→4 of 6), and its
 *  added detection cost is small (~28ms median total, inside the 100ms budget), so we keep
 *  both rather than lean on the live burst's cross-frame confirmer to catch them later. */
const DET_BG_RADII = [0.045, 0.025] as const;

/** How much darker than its local background a pixel must be to count as pill foreground. */
const FG_DELTA = 12;

/** Run the connected-component pill search at one background radius, appending every
 *  box that passes the geometry gate to `out`. Split out so findCodeBoxes can run it at
 *  several radii (small + large pills need different local-threshold scales). */
function collectBoxes(
  gray: Uint8Array,
  dw: number,
  dh: number,
  scale: number,
  radius: number,
  out: CodeBox[],
): void {
  const n = dw * dh;
  const bg = boxBlur(gray, dw, dh, radius);
  const fg = new Uint8Array(n);
  const fgDelta = CONFIG.detect.fgDelta || FG_DELTA;
  for (let i = 0; i < n; i++) fg[i] = gray[i] < bg[i] - fgDelta ? 1 : 0;

  const labels = new Int32Array(n).fill(-1);
  const stack = new Int32Array(n);
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
    const shape = momentShape(area, sx, sy, sxx, syy, sxy);
    const scored = shape && scoreBox(shape);
    if (scored && shape) {
      out.push({
        x: minX / scale,
        y: minY / scale,
        w: w / scale,
        h: h / scale,
        orient: w >= h ? 'h' : 'v',
        score: scored.score,
        tilt: deRotationAngle(shape),
        pillW: shape.short / scale,
        fill: shape.fill,
        boost: false, // set in findCodeBoxes (needs score + fill)
      });
    }
  }
}

/** Public detection entry. When CONFIG.detect.roiTopFraction > 0, detection runs ONLY on a
 *  bottom band of the frame (rows [roiTopFraction*H .. H]): the band is drawn into its own
 *  sub-canvas, the FULL detection pipeline runs on it, and the band's top offset is added
 *  back to every box's y so the result is in FULL-FRAME coordinates — cropRegion /
 *  codeCropSource then extract the right pixels unchanged. The band cuts detection cost
 *  (~O(area)) and stops the FIFA logo / header / legal text above the pill from ever
 *  becoming a crop. roiTopFraction = 0 (default) detects the whole frame, byte-identical to
 *  the previous behaviour (no sub-canvas, no offset). */
export function findCodeBoxes(frame: HTMLCanvasElement): CodeBox[] {
  const fw = frame.width;
  const fh = frame.height;
  if (!fw || !fh) return [];

  // A rectangular ROI (when set) takes precedence over the bottom band: detect only inside
  // the normalized rect, then offset boxes back to full-frame coordinates. Scale is taken
  // against the FULL frame's long side (like the band path) so every DET_LONG-relative gate
  // stays calibrated; the cropped rect is just the matching slice of the full-frame raster.
  const rect = CONFIG.detect.roiRect;
  if (rect) {
    const x0 = Math.min(fw - 1, Math.max(0, Math.round(rect.left * fw)));
    const y0 = Math.min(fh - 1, Math.max(0, Math.round(rect.top * fh)));
    const x1 = Math.min(fw, Math.max(x0 + 1, Math.round(rect.right * fw)));
    const y1 = Math.min(fh, Math.max(y0 + 1, Math.round(rect.bottom * fh)));
    const rw = x1 - x0;
    const rh = y1 - y0;
    const sub = document.createElement('canvas');
    sub.width = rw;
    sub.height = rh;
    const sctx = sub.getContext('2d', { willReadFrequently: true });
    if (!sctx) return detectBoxes(frame);
    sctx.drawImage(frame, x0, y0, rw, rh, 0, 0, rw, rh);
    const boxes = detectBoxes(sub, Math.max(fw, fh));
    for (const b of boxes) {
      b.x += x0;
      b.y += y0;
    }
    return boxes;
  }

  const roi = CONFIG.detect.roiTopFraction;
  if (roi <= 0 || roi >= 1) return detectBoxes(frame);

  // Full-frame pixel band [bandY0 .. fh). Round the top so the band aligns to a pixel row;
  // a height of at least 1 keeps drawImage's source rect valid for extreme fractions.
  const bandY0 = Math.min(fh - 1, Math.max(0, Math.round(roi * fh)));
  const bandH = fh - bandY0;

  const band = document.createElement('canvas');
  band.width = fw;
  band.height = bandH;
  const bctx = band.getContext('2d', { willReadFrequently: true });
  if (!bctx) return detectBoxes(frame);
  bctx.drawImage(frame, 0, bandY0, fw, bandH, 0, 0, fw, bandH);

  // CRITICAL: scale the band against the FULL frame's long side, not the band's own. The
  // detection raster, the local-background radii and every DET_LONG-relative gate (pill
  // size, score) are calibrated to a 720px-long full frame. If the band re-derived scale
  // from its own (now shorter) long side, a 720×640 band would upscale to ~720×640 detection
  // px — a LARGER, mis-calibrated raster that is both slower AND fails the size gates (a pill
  // that was 30px is now ~50px against a different DET_LONG). Passing the full-frame long side
  // makes the band's raster exactly the bottom slice of the full-frame raster: same pixel
  // density, same gates, just fewer rows → genuinely cheaper detection.
  const boxes = detectBoxes(band, Math.max(fw, fh));
  // Boxes come back in BAND coordinates; shift y (and only y — x/w/h/pillW/tilt are
  // unaffected by a vertical translation) back into full-frame space so the crop lands on
  // the pill. The moment-derived tilt and pillW are translation-invariant, so they carry
  // over directly.
  for (const b of boxes) b.y += bandY0;
  return boxes;
}

/** Run the full pill-detection pipeline on a canvas, returning boxes in THAT canvas's
 *  coordinates. findCodeBoxes calls this on either the whole frame or a bottom-band
 *  sub-canvas (then offsets y). `scaleLong` is the long side (px) the DET_LONG downscale is
 *  computed against — the band passes the FULL frame's long side so its detection raster,
 *  radii and size gates stay identical to a full-frame pass (only the row count shrinks).
 *  Defaults to the canvas's own max dimension (the full-frame call). */
function detectBoxes(frame: HTMLCanvasElement, scaleLong?: number): CodeBox[] {
  const fw = frame.width;
  const fh = frame.height;
  if (!fw || !fh) return [];

  const scale = DET_LONG / (scaleLong ?? Math.max(fw, fh));
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

  // Foreground = pixels darker than their local background (the dark pill stands out
  // from the card; the light text inside does not). The background radius is the catch:
  //  - a LARGE radius (≈ pill size or more) makes a small/far pill pop solid, but on a
  //    close-up pill the radius sits INSIDE the pill, so its dark interior raises the
  //    local mean and only the rim survives — the body goes hollow;
  //  - a SMALL radius makes a close-up pill solid, but a far pill next to a big dark
  //    neighbour (the FIFA "2026" logo) gets a contaminated, too-dark local mean and the
  //    body fails the threshold.
  // No single radius fits both a close-up and a held-at-arm's-length video pill, so we
  // run the component pass at EACH radius and merge by PRIORITY: the first (large,
  // long-proven for close-ups) radius wins, and a later radius only ADDS a pill in a
  // region the earlier one left empty. That way the finer radius can never replace a
  // close-up pill's clean segmentation with a worse, taller merge of itself — it only
  // rescues far/multi-up pills the coarse radius missed. The passes are linear and the
  // detection image is tiny, so the cost is negligible.
  let kept: CodeBox[] = [];
  for (const rFrac of DET_BG_RADII) {
    const pass: CodeBox[] = [];
    collectBoxes(gray, dw, dh, scale, Math.max(5, Math.round(DET_LONG * rFrac)), pass);
    pass.sort((a, b) => b.score - a.score);
    for (const b of nonMaxSuppress(pass, 0.3)) {
      if (kept.every((k) => iou(b, k) <= 0.3)) kept.push(b);
    }
  }
  kept.sort((a, b) => b.score - a.score);
  kept = kept.slice(0, 10);

  // Decide which boxes keep their de-rotation `tilt`. A box that isn't the real code pill,
  // de-rotated, tends to manufacture a clean-looking but spurious read (a stray blob → the
  // "00" logo; a digit cluster → a wrong code) — a false positive a trading app must never
  // produce. Two regimes, by how steep the correction is:
  //
  //  • NEAR-AXIS tilt (snaps to the 0°/90° turn, no resample): the long-proven, low-risk
  //    path. Keep it for every box that scores within TILT_SCORE_MARGIN of the best — flat
  //    multi-sticker frames have several real pills, all near-axis.
  //
  //  • STEEP diagonal tilt (a true resample): the risky one. In a tilted frame several
  //    non-pill regions (legal-text blocks, digit clusters) score as high as the pill, and
  //    a tiny fragment de-rotates into "7 00" → the "00" logo. A single hold has ONE real
  //    pill, and it's the LARGEST elongated blob — so we de-rotate only the single biggest
  //    candidate (max pillW), and only if it scores near the best large box. Tiny fragments
  //    and the smaller, contaminated re-segmentations of the same pill keep tilt=null and
  //    read through the safe axis path instead.
  const best = kept.length ? kept[0].score : 0;
  const maxPillW = kept.reduce((m, b) => Math.max(m, b.pillW), 0);
  const bestLarge = kept
    .filter((b) => b.pillW >= maxPillW * PILL_SIZE_RATIO)
    .reduce((s, b) => Math.max(s, b.score), 0);
  const out: CodeBox[] = [];
  for (const b of kept) {
    if (b.tilt !== null && isSteepTilt(b.tilt)) {
      // A box with a STEEP moment angle is only detectable BECAUSE the detector is rotation-
      // invariant — a flat frame would never surface it (its axis-aligned box is square). In a
      // tilted frame these are the real pill PLUS a litter of contaminants the same tilt makes
      // visible: the card's legal-text block, digit clusters, pill-fragment re-segmentations.
      // Only the single biggest, pill-scored blob is the real code; we de-rotate just that one
      // and DROP the other steep boxes entirely — left in, their tilted dense text OCRs into
      // stray codes ("STN 8" → SEN8) the matcher can't tell from a real read (a false positive).
      if (b.pillW < maxPillW - 1e-6 || b.score < bestLarge - TILT_SCORE_MARGIN) continue;
    } else if (b.tilt !== null && b.score < best - TILT_SCORE_MARGIN) {
      // Near-axis box too weak to be the pill: keep it (the safe axis path reads it) but don't
      // de-rotate — de-rotating a weak box invents false positives.
      b.tilt = null;
    }
    // The taller small-source target rescues a far PILL's thin strokes, but on a HOLLOW
    // stray "0" blob it sharpens the ring's two sides into a phantom "00". A real pill is
    // solid (fill ≥ ~0.6); the "0" blob is sparse (~0.54), so gate the boost on fill too.
    b.boost = b.score >= SMALL_BOOST_MIN_SCORE && b.fill >= BOOST_MIN_FILL;
    out.push(b);
  }
  return out;
}

/** A box is only de-rotated when its long axis is clearly elongated: l1/l2 must exceed
 *  this. A round mass has no trustworthy axis, and de-rotating it manufactures a clean
 *  but spurious read — the false positive a trading app must never produce. */
const TILT_MIN_ELONGATION = 2.2;

/** A box is only de-rotated if its score is within this margin of the frame's best box.
 *  Weaker boxes are rarely the real pill, and de-rotating them invents false positives. */
const TILT_SCORE_MARGIN = 0.08;

/** A box is only de-rotated if its pill body (short side) is at least this fraction of the
 *  largest detected candidate's. The real pill is the big elongated blob; the spurious
 *  near-top boxes a steep tilt creates are small fragments that de-rotate into stray-digit
 *  reads ("7 00" → the "00" logo false positive). */
const PILL_SIZE_RATIO = 0.5;

/** Canvas-clockwise rotation (degrees) that brings the pill's long axis horizontal, from
 *  the rotation-invariant moment shape. The moment angle is measured from +x; rotating
 *  the crop by -angle lays the text flat. Returns null when the component isn't clearly
 *  elongated (a round mass has no meaningful axis — de-rotating it invents a false
 *  read). The 180° ambiguity (text upright vs upside-down) is resolved at OCR time by
 *  also feeding the flip. The angle is scale-invariant, so the detection-space estimate
 *  applies directly to the full-frame crop. */
/** A tilt is "steep" (a true diagonal de-rotation that resamples) when it isn't within
 *  UPRIGHT_DEG of an axis (0° or ±90°). Near-axis crops snap to the cheap rotateCanvas
 *  turn (low risk); steep ones are restricted to the single biggest pill. */
function isSteepTilt(tilt: number): boolean {
  return Math.abs(tilt) >= UPRIGHT_DEG && Math.abs(Math.abs(tilt) - 90) >= UPRIGHT_DEG;
}

function deRotationAngle(shape: MomentShape): number | null {
  if (shape.l2 <= 0 || shape.l1 / shape.l2 < TILT_MIN_ELONGATION) return null;
  // Bring the long axis to horizontal: rotate the crop by the negated long-axis angle.
  let deg = -shape.angle;
  while (deg > 90) deg -= 180;
  while (deg <= -90) deg += 180;
  return deg;
}

/** Geometry gate + score for "is this the code pill?", from the ROTATION-INVARIANT
 *  moment shape (not the axis-aligned w×h, which goes square at a steep tilt and used to
 *  reject every steeply-rotated pill before OCR). Returns null if not a plausible pill.
 *  The real code pill ranks highest by score; we keep the top candidates and let the OCR
 *  + per-line matching reject any false positives. */
/** The card's legal-text block measures a longer, sparser rectangle than a real pill.
 *  A box that is BOTH this elongated AND this hollow is rejected as the legal block (the
 *  one contaminant rotation-invariant detection surfaces in a tilted frame). Real pills sit
 *  at AR ≤ ~3.2 / fill ≥ ~0.56, so they clear at least one side of this AND. */
const LEGAL_BLOCK_AR = 3.4;
const LEGAL_BLOCK_FILL = 0.6;

function scoreBox(shape: MomentShape): { score: number } | null {
  const { ar, fill, size, l2 } = shape;

  // Loose sanity gates. A real code pill measures AR≈2.4–3.2 and fill≈0.56–0.74 from
  // moments at ANY rotation (verified across the dataset; fill varies with framing).
  if (ar < 2.0 || ar > 6.0) return null; // pill is ~2.4–3.2:1
  if (fill < 0.35 || fill > 0.95) return null; // solid-ish blob with text holes
  if (size < DET_LONG * 0.03 || size > DET_LONG * 0.5) return null; // size sanity
  if (l2 < 2) return null; // short side too thin to be a pill body

  // The card's printed legal-text block is the one contaminant that mimics a pill's AR but
  // not its solidity: it measures a LONGER, SPARSER rectangle (AR ≳ 3.5, fill ≲ 0.6) than a
  // real pill (AR ≤ ~3.2, fill ≥ ~0.56). Rotation-invariant detection surfaces it in a tilted
  // frame (its axis box is square when flat, so a flat capture never saw it), where its tilted
  // dense text OCRs into stray codes ("STN 8" → SEN8) — a false positive. Reject that
  // long-and-sparse signature; a genuine pill clears either the AR or the fill side.
  if (ar > LEGAL_BLOCK_AR && fill < LEGAL_BLOCK_FILL) return null;

  // Score peaks at the real pill's measured shape: AR≈3.0 and fill≈0.72 (dataset). The fill
  // ideal matters — at the old 0.6 ideal a HOLLOW stray "0" blob (fill≈0.54) outscored the
  // solid pill (fill≈0.74) and stole the top spot, de-rotating into a phantom "00". Centring
  // on the real fill makes the solid pill the clear winner and drops the sparse blob below the
  // de-rotation margin.
  const arScore = 1 - Math.min(1, Math.abs(ar - 3.0) / 3);
  const fillScore = 1 - Math.min(1, Math.abs(fill - 0.72) / 0.4);
  return { score: arScore * 0.5 + fillScore * 0.5 };
}

/** Below this absolute de-rotation angle the crop is treated as already upright: no
 *  rotation resample is applied, so the crop can be SHARPENED (rescuing thin strokes the
 *  same way the long-proven axis path did) and read full-width without a band-tighten
 *  that can grab the wrong rows on a nearly-flat pill. A handheld lean this small reads
 *  fine upright, so correcting it only adds resample softening for no gain. Above it a
 *  real resample happens, a second sharpening would fragment the digits, and the
 *  axis-aligned bbox is now tall enough that we must tighten to the pill band. */
const UPRIGHT_DEG = 8;

/** Two raw OCR crops for a box, rotated upright by the pill's MOMENT angle but not yet
 *  prepared. The single moment-angle de-rotation brings the pill horizontal at ANY
 *  in-plane rotation (the rotation-invariant detector measures the angle even when the
 *  axis-aligned box is square); the 180° flip resolves the upright/upside-down ambiguity.
 *  When the box has no trustworthy axis (`tilt === null` — a round blob, or a box too
 *  weak to safely de-rotate) we fall back to the axis-aligned base + 180° flip.
 *
 *  Splitting this out lets the dev harness try alternative prep functions on the exact
 *  same raw crops the app uses. */
export function rawCropCandidates(frame: HTMLCanvasElement, box: CodeBox): HTMLCanvasElement[] {
  return rawCropGroups(frame, box).crops;
}

/** Build the two raw upright crops plus the flag telling prepForOcr whether to sharpen.
 *  A de-rotated crop (real resample) is NOT sharpened — the resample already softens it
 *  and a second sharpening fragments the digits (e.g. a tilted "CIV 12" breaks into
 *  "CIV" + "12"). An already-upright crop (no resample) IS sharpened to rescue thin
 *  strokes a soft capture washed out (the "I" in CIV, the "1" in 12). */
function rawCropGroups(
  frame: HTMLCanvasElement,
  box: CodeBox,
): { crops: HTMLCanvasElement[]; sharpen: boolean; despeckle: boolean } {
  // A little padding so the pill has a margin of card around it — the prep step
  // flood-clears that margin, which cleanly isolates the text.
  const region = cropRegion(frame, box, 0.18);

  // No trustworthy moment axis: fall back to the axis-aligned crop. 'h' is already
  // horizontal, 'v' needs a 90° turn. Sharpened, like the long-proven axis path.
  if (box.tilt === null) {
    const base = rotateCanvas(region, box.orient === 'h' ? 0 : 90);
    return { crops: [base, rotateCanvas(base, 180)], sharpen: true, despeckle: false };
  }

  // Snap a near-right-angle moment angle to the exact 0/90 turn: that rotation does NOT
  // resample (so the crop can be sharpened to rescue thin strokes, exactly like the old
  // axis path) and the pill already fills its bbox, so no band-tighten is needed. A handheld
  // lean below UPRIGHT_DEG reads fine upright, so we don't correct it.
  const deg = box.tilt;
  const nearUpright = Math.abs(deg) < UPRIGHT_DEG;
  const nearQuarter = Math.abs(Math.abs(deg) - 90) < UPRIGHT_DEG;
  if (nearUpright || nearQuarter) {
    const base = rotateCanvas(region, nearQuarter ? 90 : 0);
    return { crops: [base, rotateCanvas(base, 180)], sharpen: true, despeckle: false };
  }

  // Genuinely diagonal pill: de-rotate the WHOLE padded region by the moment angle so the
  // pill lands horizontal. Its axis-aligned bbox is square and full of empty card, so after
  // rotation the (now horizontal) text sits in a canvas with big margins; prepForOcr scales
  // by the FULL crop height, which would shrink the text band too far. Since the rotation is
  // about the CENTRE, the pill is a horizontal strip ~pillW tall through the middle — so we
  // crop that centred strip directly. This is far more reliable than searching the de-rotated
  // square for a dark band, which can grab the card's off-centre legal-text block (a false
  // read). resample already softens the crop, so the band would otherwise need its own care.
  // Despeckle the binarized crop: the de-rotation leaves a stray pill-end speck that derails
  // Tesseract's segmentation into a wrong-code false positive.
  const rotated = cropCenterStrip(rotateCanvasDeg(region, deg), box.pillW);
  return { crops: [rotated, rotateCanvas(rotated, 180)], sharpen: true, despeckle: true };
}

/** Crop a de-rotated canvas to a CENTRED horizontal strip tall enough to hold the pill
 *  (`pillH` px) plus a glyph margin. The crop was rotated about its centre, so the pill
 *  sits across the middle; a centred strip isolates it without picking up the card's
 *  off-centre text. Full width is kept so the whole code stays in view. */
function cropCenterStrip(src: HTMLCanvasElement, pillH: number): HTMLCanvasElement {
  const w = src.width;
  const h = src.height;
  if (w < 8 || h < 8 || pillH <= 0) return src;
  // Keep the strip close to the pill height (just a small quiet margin each side for the
  // border-flood) so the text BAND dominates the crop. prepForOcr upscales by the FULL crop
  // height, so an over-tall strip would shrink the text — at which the thin "1" in "CIV 12"
  // washes out and the read drops to "CIV2" (a real but WRONG code). ~1.4× brackets the
  // glyphs with a thin margin while keeping them large.
  const strip = Math.min(h, Math.round(pillH * 1.4));
  if (strip >= h) return src;
  const y0 = Math.max(0, Math.round((h - strip) / 2));
  const bh = Math.min(h - y0, strip);

  const out = document.createElement('canvas');
  out.width = w;
  out.height = bh;
  const octx = out.getContext('2d', { willReadFrequently: true });
  if (!octx) return src;
  octx.drawImage(src, 0, y0, w, bh, 0, 0, w, bh);
  return out;
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

  // A pill row is one with a meaningful run of dark pixels. The crop was de-rotated about
  // its CENTRE, so the pill body is the dark band straddling the centre row — NOT
  // necessarily the tallest band (a square crop of a steeply-tilted pill also catches the
  // card's legal-text block off-centre, which can be taller). So prefer the band covering
  // the centre; fall back to the tallest only if no band reaches the centre.
  const rowMin = w * 0.12;
  const centre = h / 2;
  let centreStart = -1;
  let centreLen = 0;
  let tallStart = -1;
  let tallLen = 0;
  let curStart = -1;
  for (let y = 0; y <= h; y++) {
    const on = y < h && rowDark[y] >= rowMin;
    if (on && curStart < 0) curStart = y;
    if (!on && curStart >= 0) {
      const len = y - curStart;
      if (len > tallLen) {
        tallLen = len;
        tallStart = curStart;
      }
      if (curStart <= centre && y > centre && len > centreLen) {
        centreLen = len;
        centreStart = curStart;
      }
      curStart = -1;
    }
  }
  const bestStart = centreStart >= 0 ? centreStart : tallStart;
  const bestLen = centreStart >= 0 ? centreLen : tallLen;
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
  const { crops, sharpen, despeckle } = rawCropGroups(frame, box);
  // box.boost (set in findCodeBoxes) gates the taller small-source target: it rescues a
  // far/tiny PILL's thin strokes but sharpens a stray blob's dots into a phantom "00", so
  // only a pill-sized, pill-scored box gets it.
  return crops.map((c) => prepForOcr(c, sharpen, box.boost, despeckle));
}

/** Lazy form of codeCropCandidates: extracts the RAW crops once (cheap rotations) but DEFERS
 *  the expensive prepForOcr (upscale + binarize + border-flood) to build(i). The live read
 *  resolves on the upright crop (variant 0) the vast majority of the time, so the 180°-flip's
 *  prep — the dominant per-frame cost once OCR itself is cheap — is never spent on those
 *  frames. build(i) is byte-identical to codeCropCandidates()[i]; this only changes WHEN the
 *  work happens, never WHAT is produced, so recall and the 0-FP guarantee are unaffected. */
export function codeCropSource(
  frame: HTMLCanvasElement,
  box: CodeBox,
): { count: number; build: (i: number) => HTMLCanvasElement } {
  const { crops, sharpen, despeckle } = rawCropGroups(frame, box);
  return {
    count: crops.length,
    build: (i) => prepForOcr(crops[i], sharpen, box.boost, despeckle),
  };
}

/** Share of ink (black) pixels in a PREPARED crop below which it can't hold a code: after
 *  the border-flood and sparse-ink gate, a blanked dense crop (legal text/photo) has ~0 ink
 *  and an empty card crop near 0. A real 4–6 glyph code covers a small but non-trivial share.
 *  Crops below this carry no glyph and are skipped before OCR — pure saved dispatch on the
 *  majority of frames that hold no readable pill (the sparse-ink gate already blanked the
 *  too-DENSE crops to all-white, so this lower bound catches both empty and gated crops). */
const MIN_OCR_INK_FRACTION = 0.004;

/** True when a prepared (binarized, ink=0 on white=255) crop carries enough ink to possibly
 *  be a code — i.e. it's worth an OCR call. A blank/near-blank crop (empty card, or a dense
 *  crop the sparse-ink gate already blanked) can only ever OCR to nothing, so the recognizer
 *  skips it and saves the dispatch. Never widens what's read: a crop with real glyphs always
 *  clears this. */
export function cropHasOcrInk(crop: HTMLCanvasElement): boolean {
  const w = crop.width;
  const h = crop.height;
  if (w < 4 || h < 4) return false;
  const ctx = crop.getContext('2d', { willReadFrequently: true });
  if (!ctx) return true; // can't inspect → be safe and OCR it
  const d = ctx.getImageData(0, 0, w, h).data;
  let ink = 0;
  // Prepared crops are pure black/white; testing the red channel is enough.
  for (let i = 0; i < d.length; i += 4) if (d[i] < 128) ink++;
  return ink >= w * h * MIN_OCR_INK_FRACTION;
}

/** A box must score at least this to receive the taller small-source OCR target. Real
 *  code pills score ≥0.85; a spurious logo-blob box scores ~0.58, and boosting it turns
 *  its round blobs into a false "00". */
const SMALL_BOOST_MIN_SCORE = 0.68;
/** ...and its body must be at least this solid. A hollow stray "0"/ring blob boosted turns
 *  its two sides into a phantom "00"; a real code pill is solid (fill ≈ 0.72 from moments).
 *  Held at 0.6 (not the tighter 0.7): far/small pills caught only by the second, smaller
 *  DET_BG_RADII pass land a touch hollower after downscale, and 0.7 dropped them — which is
 *  exactly the recall the real-life video frames depend on (0→4 of 6). The phantom-"00" risk
 *  the tighter line guarded against never materialized: the benchmark holds 0 false positives
 *  at 0.6, and the conservative matcher only ever resolves to a real checklist code anyway. */
const BOOST_MIN_FILL = 0.6;

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
/** Taller target for a SMALL source crop (a far/multi-sticker pill only tens of px
 *  tall). At 96px such a pill's "1"/"I" wash out — "CIV 12" reads "CV"; at 160px the
 *  same crop reads "CV12", which the matcher restores to CIV12. Applied ONLY when the
 *  source is short: a close-up pill is already ~100–130px tall, so it keeps the 96
 *  target and its noise behaviour (a bigger upscale of a noisy close-up manufactured a
 *  false positive). */
const TARGET_H_SMALL = 160;
/** Source crops shorter than this (px) are "small" and get TARGET_H_SMALL. Chosen
 *  between the multi-photo pills (raw height ~27–44px) and the close-up pills (~100px+). */
const SMALL_SRC_H = 64;
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
function prepForOcr(
  src: HTMLCanvasElement,
  sharpen: boolean,
  boostSmall = true,
  despeckle = false,
): HTMLCanvasElement {
  const sh = src.height || 1;
  const target = boostSmall && sh < SMALL_SRC_H ? TARGET_H_SMALL : TARGET_H;
  const factor = Math.max(1, target / sh);
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
    const usRadius = Math.max(1, Math.round(target * 0.04));
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

  // Despeckle (de-rotated crops only): clear ink blobs far too small to be a glyph. A
  // de-rotated crop of a steep pill keeps a stray speck (a rounded pill-end remnant) beside
  // the code; left in, it throws Tesseract's segmentation off so the leading "C" reads "G"
  // and the code snaps to a wrong real code ("CIV 12" → "GIV2" → CIV2, a false positive).
  // Glyphs are large after the upscale, so a generous min-area removes only specks. The axis
  // path skips this so its sharpened thin strokes are never touched.
  if (despeckle) removeSmallInkBlobs(bin, cw, ch, Math.max(4, Math.round(ch * ch * 0.005)));

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

/** Clear every connected ink (0) component smaller than `minArea` pixels (4-connected),
 *  leaving the glyphs. A flood fill per unvisited ink pixel: collect the component, and if
 *  it's a speck, white it out. Glyphs survive (they're far larger after the upscale). */
function removeSmallInkBlobs(bin: Uint8Array, w: number, h: number, minArea: number): void {
  const n = w * h;
  const seen = new Uint8Array(n);
  const stack = new Int32Array(n);
  const comp = new Int32Array(n);
  for (let start = 0; start < n; start++) {
    if (bin[start] !== 0 || seen[start]) continue;
    let sp = 0;
    let c = 0;
    stack[sp++] = start;
    seen[start] = 1;
    while (sp > 0) {
      const i = stack[--sp];
      comp[c++] = i;
      const x = i % w;
      const y = (i / w) | 0;
      if (x > 0 && bin[i - 1] === 0 && !seen[i - 1]) ((seen[i - 1] = 1), (stack[sp++] = i - 1));
      if (x < w - 1 && bin[i + 1] === 0 && !seen[i + 1]) ((seen[i + 1] = 1), (stack[sp++] = i + 1));
      if (y > 0 && bin[i - w] === 0 && !seen[i - w]) ((seen[i - w] = 1), (stack[sp++] = i - w));
      if (y < h - 1 && bin[i + w] === 0 && !seen[i + w]) ((seen[i + w] = 1), (stack[sp++] = i + w));
    }
    if (c < minArea) for (let k = 0; k < c; k++) bin[comp[k]] = 255;
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
