package br.com.fiquemsabendo.figurinhas

// Tunable constants in one place (mirrors src/config.ts). Only the domain-relevant subset
// exists now; the OCR/capture/detect knobs are added in the recognizer/capture plans.
object Config {
    object Match {
        /** Max Levenshtein distance for an OCR token to snap to a real code. */
        const val MAX_DISTANCE = 1
        /** Frames of one hold that must agree before a code commits (the 0-FP guard). */
        const val CONFIRMATIONS = 2
    }
    object Capture {
        /** Fraction of changed pixels below which a frame counts as "still". */
        const val STILL_THRESHOLD = 0.02
        /** Frame must change at least this much after a read before we arm again. */
        const val REARM_THRESHOLD = 0.06
        /** Frame must stay still this long before we capture. Short: the fill-light gives sharp
         *  frames fast and the conservative matcher rejects a too-early read. */
        const val STABILITY_MS = 130L
        /** While a sticker is held still, OCR up to this many frames looking for agreement. */
        const val BURST_FRAMES = 6
        /** Min ms between two consecutive committed captures (same-sticker re-arm guard). */
        const val MIN_RECAPTURE_MS = 250L
    }
    object Detect {
        /** The OCR target box, as fractions (0..1) of the DISPLAY-oriented frame. Detection runs ONLY
         *  inside this rectangle and the on-screen reticle draws exactly it, so the user lines the
         *  sticker's code up inside the box. A small, centered target makes the code pill large,
         *  centered and free of background — far more reliable than scanning the whole frame. Tune
         *  these live on the device (move/resize the box to where stickers actually land). The whole
         *  frame would be 0,0,1,1 (used by the benches/golden tests, which aren't framed to a box). */
        const val ROI_LEFT = 0.22
        const val ROI_TOP = 0.37
        const val ROI_RIGHT = 0.78
        const val ROI_BOTTOM = 0.53
    }
    object Ocr {
        /** Glyph-matcher accept floor: a fast read with mean-glyph confidence below this is NOT
         *  trusted — it falls to the slow fallback, or (until the fine-tuned Tesseract lands) is
         *  treated as a miss. Set HIGH so soft pills miss rather than commit a confident-but-wrong
         *  code. Mirrors src/config.ts ocr.hybridFastConf. */
        const val HYBRID_FAST_CONF = 70.0
    }
}
