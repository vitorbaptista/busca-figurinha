import { createWorker, createScheduler, PSM } from 'tesseract.js';
import { CONFIG } from '../config';
import type { OcrEngine } from '../types';

type Worker = Awaited<ReturnType<typeof createWorker>>;

/** How many Tesseract workers to run in parallel. Each located code-box crop is
 *  OCR'd on its own (stacking crops confuses the layout analysis and drops thin
 *  glyphs like the "I" in CIV), so a small pool reads several crops at once. Capped
 *  at 2: the sparse-ink gate makes most crops return instantly, so only a couple do
 *  real work — and each worker costs ~10–15MB, which matters on low-end phones. */
function workerCount(): number {
  const cores = typeof navigator !== 'undefined' ? navigator.hardwareConcurrency || 2 : 2;
  return Math.max(1, Math.min(2, cores - 1));
}

/** Tesseract.js engine: a small scheduler of workers, created lazily on init(). */
export function createOcrEngine(): OcrEngine {
  const scheduler = createScheduler();
  const workers: Worker[] = [];
  let initPromise: Promise<void> | null = null;

  return {
    init(onProgress) {
      if (initPromise) return initPromise;
      initPromise = (async () => {
        const count = workerCount();
        await Promise.all(
          Array.from({ length: count }, async (_, i) => {
            const worker = await createWorker('eng', 1, {
              // Always a function — tesseract.js calls it unconditionally. Only the
              // first worker forwards progress to the UI.
              logger: (m) => {
                if (i === 0 && onProgress && m.status === 'recognizing text') {
                  onProgress(m.progress);
                }
              },
            });
            await worker.setParameters({
              tessedit_char_whitelist: CONFIG.ocr.charWhitelist,
              // Each crop is just the code box; a uniform-block read of the lone crop
              // is the most accurate (and ~tens of ms on a small image).
              tessedit_pageseg_mode: PSM.SINGLE_BLOCK,
            });
            workers.push(worker);
            scheduler.addWorker(worker);
          }),
        );
      })();
      return initPromise;
    },

    async recognize(source) {
      const { data } = await scheduler.addJob('recognize', source);
      return { text: data.text, confidence: data.confidence };
    },

    async recognizeMany(sources) {
      const results = await Promise.all(
        sources.map((s) => scheduler.addJob('recognize', s)),
      );
      return results.map((r) => ({ text: r.data.text, confidence: r.data.confidence }));
    },

    async terminate() {
      await scheduler.terminate().catch(() => {});
      workers.length = 0;
      initPromise = null;
    },
  };
}
