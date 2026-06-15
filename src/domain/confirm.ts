// Multi-frame agreement. A single camera frame can mis-read a code into a DIFFERENT
// valid one (e.g. "EGY 4" → "EGY 6" under blur), which for a trading app is worse
// than no read at all. While a sticker is held still we OCR several frames and only
// commit a code once it has been seen on enough of them — random per-frame slips
// don't repeat, so they never reach the threshold. Pure and state-only; no I/O.

export interface Confirmer {
  /**
   * Record the codes resolved from one frame. Returns the codes that reached the
   * confirmation threshold on THIS frame (each code is returned at most once, the
   * frame it crosses the threshold), ready to commit.
   */
  add(codes: Iterable<string>): string[];
  /** Forget all evidence — call when a new sticker starts being read. */
  reset(): void;
}

export function createConfirmer(threshold: number): Confirmer {
  const counts = new Map<string, number>();
  const committed = new Set<string>();

  return {
    add(codes) {
      const seenThisFrame = new Set<string>(codes); // a code counts once per frame
      const newlyConfirmed: string[] = [];
      for (const code of seenThisFrame) {
        if (committed.has(code)) continue;
        const next = (counts.get(code) ?? 0) + 1;
        counts.set(code, next);
        if (next >= threshold) {
          committed.add(code);
          newlyConfirmed.push(code);
        }
      }
      return newlyConfirmed;
    },
    reset() {
      counts.clear();
      committed.clear();
    },
  };
}
