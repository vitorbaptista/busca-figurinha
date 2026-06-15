// Rendered glyph atlas for the pure-JS classifier. We RENDER every one of the 36
// classes (A–Z, 0–9) into the SAME feature space the crops use (glyphFeatures), in
// several bold/condensed font variants plus synthetic degradations, so the
// nearest-neighbour matcher has full coverage of all 36 classes even for codes whose
// letters never appear in the dataset (the prior attempt's overfitting failure — it
// harvested only CIV/EGY glyphs and then missed RSA17). Rendering happens once at
// engine init() in the browser (canvas .fillText); both the live app and the headless
// bench run in a browser, so the atlas is identical in both.
//
// Why a font stack, not one font: the Panini back code is a bold CONDENSED sans. No
// single system font is guaranteed on every phone, so we render a STACK — condensed
// families where present, with a guaranteed bold sans-serif fallback — and keep every
// variant as its own template. The matcher only needs glyphs approximately right; the
// conservative checklist matcher (bestMatchFromText) corrects the near-misses.

import { glyphFeature, segmentBoxes, cropToMask, FEAT_LEN, type GlyphBox } from './glyphFeatures';
import { REAL_LABELS, REAL_FEATS_Q, REAL_FEAT_LEN } from './glyphAtlasReal';

export const CLASSES = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

/** Whether to blend the real harvested in-font templates into the atlas. The rendered
 *  atlas alone covers all 36 classes (mandatory generalization); the real templates are
 *  an accuracy boost for the seen classes. */
const BLEND_REAL = true;

/** One atlas template: a class label + its feature vector. */
export interface Template {
  label: string;
  feat: Float32Array;
}

/** Font stacks to render the atlas in. Each entry is a CSS font-family value; the
 *  browser falls back along it. We render in the few families that ACTUALLY produce
 *  distinct shapes (measured: most condensed names collapse to one system fallback, so
 *  rendering all of them just bloats the NN with duplicates and slows classification).
 *  Three suffice: a narrow/condensed fallback (closest to the Panini font), a true Noto
 *  Condensed, and a guaranteed bold sans-serif — together they bracket the real font's
 *  width, which is what the NN needs. */
const FONT_STACKS = [
  '"Arial Narrow", "Liberation Sans Narrow", "Roboto Condensed", sans-serif',
  '"Noto Sans Condensed", "Roboto Condensed", sans-serif',
  'sans-serif',
];

/** Render one glyph centered on a white canvas, ink=black, then return its tight ink
 *  mask via the same path crops take. blurPx adds the soft variant; skew/rot add the
 *  geometric variants that make the atlas robust to the handheld lean + perspective the
 *  bench augments and a real phone introduces (a skewed "4" matched a "5" template
 *  before — skewed "4" templates fix that without touching any test data). */
function renderGlyph(
  ch: string,
  family: string,
  weight: number,
  blurPx: number,
  skew: number,
  rot: number,
): HTMLCanvasElement {
  const S = 64;
  const c = document.createElement('canvas');
  c.width = S;
  c.height = S;
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, S, S);
  ctx.fillStyle = '#000';
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';
  if (blurPx > 0) ctx.filter = `blur(${blurPx}px)`;
  ctx.translate(S / 2, S / 2);
  if (rot !== 0) ctx.rotate((rot * Math.PI) / 180);
  if (skew !== 0) ctx.transform(1, 0, skew, 1, 0, 0);
  // Size chosen so a tall glyph fills most of the box without clipping.
  ctx.font = `${weight} 46px ${family}`;
  ctx.fillText(ch, 0, 2);
  ctx.filter = 'none';
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  return c;
}

/** Binarize a rendered (possibly blurred, thus gray) glyph canvas to a 1-bit ink mask
 *  on white, matching the prepared-crop format the classifier expects. */
