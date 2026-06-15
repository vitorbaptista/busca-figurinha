// Tunable constants. Kept in one place so they're easy to adjust while testing on a
// real phone. Values are starting points tuned against the sample sticker backs.

export const CONFIG = {
  ocr: {
    lang: 'eng',
    charWhitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 ',
    /** Width the captured frame is OCR'd at. High enough that several sticker codes
     *  stay legible when multiple backs are in view; only the on-demand capture pays
     *  this cost — the frame-difference loop samples a tiny 160px canvas. */
    maxWidth: 1920,
  },
  capture: {
    /** Frame must stay still this long before we OCR it. */
    stabilityMs: 380,
    /** Fraction of changed pixels below which a frame counts as "still". */
    stillThreshold: 0.02,
    /** Frame must change at least this much after a read before we arm again. */
    rearmThreshold: 0.06,
    /** How often the capture loop samples the frame difference (ms). */
    sampleIntervalMs: 120,
    /** While a sticker is held still, OCR up to this many frames looking for
     *  agreeing reads. The burst stops one frame after the last code confirms, so a
     *  lone sticker typically uses ~3; the cap only bites on a busy multi-sticker
     *  frame or one too soft to ever agree. */
    burstFrames: 6,
    /** Small gap between burst frames so the preview can paint and autofocus can
     *  settle between reads. */
    burstIntervalMs: 70,
  },
  match: {
    /** Max Levenshtein distance for an OCR token to snap to a real code. */
    maxDistance: 1,
    /** A code must be read on this many frames of one hold before we commit it —
     *  filters a single blurry frame that mis-reads one valid code as another. */
    confirmations: 2,
  },
} as const;
