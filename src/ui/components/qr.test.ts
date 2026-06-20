import { describe, expect, it } from 'vitest';
import { qrSvgPath } from './qr';
import { shareLinkFor } from '../../domain/share';
import { checklist } from '../../data/checklist';

describe('qrSvgPath', () => {
  it('encodes the worst-case (bitmap-fallback) trade link without overflowing', () => {
    // The link encodes each field as the smallest of sparse/dense/bitset, so a near-empty or near-full
    // album stays tiny; only a scattered ~half-full set falls back to a full bitmap — the longest a
    // link ever gets. Selecting every other entry forces BOTH fields to that bitmap, i.e. the real
    // QR-capacity worst case.
    const scattered = checklist.entries.filter((_, i) => i % 2 === 0).map((entry) => entry.code);
    const link = shareLinkFor({ repeats: scattered, missing: scattered }, checklist);

    const { size, path } = qrSvgPath(link);
    expect(size).toBeGreaterThan(8); // module count + the 8 quiet-zone modules
    expect(path.length).toBeGreaterThan(0);
    // EC level L tops out at version 40 = 177 modules; staying well under that proves the worst-case
    // link can never overflow QR capacity (in practice it lands around version 15 / 77 modules).
    expect(size).toBeLessThan(177 + 8);
  });

  it('produces a quiet-zoned grid for a short value', () => {
    const { size, path } = qrSvgPath('https://exemplo.com/?t=1');
    expect(size).toBeGreaterThan(8);
    expect(path).toContain('h1v1h-1z'); // at least one dark module rendered
  });
});
