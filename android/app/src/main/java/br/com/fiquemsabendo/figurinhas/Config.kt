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
    object CaptureQuality {
        /** Quality checks only inspect the first few detector candidates, matching live OCR work. */
        const val MAX_BOXES = 4
        /** A code pill shorter than this fraction of the frame's short side is usually too small
         *  for the glyph matcher on Pixel live frames. The live loop still lets OCR try it, but
         *  asks the user to move closer. */
        const val MIN_CODE_LONG_SIDE_FRAME_FRACTION = 0.14
        /** If the detected pill touches the target-box margin, it is probably partly clipped or
         *  competing with the white mask edge; ask the user to re-center while OCR keeps trying. */
        const val ROI_EDGE_MARGIN_FRACTION = 0.045
        /** Generous center tolerance inside the target box. Edge-touching catches hard clipping;
         *  this catches the clearly off-center cases that still leave a full component. */
        const val MAX_CENTER_OFFSET_X_ROI_FRACTION = 0.38
        const val MAX_CENTER_OFFSET_Y_ROI_FRACTION = 0.40
        /** User-facing live scan assumes a horizontal code inside the landscape reticle. The OCR
         *  pipeline can de-rotate, but steep hand tilt softens crops and creates riskier candidates;
         *  guiding the user to straighten is the safer recall fix. */
        const val MAX_HORIZONTAL_TILT_DEG = 15.0
        /** Mean absolute 4-neighbour Laplacian in the detected pill crop. Used as guidance only,
         *  not as a hard OCR blocker, because a soft frame may still confirm safely. */
        const val MIN_SHARPNESS = 5.0
    }
    object Camera {
        /** Digital zoom requested on the front camera. The live SWE8 Pixel dumps showed the scanner
         *  was fast but the printed code pill was too tiny for reliable glyph OCR; zooming the camera
         *  makes the target box behave more like a barcode scanner window without weakening the
         *  confidence gates. Clamped to the device's reported zoom range at runtime. */
        const val FRONT_ZOOM_RATIO = 2.0f
    }
    object Detect {
        /** The OCR target box, as fractions (0..1) of the DISPLAY-oriented frame. Detection runs ONLY
         *  inside this rectangle and the on-screen reticle draws exactly it, so the user lines the
         *  sticker's code up inside the box. A small, centered target makes the code pill large,
         *  centered and free of background — far more reliable than scanning the whole frame. Tune
         *  these live on the device (move/resize the box to where stickers actually land). The whole
         *  frame would be 0,0,1,1 (used by the benches/golden tests, which aren't framed to a box). */
        const val ROI_LEFT = 0.18
        const val ROI_TOP = 0.32
        const val ROI_RIGHT = 0.82
        const val ROI_BOTTOM = 0.58
    }
    object Ocr {
        /** Glyph-matcher accept floor: a fast read with mean-glyph confidence below this is NOT
         *  trusted — it falls to the slow fallback, or (until the fine-tuned Tesseract lands) is
         *  treated as a miss. Set HIGH so soft pills miss rather than commit a confident-but-wrong
         *  code. Mirrors src/config.ts ocr.hybridFastConf. */
        const val HYBRID_FAST_CONF = 70.0
    }
}