function binarizeRender(c: HTMLCanvasElement): HTMLCanvasElement {
  const w = c.width;
  const h = c.height;
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const v = d[i] < 160 ? 0 : 255; // ink where darkened
    d[i] = d[i + 1] = d[i + 2] = v;
    d[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

/** Featurize a rendered glyph exactly like a crop glyph: segment to its tight box, take
 *  the largest component, and run glyphFeature. Returns null if nothing rendered (a
 *  glyph the font lacks — never happens for A–Z/0–9 with a sans-serif fallback). */
function featurizeRender(c: HTMLCanvasElement): Float32Array | null {
  const { mask, w, h } = cropToMask(c);
  const boxes = segmentBoxes(mask, w, h);
  if (boxes.length === 0) return null;
  // The glyph is the largest box (segmentBoxes already dropped specks).
  let best = boxes[0];
  for (const b of boxes) if (b.area > best.area) best = b;
  return glyphFeature(mask, w, best);
}

/** Build the full atlas: every class × every font stack × a few degradations. Runs once
 *  at init(). Cost is tiny (≈36×5×3 small canvas renders) and front-loaded off the hot
 *  path. */
export function buildAtlas(): Template[] {
  const templates: Template[] = [];
  // (weight, blur, skew, rot) variants. Weight/blur cover the ink-weight + soft-capture
  // range; skew/rot cover the handheld lean + perspective the bench augments (and a real
  // phone introduces) AFTER locate.ts has de-rotated the pill to roughly upright — so a
  // few degrees of residual lean and a mild shear, both signs, is what we model. Keeping
  // every variant as its own template lets NN pick the closest pose, which is what makes
  // a skewed "4" match a "4" template instead of drifting onto "5".
  const variants: Array<{ weight: number; blur: number; skew: number; rot: number }> = [
    { weight: 700, blur: 0, skew: 0, rot: 0 },
    { weight: 900, blur: 0, skew: 0, rot: 0 },
    { weight: 700, blur: 1.2, skew: 0, rot: 0 },
    { weight: 900, blur: 1.6, skew: 0, rot: 0 },
  ];
  // Extra POSE variants (skew + small rotation) — added for DIGITS only. The number is the
  // fragile, false-positive-prone part (a leaning "4" drifted onto a "5" template, turning
  // EGY4 into the real code EGY5); pose templates anchor each digit to itself across the
  // handheld lean/perspective the bench augments. We DON'T add these for letters: there the
  // extra poses muddied the soft-video letter reads (G/Y) without a matching FP payoff.
  const digitPoses: Array<{ skew: number; rot: number }> = [
    { skew: 0.18, rot: 0 },
    { skew: -0.18, rot: 0 },
    { skew: 0, rot: 10 },
    { skew: 0, rot: -10 },
  ];
  for (const ch of CLASSES) {
    const isDigit = ch >= '0' && ch <= '9';
    for (const family of FONT_STACKS) {
      for (const v of variants) {
        const rendered = binarizeRender(renderGlyph(ch, family, v.weight, v.blur, v.skew, v.rot));
        const feat = featurizeRender(rendered);
        if (feat && feat.length === FEAT_LEN) templates.push({ label: ch, feat });
      }
      if (isDigit) {
        for (const p of digitPoses) {
          const rendered = binarizeRender(renderGlyph(ch, family, 800, 0.5, p.skew, p.rot));
          const feat = featurizeRender(rendered);
          if (feat && feat.length === FEAT_LEN) templates.push({ label: ch, feat });
        }
      }
    }
  }
  // Blend in the real harvested templates (in-font samples for the classes that appear in
  // the dataset). They re-normalize from int8 storage. The rendered loop above already
  // covers all 36 classes, so unseen-class codes never depend on these.
  if (BLEND_REAL && REAL_FEAT_LEN === FEAT_LEN) {
    for (let t = 0; t < REAL_LABELS.length; t++) {
      const feat = new Float32Array(FEAT_LEN);
      let norm = 0;
      for (let i = 0; i < FEAT_LEN; i++) {
        const v = REAL_FEATS_Q[t * FEAT_LEN + i] / 127;
        feat[i] = v;
        norm += v * v;
      }
      norm = Math.sqrt(norm) || 1;
      for (let i = 0; i < FEAT_LEN; i++) feat[i] /= norm;
      templates.push({ label: REAL_LABELS[t], feat });
    }
  }
  return templates;
}

/** A real harvested glyph, added to the atlas as an extra template for the classes that
 *  DO appear in the dataset (rendered coverage of all 36 stays mandatory). */
export function harvestTemplate(label: string, glyph: GlyphBox): Template {
  return { label, feat: glyph.feat };
}
