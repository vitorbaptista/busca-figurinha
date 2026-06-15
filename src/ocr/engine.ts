import { createWorker, PSM } from 'tesseract.js';
import { CONFIG } from '../config';
import type { OcrEngine } from '../types';

type Worker = Awaited<ReturnType<typeof createWorker>>;

/** Tesseract.js v5 backed OCR engine. The worker is created lazily on first init(). */
export function createOcrEngine(): OcrEngine {
  let worker: Worker | null = null;

  return {
    async init(onProgress) {
      if (worker) return; // guard against double-init

      worker = await createWorker('eng', 1, {
        logger: (m) => {
          if (m.status === 'recognizing text' && onProgress) onProgress(m.progress);
        },
      });
      await worker.setParameters({
        tessedit_char_whitelist: CONFIG.ocr.charWhitelist,
        tessedit_pageseg_mode: PSM.SPARSE_TEXT,
      });
    },

    async recognize(source) {
      if (!worker) throw new Error('OcrEngine.recognize called before init()');
      const { data } = await worker.recognize(source);
      return { text: data.text, confidence: data.confidence };
    },

    async terminate() {
      await worker?.terminate();
      worker = null;
    },
  };
}
