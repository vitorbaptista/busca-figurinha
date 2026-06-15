// Pure-JS feature-vector glyph OCR engine — a drop-in OcrEngine (src/types.ts) that
// replaces tesseract.js for this one constrained task: reading a Panini back code (a
// bold condensed FIFA stem + number) off the PREPARED crop locate.ts hands us.
//
// Pipeline per crop:
//   1. segment the binary crop into ordered glyph boxes (glyphFeatures.extractGlyphs);
//   2. classify each glyph by NEAREST-NEIGHBOUR cosine against the rendered atlas
//      (glyphAtlas) — a translation/scale-normalized feature vector, more robust to the
//      font mismatch + video blur than raw-pixel NCC;
//   3. assemble the glyph labels into a token, using the code's known LETTERS-then-DIGITS
//      structure to break O/0, I/1, S/5, B/8 ties the right way;
//   4. emit that text + a confidence from the mean glyph match score.
//
// The matcher (bestMatchFromText) stays the conservative one downstream — it only ever
// snaps to a REAL checklist code (Levenshtein ≤ 1 + thin-letter recovery) or rejects —
// so this recognizer only has to get glyphs APPROXIMATELY right. Its job on NOISE crops
// is to emit GARBAGE (not a plausible wrong code), which the matcher then rejects: that
// is what preserves 0 false positives.

import type { OcrEngine, OcrResult } from '../types';
import { extractGlyphs, FEAT_LEN, type GlyphBox } from './glyphFeatures';
import { buildAtlas } from './glyphAtlas';

/** The atlas packed for a fast nearest-neighbour scan: every template's feature vector
 *  concatenated into ONE Float32Array (cache-friendly, no per-template object hop), with
 *  parallel label-class arrays. Classification is then a tight dot-product loop. Built
 *  once at init() from buildAtlas(). */
interface FlatAtlas {
  /** count × FEAT_LEN, row-major. */
  feats: Float32Array;
  count: number;
  /** Per-template: 1 if the label is a DIGIT, else 0. */
  isDigit: Uint8Array;
  /** Per-template label char. */
  labels: string[];
}

function flatten(): FlatAtlas {
  const templates = buildAtlas();
  const count = templates.length;
  const feats = new Float32Array(count * FEAT_LEN);
  const isDigit = new Uint8Array(count);
  const labels: string[] = new Array(count);
  for (let t = 0; t < count; t++) {
    feats.set(templates[t].feat, t * FEAT_LEN);
    const lab = templates[t].label;
    labels[t] = lab;
    isDigit[t] = lab >= '0' && lab <= '9' ? 1 : 0;
  }
  return { feats, count, isDigit, labels };
}

/** Digits that look identical to a letter in this font; in the LETTER run we coerce a
 *  digit winner back to its letter twin (a glyph in the letter run can't be a digit). */
const DIGIT_TO_LETTER: Record<string, string> = { '0': 'O', '1': 'I', '2': 'Z', '5': 'S', '8': 'B', '6': 'G' };
const DIGITS = new Set('0123456789'.split(''));

/** A classified glyph: its best label, the best-in-class letter/digit, and the
 *  runner-up DIGIT score — enough to apply the letters-then-digits structural prior and
 *  the digit-ambiguity FP gate without re-scanning the atlas. */
interface Classified {
  label: string;
  score: number;
  /** Best score restricted to LETTER classes / DIGIT classes — lets the structural pass
   *  pick the best-in-class without losing accuracy to a cross-class tie. */
  bestLetter: { label: string; score: number };
  bestDigit: { label: string; score: number };
  /** Best score among DIGIT classes OTHER than bestDigit.label — the margin
   *  bestDigit.score − this is how decisively the digit reading wins. A small margin
   *  means a 4-vs-6-style ambiguity that we must NOT commit (it would be a wrong code). */
  secondDigitScore: number;
}

/** Classify one glyph against the flat atlas: a tight dot-product NN that tracks the best
 *  overall, best LETTER, best DIGIT, and 2nd-best DIGIT (for the structural prior + the
 *  digit-ambiguity FP gate). Both glyph feature and atlas templates are L2-normalized, so
 *  the dot product IS the cosine. The atlas feats are one flat Float32Array, so this is a
 *  cache-friendly inner loop — fast enough that the engine needs no worker/wasm. */
