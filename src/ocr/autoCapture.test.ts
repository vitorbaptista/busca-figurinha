import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createAutoCapture, frameDiff } from './autoCapture';
import type { CaptureResult, FrameSource } from '../types';

/** Build an RGBA buffer of `count` pixels all set to the same gray value. */
function solidFrame(count: number, value: number): Uint8ClampedArray {
  const buf = new Uint8ClampedArray(count * 4);
  for (let i = 0; i < buf.length; i += 4) {
    buf[i] = buf[i + 1] = buf[i + 2] = value;
    buf[i + 3] = 255;
  }
  return buf;
}

describe('frameDiff', () => {
  it('returns 0 for identical arrays', () => {
    const frame = solidFrame(100, 128);
    expect(frameDiff(frame, frame.slice())).toBe(0);
  });

  it('returns ~1 for a fully inverted frame', () => {
    const black = solidFrame(100, 0);
    const white = solidFrame(100, 255);
    expect(frameDiff(black, white)).toBe(1);
  });

  it('returns a sensible fraction for a partial change', () => {
    const before = solidFrame(100, 0);
    const after = solidFrame(100, 0);
    // Flip a quarter of the pixels to white (well above the luma delta).
    for (let p = 0; p < 25; p++) {
      const i = p * 4;
      after[i] = after[i + 1] = after[i + 2] = 255;
    }
    expect(frameDiff(before, after)).toBeCloseTo(0.25, 5);
  });

  it('returns 0 for empty or mismatched-length buffers', () => {
    expect(frameDiff(new Uint8ClampedArray(0), new Uint8ClampedArray(0))).toBe(0);
    expect(frameDiff(solidFrame(4, 0), solidFrame(8, 0))).toBe(0);
  });

  it('ignores sub-delta luminance noise', () => {
    const before = solidFrame(100, 100);
    const after = solidFrame(100, 110); // +10 < LUMA_DELTA (24)
    expect(frameDiff(before, after)).toBe(0);
  });
});

/**
 * Drives the createAutoCapture state machine with fake timers + a stubbed canvas, so we can
 * assert what the loop does after a burst WITHOUT the camera/OCR. The key invariant (the user's
 * bug): the loop reaches `locked` — the state the debug heartbeat reads as "lido ✓ — troque a
 * figurinha" — ONLY after a burst that actually committed a read, never just because a burst ran.
 */
describe('createAutoCapture — lock only on a real read', () => {
  const PX = 16 * 9; // sample-canvas pixels (drawTo sizes it 16×9)
  const dark = new Uint8ClampedArray(PX * 4); // all 0
  const light = (() => {
    const f = new Uint8ClampedArray(PX * 4);
    f.fill(255);
    return f;
  })();
  let current = dark; // the "camera" frame the stub returns this tick

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(10_000); // a base > minRecaptureMs so the first capture isn't cooldown-gated
    current = dark;
    // jsdom has no 2d context; return a fake one whose getImageData yields `current`.
    // (getContext is heavily overloaded; cast through any to satisfy the strict build tsc.)
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      getImageData: () => ({ data: current }),
    } as unknown as ReturnType<HTMLCanvasElement['getContext']>);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  const source: FrameSource = {
    start: () => Promise.resolve(),
    stop: () => {},
    element: undefined as unknown as HTMLVideoElement,
    isReady: () => true,
    drawTo: (canvas: HTMLCanvasElement) => {
      canvas.width = 16;
      canvas.height = 9;
      return true;
    },
  };

  /** Run a scenario: arm with motion, then hold a still sticker whose burst returns `result`,
   *  and collect every phase the loop emits over `holdMs` of being held. */
  async function holdStillSticker(result: CaptureResult, holdMs: number) {
    const phases: string[] = [];
    const onCapture = vi.fn(async (): Promise<CaptureResult> => result);
    const cap = createAutoCapture({ source, onCapture, onTick: (s) => phases.push(s.phase) });
    cap.start();

    current = dark;
    await vi.advanceTimersByTimeAsync(60); // first tick: seed prevFrame
    current = light;
    await vi.advanceTimersByTimeAsync(60); // motion (dark→light): arms the loop
    // Now hold the sticker perfectly still (current stays `light`) and let it settle + burst.
    await vi.advanceTimersByTimeAsync(holdMs);

    cap.stop();
    return { phases, onCapture };
  }

  it('locks (→ "lido ✓") after a burst that commits a read', async () => {
    const { phases, onCapture } = await holdStillSticker(
      { stop: true, committed: true, detected: true },
      2000,
    );
    expect(phases).toContain('locked');
    // It read on the first frame (stop:true) and then locked, so it does NOT keep bursting.
    expect(onCapture.mock.calls.length).toBeLessThan(6);
  });

  it('NEVER locks when a present sticker can\'t be read — it keeps trying', async () => {
    const { phases, onCapture } = await holdStillSticker(
      { stop: false, committed: false, detected: true }, // sticker seen, but no code read
      2000,
    );
    expect(phases).not.toContain('locked'); // the bug: it must not claim "lido ✓"
    // "don't give up": it re-bursts while held, so far more than one burst's worth of reads.
    expect(onCapture.mock.calls.length).toBeGreaterThan(6);
  });

  it('does not lock — and goes idle — when nothing is in view (empty mat)', async () => {
    const { phases, onCapture } = await holdStillSticker(
      { stop: false, committed: false, detected: false }, // no sticker detected at all
      2000,
    );
    expect(phases).not.toContain('locked');
    // One burst probes the still frame, then it idles (needs fresh motion) instead of bursting
    // forever — so it never balloons the way the keep-trying case does.
    expect(onCapture.mock.calls.length).toBeLessThanOrEqual(6);
  });
});
