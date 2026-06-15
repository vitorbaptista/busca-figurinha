import { CONFIG } from '../config';
import type { AutoCapture, AutoCaptureDeps } from '../types';

/** Luminance change above this (0..255) counts a sampled pixel as "changed". */
const LUMA_DELTA = 24;
/** Width of the small canvas used for cheap frame-difference sampling. */
const SAMPLE_WIDTH = 160;

/**
 * Fraction (0..1) of sampled pixels whose luminance changed by more than a small
 * delta between two equal-length RGBA buffers. Pure — exported for testing.
 */
export function frameDiff(prev: Uint8ClampedArray, next: Uint8ClampedArray): number {
  if (prev.length !== next.length || prev.length === 0) return 0;

  let changed = 0;
  let sampled = 0;
  for (let i = 0; i < prev.length; i += 4) {
    const prevLuma = prev[i] * 0.299 + prev[i + 1] * 0.587 + prev[i + 2] * 0.114;
    const nextLuma = next[i] * 0.299 + next[i + 1] * 0.587 + next[i + 2] * 0.114;
    if (Math.abs(prevLuma - nextLuma) > LUMA_DELTA) changed++;
    sampled++;
  }

  return sampled === 0 ? 0 : changed / sampled;
}

type State = 'waiting' | 'locked';

/**
 * Watches the source for a sticker that lands and holds still, captures it once,
 * then waits for it to be removed before arming for the next one. Never fires
 * while a capture is in flight.
 */
export function createAutoCapture(deps: AutoCaptureDeps): AutoCapture {
  const sampleCanvas = document.createElement('canvas');
  const captureCanvas = document.createElement('canvas');
  // CPU-backed so the per-tick getImageData stays cheap on low-end GPUs.
  const sampleCtx = sampleCanvas.getContext('2d', { willReadFrequently: true });

  let running = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let state: State = 'waiting';
  let prevFrame: Uint8ClampedArray | null = null;
  let stillSince: number | null = null;
  let sawMotion = false;

  function reset() {
    state = 'waiting';
    prevFrame = null;
    stillSince = null;
    sawMotion = false;
  }

  function grabSampleFrame(): Uint8ClampedArray | null {
    if (!sampleCtx || !deps.source.drawTo(sampleCanvas, SAMPLE_WIDTH)) return null;
    return sampleCtx.getImageData(0, 0, sampleCanvas.width, sampleCanvas.height).data;
  }

  async function tick() {
    const frame = grabSampleFrame();
    if (!frame) return;

    if (!prevFrame) {
      prevFrame = frame;
      return;
    }

    const change = frameDiff(prevFrame, frame);
    prevFrame = frame;

    const { stillThreshold, rearmThreshold, stabilityMs } = CONFIG.capture;

    if (state === 'waiting') {
      // Require motion first so we don't fire on the empty mat sitting still.
      if (change >= rearmThreshold) {
        sawMotion = true;
        stillSince = null;
      }
      if (!sawMotion) return;

      if (change < stillThreshold) {
        if (stillSince === null) stillSince = Date.now();
        else if (Date.now() - stillSince >= stabilityMs) {
          await capture();
        }
      } else {
        stillSince = null; // moved again — restart the stability timer
      }
    } else {
      // 'locked': wait for the sticker to be removed/replaced before re-arming.
      if (change >= rearmThreshold) {
        state = 'waiting';
        sawMotion = false;
        stillSince = null;
      }
    }
  }

  async function capture() {
    if (!deps.source.drawTo(captureCanvas, CONFIG.ocr.maxWidth)) return;
    try {
      await deps.onCapture(captureCanvas);
    } finally {
      state = 'locked';
      sawMotion = false;
      stillSince = null;
    }
  }

  // Self-scheduling loop: the next sample is queued only after the current tick
  // (including any awaited capture) finishes, so ticks can't pile up under load
  // and a GC/OCR stall can't make a moving sticker briefly look "still".
  function schedule() {
    if (!running) return;
    timer = setTimeout(async () => {
      try {
        await tick();
      } catch {
        /* a single bad sample shouldn't kill the loop */
      }
      schedule();
    }, CONFIG.capture.sampleIntervalMs);
  }

  return {
    start() {
      if (running) return;
      running = true;
      reset();
      schedule();
    },
    stop() {
      running = false;
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      reset();
    },
  };
}
