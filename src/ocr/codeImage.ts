// Shared contract for the neural code recognizer (codeNet): how a located crop becomes the
// model's input tensor, and the alphabet. Used by BOTH the offline training-data generator
// (src/dev/trainData.ts) and the in-browser inference engine (src/ocr/codeNetEngine.ts) so
// they can never drift. Pure canvas + typed-array work, no ML deps.
//
// The recognizer reads the RAW de-rotated grayscale crop — NOT the otsu-binarized prepForOcr
// output. That is the whole point: otsu shatters the low-contrast pills (faint light text on a
// dark pill never separates), but a CNN reads the faint text straight from grayscale. We only
// letterbox to a fixed size and normalize; the CNN learns the light-text-on-dark-pill polarity.

// 128×32 (4:1, matching the wide code aspect): small enough to train + infer fast on CPU/low-end
// phones, large enough that the bold condensed glyphs stay legible after letterboxing.
export const INPUT_W = 128;
export const INPUT_H = 32;
/** A-Z then 0-9; index 36 is the CTC blank (kept implicit — decoders treat 36 as blank). */
export const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
export const BLANK = ALPHABET.length; // 36
export const NUM_CLASSES = ALPHABET.length + 1; // 37

/** Grayscale a canvas into a Uint8Array (row-major, w*h). */
function grayscaleOf(src: HTMLCanvasElement): { gray: Uint8Array; w: number; h: number } {
  const w = src.width;
  const h = src.height;
  const ctx = src.getContext('2d', { willReadFrequently: true })!;
  const d = ctx.getImageData(0, 0, w, h).data;
  const gray = new Uint8Array(w * h);
  for (let i = 0, p = 0; i < d.length; i += 4, p++) {
    gray[p] = (d[i] * 77 + d[i + 1] * 150 + d[i + 2] * 29) >> 8;
  }
  return { gray, w, h };
}

/** Mean gray of the 1px border of a (gray,w,h) image — the letterbox pad value, so the pad
 *  blends with the crop's background (a dark pill stays dark, not a fake bright bar). */
function borderMean(gray: Uint8Array, w: number, h: number): number {
  let sum = 0;
  let n = 0;
  for (let x = 0; x < w; x++) {
    sum += gray[x] + gray[(h - 1) * w + x];
    n += 2;
  }
  for (let y = 0; y < h; y++) {
    sum += gray[y * w] + gray[y * w + (w - 1)];
    n += 2;
  }
  return n ? Math.round(sum / n) : 0;
}

/**
 * Letterbox a crop to a fixed INPUT_W×INPUT_H grayscale buffer: scale-to-fit preserving aspect,
 * centered, padded with the crop's border-mean gray. Returns row-major Uint8 (w*h), values 0..255.
 */
export function letterboxGray(src: HTMLCanvasElement): Uint8Array {
  const { gray, w, h } = grayscaleOf(src);
  const pad = borderMean(gray, w, h);
  const out = new Uint8Array(INPUT_W * INPUT_H).fill(pad);
  if (w < 1 || h < 1) return out;
  const scale = Math.min(INPUT_W / w, INPUT_H / h);
  const dw = Math.max(1, Math.round(w * scale));
  const dh = Math.max(1, Math.round(h * scale));
  const ox = (INPUT_W - dw) >> 1;
  const oy = (INPUT_H - dh) >> 1;
  // Nearest-neighbour resample from src grayscale into the centered box.
  for (let y = 0; y < dh; y++) {
    const sy = Math.min(h - 1, (y / scale) | 0);
    const drow = (oy + y) * INPUT_W + ox;
    const srow = sy * w;
    for (let x = 0; x < dw; x++) {
      out[drow + x] = gray[srow + Math.min(w - 1, (x / scale) | 0)];
    }
  }
  return out;
}

/** Normalize a letterboxed Uint8 buffer into the model's Float32 input (range 0..1, row-major
 *  HxW, single channel). The CNN learns polarity, so we feed raw normalized gray (no inversion). */
export function toFloatInput(buf: Uint8Array): Float32Array {
  const f = new Float32Array(buf.length);
  for (let i = 0; i < buf.length; i++) f[i] = buf[i] / 255;
  return f;
}
