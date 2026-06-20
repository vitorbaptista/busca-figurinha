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
  let ticks = 0;
  let lastCaptureAt = 0;

  /** Report the loop's current phase to the debug heartbeat (if any). `stalled` means
   *  we couldn't grab a camera frame this tick — surfaced distinctly so a starved loop
   *  doesn't masquerade as `locked` ("troque a figurinha") in the debug readout. `locked` is
   *  ONLY reached after a real read, so it always truthfully means "lido ✓" — a held sticker
   *  we couldn't read yet stays in holding/reading (still trying), never locked. */
  function emitTick(change: number, stalled = false): void {
    if (!deps.onTick) return;
    const phase = stalled
      ? 'stalled'
      : state === 'locked'
        ? 'locked'
        : !sawMotion
          ? 'waiting'
          : change < CONFIG.capture.stillThreshold
            ? 'holding'
            : 'moving';
    deps.onTick({ phase, change, heldMs: stillSince ? Date.now() - stillSince : 0, tick: ticks });
  }

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
    ticks++;
    const frame = grabSampleFrame();
    if (!frame) {
      // No frame this tick (video paused/not ready). Don't touch prevFrame or state —
      // when frames resume, the normal motion check re-arms a `locked` swap as usual.
      emitTick(0, true);
      return;
    }

    if (!prevFrame) {
      prevFrame = frame;
      emitTick(0);
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
        else if (
          Date.now() - stillSince >= stabilityMs &&
          // Cooldown: a "new" sticker sooner than this since the last read can't be a real
          // swap — it's the same one re-triggering, so ignore it until enough time passes.
          Date.now() - lastCaptureAt >= CONFIG.capture.minRecaptureMs
        ) {
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

    emitTick(change);
  }

  async function capture() {
    deps.onTick?.({ phase: 'reading', change: 0, heldMs: 0, tick: ticks });
    deps.onBurstStart?.();
    const { burstFrames, burstIntervalMs } = CONFIG.capture;
    let committed = false; // a code was actually read this burst
    let detected = false; // a sticker was in view this burst (even if unread)
    try {
      // Read several frames of the held sticker until a result is confirmed (or we
      // run out of attempts). One frame can mis-read; agreement across frames can't.
      for (let attempt = 0; attempt < burstFrames; attempt++) {
        if (!deps.source.drawTo(captureCanvas, CONFIG.ocr.maxWidth)) break;
        const r = await deps.onCapture(captureCanvas);
        if (r.committed) committed = true;
        if (r.detected) detected = true;
        if (r.stop) break;
        if (attempt < burstFrames - 1) await delay(burstIntervalMs);
      }
    } finally {
      lastCaptureAt = Date.now();
      stillSince = null;
      if (committed) {
        // A real read — lock and wait for the sticker to be swapped before reading again.
        // This is the ONLY path to `locked`, so the heartbeat's "lido ✓ — troque a figurinha"
        // never lies: it shows only after a sticker was actually read.
        state = 'locked';
        sawMotion = false;
      } else if (detected) {
        // A sticker is in view but we couldn't read it yet — NEVER give up. Stay armed
        // (state stays 'waiting', sawMotion kept) so the next still frame re-tries it while
        // it's held; the minRecaptureMs gate paces the retries.
        state = 'waiting';
      } else {
        // Nothing in view (empty mat) — go idle and require fresh motion before bursting
        // again, so a held-empty view can't burst forever (battery on low-end phones).
        state = 'waiting';
        sawMotion = false;
      }
    }
  }

  const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

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
