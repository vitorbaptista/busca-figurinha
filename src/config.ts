// Tunable constants. Kept in one place so they're easy to adjust while testing on a
// real phone. Values are starting points tuned against the sample sticker backs.

export const CONFIG = {
  ocr: {
    lang: 'eng',
    charWhitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 ',
    /** Frames are downscaled to this width before OCR to keep it fast on cheap phones. */
    maxWidth: 720,
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
  },
  match: {
    /** Max Levenshtein distance for an OCR token to snap to a real code. */
    maxDistance: 1,
  },
} as const;
