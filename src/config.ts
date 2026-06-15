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
    /** Hybrid recognizer gate (createHybridOcrEngine). The fast pure-JS glyph matcher
     *  runs first on each crop; its read is ACCEPTED (skipping the ~10× slower tesseract
     *  recognize) only when its mean-glyph confidence clears this floor. Below it, we fall
     *  back to tesseract — so blurry pills keep tesseract's recall while the sharp, close,
     *  focus-locked pills of the real use-case take the fast path. Set conservatively HIGH:
     *  a lower floor is faster but risks a confident-but-wrong fast read snapping to a real
     *  (wrong) checklist code — a false positive. Tune DOWN against the bench + on-device
     *  use-case frames, never up past where 0 FP holds. */
    hybridFastConf: 70,
  },
  capture: {
    /** Frame must stay still this long before we OCR it. Kept short: the screen fill-light
     *  gives sharp frames quickly, and the conservative matcher rejects a too-early/soft read
     *  (a miss, retried next tick) rather than posting a wrong code — so a long settle is just
     *  dead time per sticker. */
    stabilityMs: 130,
    /** Fraction of changed pixels below which a frame counts as "still". */
    stillThreshold: 0.02,
    /** Frame must change at least this much after a read before we arm again. */
    rearmThreshold: 0.06,
    /** How often the capture loop samples the frame difference (ms). Lower = the loop
     *  notices a sticker landing (and the previous one leaving) sooner. The sample is a tiny
     *  160px frame-diff, so checking ~twice as often is cheap and shaves the felt latency. */
    sampleIntervalMs: 60,
    /** While a sticker is held still, OCR up to this many frames looking for an agreeing
     *  read. The burst stops as soon as a code confirms (confirmations=1), so a sharp
     *  fill-lit sticker usually resolves on frame 1–2; the cap only bites on a soft frame. */
    burstFrames: 6,
    /** Small gap between burst frames so the preview can paint between reads. */
    burstIntervalMs: 35,
  },
  match: {
    /** Max Levenshtein distance for an OCR token to snap to a real code. */
    maxDistance: 1,
    /** How many frames of one hold must agree before a code commits. Set to 1: we
     *  commit on a single read and rely on (a) the conservative matcher, which only
     *  ever resolves to a REAL checklist code and never invents one, and (b) feeding
     *  the OCR a sharp, in-focus frame (the focus lock) rather than averaging over soft
     *  ones. Multi-frame agreement was a crutch for soft input — slow, and it masked
     *  the real fix. Raise it only if wrong codes slip through on genuinely soft frames. */
    confirmations: 1,
  },
} as const;