function classify(glyph: GlyphBox, atlas: FlatAtlas): Classified {
  const { feats, count, isDigit, labels } = atlas;
  const feat = glyph.feat;
  let bestLabel = '?';
  let best = -1;
  let bl = '?';
  let bls = -1;
  let bd = '?';
  let bds = -1;
  let bd2 = -1; // 2nd-best digit score (different label from bd)
  let off = 0;
  for (let t = 0; t < count; t++) {
    let s = 0;
    for (let i = 0; i < FEAT_LEN; i++) s += feat[i] * feats[off + i];
    off += FEAT_LEN;
    if (s > best) {
      best = s;
      bestLabel = labels[t];
    }
    const lab = labels[t];
    if (isDigit[t]) {
      if (s > bds) {
        if (bd !== lab) bd2 = bds; // demote the old best (if a different digit) to 2nd
        bds = s;
        bd = lab;
      } else if (lab !== bd && s > bd2) {
        bd2 = s;
      }
    } else if (s > bls) {
      bls = s;
      bl = lab;
    }
  }
  return {
    label: bestLabel,
    score: best,
    bestLetter: { label: bl, score: bls },
    bestDigit: { label: bd, score: bds },
    secondDigitScore: bd2,
  };
}

/** A digit is COMMITTED only if it's decisive: either it beats the runner-up digit by at
 *  least DIGIT_MARGIN, OR it's a near-exact template match (≥ DIGIT_STRONG). Otherwise it
 *  is the kind of 4-vs-5 / 2-vs-4 drift that turns EGY4 into the real-but-wrong EGY5 — so
 *  we REJECT THE WHOLE CROP (a miss), never commit a borderline digit. A miss is
 *  acceptable for a trading app; a confidently-wrong code is not. The two clauses cover
 *  the two good regimes: a clean close-up digit self-matches an in-font template at ≈1.0
 *  (strong clause), while a softer-but-clear digit wins its class by a wide margin. A
 *  genuinely ambiguous digit satisfies neither and is dropped. */
const DIGIT_MARGIN = 0.05;
const DIGIT_STRONG = 0.97;

/** A committed glyph must classify at least this well. A whole crop of card texture or a
 *  logo fragment scores below this on most glyphs; emitting '#' for them makes the token
 *  un-matchable (the second FP guard, alongside DIGIT_MARGIN). */
const MIN_GLYPH_COS = 0.7;

/**
 * Resolve the per-glyph labels into a code token using the structure "letters then
 * digits". We DON'T hard-split — we find the boundary that best fits each glyph's
 * in-class scores, then coerce ambiguous glyphs (O/0, I/1, …) to the side of the
 * boundary they fall on. A glyph whose best score is JUNK, or a DIGIT whose reading is
 * ambiguous (a 4-vs-6 near-tie), is emitted as a non-code char so the matcher rejects
 * the token — the false-positive guard. A MISS is acceptable; a wrong code is not.
 */
