import { describe, it, expect } from 'vitest';
import { computeRoiViewport } from './useRoiViewport';

// The shipped detection ROI (CONFIG.detect.roiRect) + the mira window aspect (236/158).
const ROI = { left: 0.18, top: 0.32, right: 0.82, bottom: 0.58 };

describe('computeRoiViewport', () => {
  it('centres the ROI in the window and covers it', () => {
    const vw = 1280;
    const vh = 720;
    const lw = 236;
    const lh = 158;
    const v = computeRoiViewport(vw, vh, lw, lh, ROI);

    // The ROI's centre must land at the window's centre.
    const cx = (ROI.left + ROI.right) / 2;
    const cy = (ROI.top + ROI.bottom) / 2;
    expect(v.left + cx * v.width).toBeCloseTo(lw / 2, 5);
    expect(v.top + cy * v.height).toBeCloseTo(lh / 2, 5);

    // The ROI region, scaled, must COVER the window in both dimensions (>= with tiny epsilon).
    const roiOnScreenW = (ROI.right - ROI.left) * v.width;
    const roiOnScreenH = (ROI.bottom - ROI.top) * v.height;
    expect(roiOnScreenW).toBeGreaterThanOrEqual(lw - 1e-6);
    expect(roiOnScreenH).toBeGreaterThanOrEqual(lh - 1e-6);

    // The ROI's on-screen box must fully contain the window (no gap shows outside the ROI).
    const roiLeft = v.left + ROI.left * v.width;
    const roiTop = v.top + ROI.top * v.height;
    expect(roiLeft).toBeLessThanOrEqual(1e-6);
    expect(roiTop).toBeLessThanOrEqual(1e-6);
    expect(roiLeft + roiOnScreenW).toBeGreaterThanOrEqual(lw - 1e-6);
    expect(roiTop + roiOnScreenH).toBeGreaterThanOrEqual(lh - 1e-6);
  });

  it('keeps the video aspect ratio (so the image is never stretched)', () => {
    const v = computeRoiViewport(640, 480, 300, 200, ROI);
    expect(v.width / v.height).toBeCloseTo(640 / 480, 5);
  });

  it('is x-symmetric ROI → horizontally centred regardless of mirroring', () => {
    // ROI is symmetric about x=0.5, so the video is centred horizontally (left mirrors cleanly).
    const v = computeRoiViewport(1000, 1000, 200, 200, ROI);
    expect(v.left + v.width / 2).toBeCloseTo(100, 5);
  });
});
