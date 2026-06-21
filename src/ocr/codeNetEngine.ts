// codeNet: the neural recognizer. A fixed-position multi-head CNN (trained offline in
// tfjs-node, scripts/ml/train.cjs) reads a code from the RAW de-rotated grayscale crop — the
// otsu-free path that survives the low-contrast pills. Inference runs in-browser via tfjs.
//
// Decoding is CLOSED-SET over the 980-code checklist (ported from the native CTC decoder's
// idea): rather than argmax-then-snap, we score EVERY real code against the per-slot
// probabilities and pick the best, gated by posterior + margin + mean-log-prob. That makes the
// recognizer structurally unable to emit a non-code, and the gates are the 0-false-positive
// guard (a soft/garbled crop fails them → a miss, never a wrong code).

import * as tf from '@tensorflow/tfjs';
import type { Checklist } from '../types';
import { letterboxGray, toFloatInput, INPUT_W, INPUT_H, ALPHABET, BLANK } from './codeImage';

/** Raw (UNGATED) closed-set scoring of a crop — `rawCode` is always the argmax closed-set code
 *  even when the gates would reject it. The multi-crop TTA recognizer (recognizeFrameCodeNet) votes
 *  across crop variants and applies the posterior/margin gate to the AGGREGATE rather than per-crop. */
export interface CodeNetScored {
  rawCode: string;
  posterior: number;
  margin: number; // log-prob gap of the best code over max(runner-up, all-blank "no code")
  meanLogProb: number;
  /** Top-K closed-set codes with their posteriors (descending) — built ONLY when `wantTop` is set
   *  (the dev bench's soft-voting mode); the live path never reads it, so it isn't computed there. */
  top?: Array<{ code: string; posterior: number }>;
}

export interface CodeNet {
  init(modelUrl: string): Promise<void>;
  ready(): boolean;
  /** Recognize prepared RAW crops (each letterboxed internally). Returns the UNGATED best code +
   *  scores per crop, in order (one batched predict). `wantTop` additionally fills `top` (dev only). */
  recognizeScored(crops: HTMLCanvasElement[], wantTop?: boolean): Promise<CodeNetScored[]>;
}

/** Gates ported from the native closed-set CTC decoder. Tunable against bench:pixel for the
 *  recall/FP trade-off; higher = fewer false positives, fewer recalls. */
export const CODENET_GATES = { minPosterior: 0.85, minMargin: 1.0, minMeanLogProb: -1.6 };

function logSumExp(xs: number[]): number {
  let m = -Infinity;
  for (const x of xs) if (x > m) m = x;
  if (m === -Infinity) return -Infinity;
  let s = 0;
  for (const x of xs) s += Math.exp(x - m);
  return m + Math.log(s);
}

export function createCodeNet(checklist: Checklist): CodeNet {
  let model: tf.LayersModel | null = null;
  let maxlen = 0;
  // Precompute each code's class-index sequence for closed-set scoring.
  let codes: Array<{ code: string; idx: number[] }> = [];

  return {
    async init(modelUrl) {
      const meta = (await (await fetch(modelUrl.replace(/model\.json$/, 'meta.json'))).json()) as {
        maxlen: number;
      };
      maxlen = meta.maxlen;
      model = await tf.loadLayersModel(modelUrl);
      codes = checklist.entries.map((e) => ({
        code: e.code,
        idx: [...e.code].map((c) => ALPHABET.indexOf(c)),
      }));
      // Warm up (compile kernels) so the first real call isn't slow.
      const warm = tf.zeros([1, INPUT_H, INPUT_W, 1]);
      (model.predict(warm) as tf.Tensor).dispose();
      warm.dispose();
    },

    ready: () => model !== null,

    async recognizeScored(crops, wantTop = false) {
      if (!model || crops.length === 0) return [];
      const B = crops.length;
      const buf = new Float32Array(B * INPUT_H * INPUT_W);
      for (let b = 0; b < B; b++) {
        const f = toFloatInput(letterboxGray(crops[b]));
        buf.set(f, b * INPUT_H * INPUT_W);
      }
      const xs = tf.tensor(buf, [B, INPUT_H, INPUT_W, 1]);
      const out = model.predict(xs) as tf.Tensor; // [B, maxlen, 37] softmax probs
      const probs = await out.data();
      xs.dispose();
      out.dispose();

      const NC = ALPHABET.length + 1;
      const stride = maxlen * NC;
      const results: CodeNetScored[] = [];
      for (let b = 0; b < B; b++) {
        // log-probs for this sample
        const lp = new Float32Array(stride);
        for (let i = 0; i < stride; i++) lp[i] = Math.log(Math.max(1e-8, probs[b * stride + i]));
        // score every code, tracking the best/second and a small top-K (for soft-voting TTA).
        let best = -Infinity;
        let bestCode = '';
        let second = -Infinity;
        const all: number[] = [];
        const K = 5;
        // top-K only when the caller wants it (dev soft-voting bench) — the live path discards it,
        // so we skip the per-code insertion-sort on the latency-critical path.
        const topK: Array<{ code: string; sc: number }> = [];
        for (const { code, idx } of codes) {
          if (idx.length > maxlen) continue;
          let sc = 0;
          for (let t = 0; t < maxlen; t++) {
            const cls = t < idx.length ? idx[t] : BLANK;
            sc += lp[t * NC + cls];
          }
          all.push(sc);
          if (sc > best) {
            second = best;
            best = sc;
            bestCode = code;
          } else if (sc > second) {
            second = sc;
          }
          if (wantTop && (topK.length < K || sc > topK[topK.length - 1].sc)) {
            let ins = topK.length;
            while (ins > 0 && topK[ins - 1].sc < sc) ins--;
            topK.splice(ins, 0, { code, sc });
            if (topK.length > K) topK.pop();
          }
        }
        // NULL hypothesis: score the all-blank sequence (model trained to predict blank on
        // non-pills). Folding it into the denominator makes a non-sticker crop — where blank
        // dominates — yield a LOW posterior for its best code, so it's rejected. Without this the
        // closed-set always picks the best of 980 codes and reads codes off noise (RSA1@1.00).
        let blankScore = 0;
        for (let t = 0; t < maxlen; t++) blankScore += lp[t * NC + BLANK];
        const denom = logSumExp([...all, blankScore]);
        const posterior = Math.exp(best - denom);
        const margin = best - Math.max(second, blankScore); // also require beating "no code"
        const meanLogProb = best / maxlen;
        const scored: CodeNetScored = { rawCode: bestCode, posterior, margin, meanLogProb };
        if (wantTop) scored.top = topK.map((t) => ({ code: t.code, posterior: Math.exp(t.sc - denom) }));
        results.push(scored);
      }
      return results;
    },
  };
}
