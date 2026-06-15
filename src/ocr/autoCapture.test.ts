import { describe, expect, it } from 'vitest';
import { frameDiff } from './autoCapture';

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
