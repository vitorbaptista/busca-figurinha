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
    /** Confidence floor for the directed-confusion fallback (bestHighConfidenceConfusionMatch).
     *  When a frame resolves NO code by normal (conservative) matching, each read at/above this
     *  confidence gets one more chance via the curated glyph-confusion map (NJT→AUT, HSA→RSA…).
     *  Set HIGH: the confusion map is aggressive (it reaches a real code through up to two
     *  systematic letter swaps), so it must only ever see reads the recognizer is sure of — a
     *  low-confidence garble must NOT be confusion-corrected, or a non-sticker frame could
     *  manufacture a code (a false positive). Tune against bench:pixel: raise it if negatives
     *  start resolving, lower it only while per-frame FP stays ~0. */
    confusionMinConf: 78,
    /** Confidence floor for the per-sticker EXACT-alias fallback (bestHighConfidenceExactAlias).
     *  Lower than confusionMinConf because an exact garble→code alias is far more specific than
     *  the confusion map AND carries a runtime collision guard (refuses a garble within one edit
     *  of a different real code), so it tolerates a softer read. Still a gate: a near-noise read
     *  must not trigger even an exact alias. Tune against bench:pixel FP. */
    aliasMinConf: 55,
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
    /** Minimum time between two consecutive captures (ms). A person needs more than this
     *  to physically swap stickers, so a "new" read sooner than this is almost certainly the
     *  SAME sticker re-triggering (a flicker re-arm) — bogus. The loop won't fire again until
     *  this has elapsed since the last capture, on top of the motion re-arm. */
    minRecaptureMs: 250,
  },
  detect: {
    /** Restrict pill detection to a BOTTOM vertical band of the frame: rows
     *  [roiTopFraction*H .. H]. Matches the use-case + the on-screen reticle, which sits at
     *  the bottom of the view (everything above is the white fill-light, where no sticker
     *  is shown). Scanning only the band cuts detection cost (~O(area)) AND skips OCR of the
     *  room/face the front camera sees above the sticker. 0 = full frame; 0.5 = bottom half,
     *  0.67 = bottom third. Boxes are returned in FULL-FRAME coordinates (the band offset is
     *  added back), so the crop step is unchanged. A pill ABOVE the band isn't detected — so
     *  this must stay aligned with where the reticle puts the sticker. NOTE: the static/video
     *  benches are NOT bottom-framed, so a non-zero value lowers their recall by construction;
     *  validate this one LIVE, not against those benches. Ignored when `roiRect` is set. */
    roiTopFraction: 0.67 as number,
    /** Optional RECTANGULAR ROI (normalized 0..1 {left,top,right,bottom}), takes precedence
     *  over roiTopFraction when non-null. The native recognizer's most-accurate config restricts
     *  detection to a strip in the UPPER-MIDDLE of the frame (left 0.18, top 0.32, right 0.82,
     *  bottom 0.58) — where a front-camera selfie capture actually holds the sticker — not the
     *  bottom band. Detection runs on the cropped rectangle (scaled against the FULL frame's long
     *  side so every DET_LONG-relative gate stays calibrated) and boxes are offset back to
     *  full-frame coordinates. null = use the roiTopFraction band (back-compat default). Like the
     *  bottom band, this is a USE-CASE knob: it tanks the static/video benches by construction and
     *  must be validated against the real-frame pixel dataset / live, not those benches. */
    roiRect: { left: 0.18, top: 0.32, right: 0.82, bottom: 0.58 } as {
      left: number;
      top: number;
      right: number;
      bottom: number;
    } | null,
    /** How much darker than its local background a pixel must be to count as pill foreground
     *  (detection). Lower = catches lower-contrast pills (which otherwise segment into tiny
     *  fragments → blank crops), at the cost of more card-texture noise components. Default 12
     *  is the long-proven full-frame value; the real-frame dataset has soft, low-contrast pills
     *  that shatter at 12. Tune against bench:pixel (recall vs per-frame FP) + npm run bench. */
    fgDelta: 12 as number,
    /** Cap on boxes OCR'd per frame (findCodeBoxes sorts best-first; the real code pill is
     *  usually box[0]). Lower = faster + fewer spurious reads; higher = a bit more recall on
     *  far/multi-up frames. 4 is the measured knee on the blurry video frames; the native's
     *  tight-ROI config uses 2. See recognize.ts for the full rationale. */
    maxBoxes: 4 as number,
  },
  match: {
    /** Max Levenshtein distance for an OCR token to snap to a real code. */
    maxDistance: 1,
    /** How many frames of one hold must agree before a code commits. Back to 2: live testing
     *  showed the fast glyph path occasionally MISREADS one frame of a sticker as a different
     *  real code (NZL 18 → a one-off "BIH 4"), which committed as a bogus second code. Requiring
     *  agreement across 2 frames rejects that — a one-off misread never repeats, so it never
     *  confirms, while the correct code reads consistently and confirms on the 2nd frame. This
     *  is the principled 0-false-positive guard; the small extra frame is cheap now that reads
     *  are ~85ms. The burst stops one frame after the first confirmation, so only ONE code
     *  commits per sticker hold. */
    confirmations: 2,
  },
} as const;
