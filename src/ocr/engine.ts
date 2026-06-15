import { createWorker, PSM } from 'tesseract.js';
import { CONFIG } from '../config';
import type { OcrEngine } from '../types';

type Worker = Awaited<ReturnType<typeof createWorker>>;

/** Tesseract.js v5 backed OCR engine. The worker is created lazily on first init(). */
export function createOcrEngine(): OcrEngine {
  let worker: Worker | null = null;
  let initPromise: Promise<void> | null = null;

  return {
    init(onProgress) {
      // Idempotent regardless of caller: concurrent init() calls share one worker.
      if (initPromise) return initPromise;
      initPromise = (async () => {
        const w = await createWorker('eng', 1, {
          logger: (m) => {
            if (m.status === 'recognizing text' && onProgress) onProgress(m.progress);
          },
        });
        await w.setParameters({
          tessedit_char_whitelist: CONFIG.ocr.charWhitelist,
          // We OCR a small image built from located code-box crops stacked into rows
          // (one code per line). A uniform-block mode reads them in a single pass —
          // far faster and more accurate than scanning the whole frame for sparse text.
          tessedit_pageseg_mode: PSM.SINGLE_BLOCK,
          // Codes aren't dictionary words; disable the language model so Tesseract
          // doesn't "correct" e.g. CIV→CV based on English word priors.
          load_system_dawg: '0',
          load_freq_dawg: '0',
        });
        worker = w;
      })();
      return initPromise;
    },

    async recognize(source) {
      if (!worker) throw new Error('OcrEngine.recognize called before init()');
      const { data } = await worker.recognize(source);
      return { text: data.text, confidence: data.confidence };
    },

    async terminate() {
      await worker?.terminate();
      worker = null;
      initPromise = null;
    },
  };
}
