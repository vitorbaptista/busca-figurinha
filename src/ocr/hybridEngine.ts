// Hybrid OCR engine: the FAST pure-JS glyph matcher (glyphEngine) with a tesseract.js
// SAFETY NET. It exists because of how the app is actually used — phone flat on the table,
// one sticker shown CLOSE and held steady under the near-focus lock — which yields SHARP
// pills the glyph matcher reads correctly in microseconds. Tesseract is then only paid for
// the occasional soft/blurred frame the fast path can't trust.
//
// Per crop:
//   1. run the glyph matcher (sub-millisecond);
//   2. ACCEPT its read when confidence ≥ CONFIG.ocr.hybridFastConf (a clean, sharp glyph
//      read) — tesseract is skipped entirely for that crop;
//   3. otherwise fall back to tesseract on that crop only.
//
// This is strictly >= each engine alone: it keeps the glyph matcher's 0-false-positive
// behaviour and speed on sharp pills, and recovers tesseract's recall on the blurry pills
// the matcher rejects (which glyph-alone would simply miss). The conservative downstream
// matcher (bestMatchFromText) still gates every read, so a skipped tesseract call can only
// ever cost a miss, never manufacture a wrong code — provided the confidence floor stays
// high enough that a confident-but-wrong fast read never reaches a real checklist code.
// That floor is the one thing to validate on the bench + on-device before trusting it.

import type { OcrEngine, OcrResult } from '../types';
import { CONFIG } from '../config';
import { createOcrEngine } from './engine';
import { createGlyphOcrEngine } from './glyphEngine';

/** How the fast (glyph) read routes each crop:
 *   - 'drop'   : empty text → a blank/no-glyph crop. Tesseract would read nothing too, so
 *                skip it entirely (this is the speed win — most crops on a frame are blank).
 *   - 'accept' : a confident read (mean-glyph confidence ≥ floor) → take it, skip tesseract.
 *   - 'verify' : an ink-bearing read the matcher ISN'T sure about — the engine forces
 *                confidence 0 on its rejects (ambiguous/garbled), and a genuinely soft pill
 *                reads low — so hand it to tesseract for a second opinion. This is what keeps
 *                the blurry-frame recall the glyph matcher alone would lose. */
function route(r: OcrResult): 'drop' | 'accept' | 'verify' {
  if (!r.text) return 'drop';
  return r.confidence >= CONFIG.ocr.hybridFastConf ? 'accept' : 'verify';
}

export function createHybridOcrEngine(): OcrEngine {
  const fast = createGlyphOcrEngine();
  const slow = createOcrEngine();

  return {
    async init(onProgress) {
      // Render the glyph atlas and load the tesseract worker(s) together; only tesseract
      // has a meaningful (model-download) progress to forward.
      await Promise.all([fast.init(), slow.init(onProgress)]);
    },

    async recognize(source) {
      const f = await fast.recognize(source);
      // 'drop' returns the empty read as-is; only 'verify' pays tesseract.
      return route(f) === 'verify' ? slow.recognize(source) : f;
    },

    async recognizeMany(sources) {
      const fastReads = await fast.recognizeMany(sources);
      const out: OcrResult[] = new Array(sources.length);
      const fallback: number[] = [];
      for (let i = 0; i < sources.length; i++) {
        // 'drop' and 'accept' both keep the fast read (empty, or confident); only 'verify'
        // ink-bearing-but-unsure crops go to tesseract — so a blank-heavy frame pays almost
        // no tesseract at all.
        if (route(fastReads[i]) === 'verify') fallback.push(i);
        else out[i] = fastReads[i];
      }
      // Only the crops the fast path didn't trust pay tesseract — and they run together on
      // its worker pool, so a single soft crop in an otherwise sharp frame stays cheap.
      if (fallback.length > 0) {
        const slowReads = await slow.recognizeMany(fallback.map((i) => sources[i]));
        for (let k = 0; k < fallback.length; k++) out[fallback[k]] = slowReads[k];
      }
      return out;
    },

    async terminate() {
      await Promise.all([fast.terminate(), slow.terminate()]);
    },
  };
}