function assemble(classified: Classified[]): { text: string; conf: number; reject: boolean } {
  const n = classified.length;
  if (n === 0) return { text: '', conf: 0, reject: true };

  // Choose a split point k: glyphs [0,k) are letters, [k,n) are digits. Score each split
  // by the total in-class confidence and pick the best. Codes are 2–4 letters + 1–3
  // digits, so k ∈ [1, n-1] in the common case, but we allow the extremes too (a lone
  // "00" logo, or an all-letter misfire that the matcher will reject anyway).
  let bestK = n;
  let bestSum = -Infinity;
  for (let k = 0; k <= n; k++) {
    let sum = 0;
    for (let i = 0; i < n; i++) {
      sum += i < k ? classified[i].bestLetter.score : classified[i].bestDigit.score;
    }
    // Gentle prior toward 2–4 letters then 1–3 digits (the real code shape).
    const letters = k;
    const digits = n - k;
    if (letters >= 2 && letters <= 4 && digits >= 1 && digits <= 3) sum += 0.04;
    if (sum > bestSum) {
      bestSum = sum;
      bestK = k;
    }
  }

  // Build the token, tracking a WHOLE-CROP reject. A single garbled/ambiguous glyph
  // can't just be dropped — the surviving prefix can be a DIFFERENT valid code (a
  // misread "CIV12" → "CIV1?" → the real code CIV1, a false positive). So any glyph that
  // fails the confidence floor, OR any DIGIT whose runner-up is within DIGIT_MARGIN
  // (the 4-vs-6 ambiguity that makes EGY4 read EGY6), rejects the ENTIRE crop → a MISS.
  // Misses are acceptable; confidently-wrong codes are not.
  let text = '';
  let confSum = 0;
  let reject = false;
  for (let i = 0; i < n; i++) {
    const c = classified[i];
    const wantDigit = i >= bestK;
    let ch = c.label;
    let sc = c.score;
    if (wantDigit) {
      ch = c.bestDigit.label;
      sc = c.bestDigit.score;
      const decisive =
        c.bestDigit.score - c.secondDigitScore >= DIGIT_MARGIN || c.bestDigit.score >= DIGIT_STRONG;
      if (!decisive) reject = true;
    } else if (DIGITS.has(ch) && DIGIT_TO_LETTER[ch]) {
      ch = DIGIT_TO_LETTER[ch];
    } else if (DIGITS.has(ch)) {
      if (c.bestLetter.score > c.score - 0.08) {
        ch = c.bestLetter.label;
        sc = c.bestLetter.score;
      }
    }
    // A glyph that doesn't classify confidently in EITHER class is noise → reject.
    if (Math.max(c.bestLetter.score, c.bestDigit.score) < MIN_GLYPH_COS) reject = true;
    text += ch;
    confSum += sc;
  }

  // Insert a space at the letter/digit boundary so the token reads like "CIV 12".
  if (bestK > 0 && bestK < n) text = text.slice(0, bestK) + ' ' + text.slice(bestK);

  return { text, conf: (confSum / n) * 100, reject };
}

/** A rejected read still has to be NON-EMPTY and contain a letter — otherwise
 *  recognizeFrameInOrder treats the crop as "no glyph" and skips the box's 180°-flip
 *  round. The flip is exactly what rescues the upside-down case: an inverted "4" reads as
 *  the real-but-wrong "5" (rejected here), and only the flip crop reads the true "4". So
 *  on reject we return the letter stem with the digits blanked to 'X' — alphanumeric
 *  enough to keep the flip alive, but no `\d`, so extractCodes finds no token and it can
 *  never match a real code. */
function rejectSentinel(text: string): string {
  const s = text.replace(/\d/g, 'X');
  return /[A-Z]/.test(s) ? s : 'X';
}

/** Recognize a single prepared crop into an OcrResult. */
function recognizeCrop(crop: HTMLCanvasElement, atlas: FlatAtlas): OcrResult {
  const glyphs = extractGlyphs(crop);
  // A code is 3–7 glyphs. Too few = noise/blank; too many = legal text the gate missed.
  if (glyphs.length < 2 || glyphs.length > 8) return { text: '', confidence: 0 };
  const classified = glyphs.map((g) => classify(g, atlas));
  const { text, conf, reject } = assemble(classified);
  if (reject) return { text: rejectSentinel(text), confidence: 0 };
  return { text, confidence: conf };
}

/**
 * Build the pure-JS glyph OCR engine. init() renders the atlas once (browser canvas);
 * recognize/recognizeMany run the classifier synchronously (it's microsecond-cheap per
 * crop), wrapped in Promises to satisfy the async OcrEngine contract. terminate() drops
 * the atlas. No workers, no wasm, no network — ideal for the offline low-end PWA.
 */
export function createGlyphOcrEngine(): OcrEngine {
  let atlas: FlatAtlas | null = null;

  return {
    async init(onProgress) {
      if (!atlas) atlas = flatten();
      onProgress?.(1);
    },

    async recognize(source) {
      if (!atlas) atlas = flatten();
      return recognizeCrop(source, atlas);
    },

    async recognizeMany(sources) {
      if (!atlas) atlas = flatten();
      const a = atlas;
      return sources.map((s) => recognizeCrop(s, a));
    },

    async terminate() {
      atlas = null;
    },
  };
}
