package br.com.fiquemsabendo.figurinhas.ocr

import br.com.fiquemsabendo.figurinhas.Config
import br.com.fiquemsabendo.figurinhas.data.checklist
import kotlin.math.sqrt
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull
import kotlin.test.assertTrue

// STRUCTURAL tests for the recognizer orchestration (recognizeFrameInOrder). Real sticker frames
// are NOT available in the JVM unit suite, so we exercise the control flow on synthetic frames and
// a tiny in-memory atlas, and assert the SEAM behaviour (no slow fallback yet) plus the bounds
// (MAX_BOXES, crop counting). End-to-end resolution against a real pill is validated LIVE on the
// device (see CLAUDE.md "Live test over adb") — these tests guard the wiring, not the OCR accuracy.
class RecognizePipelineTest {

    private val card = 200 // light card background
    private val ink = 40 // dark pill body

    // ---- atlas / engine helpers ---------------------------------------------------------

    /** L2-normalize a FloatArray in place (templates must be unit length so the dot product is
     *  the cosine, exactly as glyphFeature does). Mirrors GlyphEngineTest's helper. */
    private fun normalize(v: FloatArray): FloatArray {
        var n = 0f
        for (f in v) n += f * f
        n = sqrt(n).let { if (it != 0f) it else 1f }
        for (i in v.indices) v[i] /= n
        return v
    }

    /** A one-hot FEAT_LEN vector with `mag` at `axis`, normalized — near-orthogonal templates. */
    private fun axisFeat(axis: Int, mag: Float = 1f): FloatArray {
        val v = FloatArray(FEAT_LEN)
        v[axis] = mag
        return normalize(v)
    }

    /** Build a FlatAtlas from (label, feat) templates; feats must already be normalized. */
    private fun atlasOf(vararg templates: Pair<Char, FloatArray>): FlatAtlas {
        val count = templates.size
        val feats = FloatArray(count * FEAT_LEN)
        val isDigit = BooleanArray(count)
        val labels = CharArray(count)
        for (t in templates.indices) {
            val (lab, f) = templates[t]
            System.arraycopy(f, 0, feats, t * FEAT_LEN, FEAT_LEN)
            labels[t] = lab
            isDigit[t] = lab in '0'..'9'
        }
        return FlatAtlas(feats, count, isDigit, labels)
    }

    /** A couple of L2-normalized templates → GlyphRecognizer → GlyphOnlyRecognizer. */
    private fun glyphOnlyEngine(): GlyphOnlyRecognizer {
        val atlas = atlasOf('C' to axisFeat(0), '1' to axisFeat(100))
        return GlyphOnlyRecognizer(GlyphRecognizer(atlas))
    }

    private class EmptyFastEngine : FrameRecognizer {
        override fun recognizeFast(crops: List<GrayImage>): List<OcrResult> =
            crops.map { OcrResult("", 0.0) }

        override fun recognizeSlow(crops: List<GrayImage>): List<OcrResult>? = null

        override val fastConf: Double = Config.Ocr.HYBRID_FAST_CONF

        override val hasSlowFallback: Boolean = false
    }

    private class ConstantCodeEngine(private val text: String) : FrameRecognizer {
        override fun recognizeFast(crops: List<GrayImage>): List<OcrResult> =
            crops.map { OcrResult(text, 95.0) }

        override fun recognizeSlow(crops: List<GrayImage>): List<OcrResult>? = null

        override val fastConf: Double = Config.Ocr.HYBRID_FAST_CONF

        override val hasSlowFallback: Boolean = false
    }

    /** Paint a dark pill (x0..x1, y0..y1) with a few LIGHT vertical "glyph" bars knocked out of
     *  it into an existing card frame's pixel array. prepForOcr inverts the light text to ink, so
     *  a pill WITH bars survives the cropHasOcrInk gate and dispatches an OCR job (a solid bar with
     *  no text prepares to all-white and is skipped — see LocateTest). */
    private fun paintInkedPill(px: IntArray, w: Int, x0: Int, y0: Int, x1: Int, y1: Int) {
        for (y in y0..y1) for (x in x0..x1) px[y * w + x] = ink
        // Knockout bars spaced across the pill interior (light = becomes ink after invert).
        var bar = x0 + 8
        while (bar + 6 <= x1 - 8) {
            for (y in (y0 + 6)..(y1 - 6)) for (x in bar until bar + 6) px[y * w + x] = card
            bar += 20
        }
    }

    /** A card frame holding one inked pill (dark pill with knockout glyph bars) at the given box. */
    private fun inkedPillFrame(w: Int, h: Int, x0: Int, y0: Int, x1: Int, y1: Int): GrayImage {
        val px = IntArray(w * h) { card }
        paintInkedPill(px, w, x0, y0, x1, y1)
        return GrayImage(w, h, px)
    }

    // ---- the GlyphOnlyRecognizer seam ---------------------------------------------------

    @Test fun glyphOnlyRecognizer_has_no_slow_fallback_and_the_glyph_fast_conf() {
        val engine = glyphOnlyEngine()
        // The Tesseract seam is not wired yet: recognizeSlow returns null for any input.
        assertNull(engine.recognizeSlow(emptyList()), "no slow fallback yet → null")
        assertNull(engine.recognizeSlow(listOf(GrayImage.filled(40, 24))), "null even with crops")
        // fastConf is the glyph accept floor from Config (HYBRID_FAST_CONF == 70.0).
        assertEquals(70.0, engine.fastConf)
        assertEquals(Config.Ocr.HYBRID_FAST_CONF, engine.fastConf)
    }

    @Test fun glyphOnlyRecognizer_fast_path_maps_the_glyph_recognizer() {
        val engine = glyphOnlyEngine()
        // Blank crops → glyph engine returns empty reads; one OcrResult per crop.
        val results = engine.recognizeFast(listOf(GrayImage.filled(40, 24), GrayImage.filled(30, 20)))
        assertEquals(2, results.size)
        for (r in results) {
            assertEquals("", r.text)
            assertEquals(0.0, r.confidence)
        }
    }

    // ---- recognizeFrameInOrder on a BLANK frame -----------------------------------------

    @Test fun blank_light_frame_resolves_nothing_and_does_not_throw() {
        val engine = glyphOnlyEngine()
        // A uniform light frame holds no pill → no boxes (or no ink) → nothing to resolve.
        val blank = GrayImage.filled(400, 300, card)
        val out = recognizeFrameInOrder(engine, blank, checklist, stopOnFirstCode = true)
        assertTrue(out.resolved.isEmpty(), "a blank frame resolves no codes, got ${out.resolved}")
        // No pill → no boxes → zero crops dispatched.
        assertEquals(0, out.crops, "no boxes → no OCR crops")
        assertTrue(out.reads.isEmpty(), "no crops → no reads")
    }

    @Test fun blank_frame_value_200_as_in_the_spec_resolves_nothing() {
        // The spec's exact construction: a 400x300 frame filled with 200.
        val engine = glyphOnlyEngine()
        val out = recognizeFrameInOrder(engine, GrayImage.filled(400, 300, 200), checklist, true)
        assertTrue(out.resolved.isEmpty())
        assertEquals(0, out.crops)
    }

    @Test fun onDetected_is_invoked_once_after_detection() {
        val engine = glyphOnlyEngine()
        var calls = 0
        recognizeFrameInOrder(
            engine = engine,
            frame = GrayImage.filled(400, 300, card),
            checklist = checklist,
            stopOnFirstCode = true,
            onDetected = { calls++ },
        )
        assertEquals(1, calls, "onDetected fires exactly once, right after findCodeBoxes")
    }

    // ---- recognizeFrameInOrder on a synthetic pill --------------------------------------

    @Test fun a_synthetic_pill_runs_the_pipeline_dispatches_crops_and_returns_a_valid_list() {
        // One dark elongated pill (120x40, AR 3:1) WITH knockout glyph bars, low in a 600x800 card
        // so it lands in the ROI bottom band and findCodeBoxes yields >=1 box. The bars survive the
        // ink gate so an OCR job dispatches, but they won't classify to a real code (our tiny atlas
        // has only C and 1), so `resolved` stays empty — that's fine; we assert the ORCHESTRATION
        // ran (a crop was dispatched) and the result shape is valid (no false positive).
        val engine = glyphOnlyEngine()
        val img = inkedPillFrame(600, 800, 240, 600, 359, 639) // 120x40 inked pill in the band

        val out = recognizeFrameInOrder(engine, img, checklist, stopOnFirstCode = true, roi = Roi.FULL)

        assertTrue(out.crops >= 1, "a detected pill must dispatch at least one OCR crop, got ${out.crops}")
        // resolved is a real list (possibly empty); no false positive is manufactured.
        assertTrue(out.resolved.isEmpty(), "a synthetic bar must NOT resolve a real code (0-FP), got ${out.resolved}")
        // crops stays bounded: at most MAX_BOXES (4) boxes × 2 round variants = 8.
        assertTrue(out.crops <= 8, "crops should stay bounded for one pill, got ${out.crops}")
    }

    @Test fun recall_mode_also_runs_and_stays_bounded() {
        // !stopOnFirstCode (recall mode) takes the single-call branch. Same inked pill: assert it
        // runs and returns a valid bounded outcome (no resolve expected from the tiny atlas).
        val engine = glyphOnlyEngine()
        val img = inkedPillFrame(600, 800, 240, 600, 359, 639)

        val out = recognizeFrameInOrder(engine, img, checklist, stopOnFirstCode = false, roi = Roi.FULL)

        assertTrue(out.crops >= 1, "recall mode must dispatch crops for a detected pill, got ${out.crops}")
        assertTrue(out.resolved.isEmpty(), "0-FP: a synthetic bar resolves nothing")
        assertTrue(out.crops <= 8, "crops bounded by MAX_BOXES × 2 rounds, got ${out.crops}")
    }

    // ---- MAX_BOXES is respected ---------------------------------------------------------

    @Test fun many_blobs_keep_the_crop_count_bounded() {
        // A frame littered with many inked elongated pills in the bottom band. findCodeBoxes returns
        // them best-first; recognizeFrameInOrder OCRs at most MAX_BOXES (4) of them. With each box
        // having up to 2 round variants, the crop count must stay <= 8 regardless of how many blobs
        // were painted — that is MAX_BOXES doing its job (without the cap, 8 inked pills would
        // dispatch far more). Tolerant upper bound.
        val engine = glyphOnlyEngine()
        val px = IntArray(600 * 800) { card }
        // 8 disjoint 120x40 inked pills spread across the bottom band (rows >= 0.67*800 = 536).
        var y = 560
        for (row in 0 until 4) {
            paintInkedPill(px, 600, 40, y, 159, y + 39)
            paintInkedPill(px, 600, 360, y, 479, y + 39)
            y += 56
        }
        val img = GrayImage(600, 800, px)

        val out = recognizeFrameInOrder(engine, img, checklist, stopOnFirstCode = false, roi = Roi.FULL)

        assertTrue(out.crops <= 8, "MAX_BOXES caps the OCR work; expected <= 8 crops, got ${out.crops}")
        assertTrue(out.resolved.isEmpty(), "synthetic bars resolve no real code")
    }

    @Test fun blank_fast_read_without_slow_fallback_skips_flip_and_retry_rounds() {
        val frame = inkedPillFrame(220, 160, 50, 60, 169, 99)
        val box = CodeBox(
            x = 50.0,
            y = 60.0,
            w = 120.0,
            h = 40.0,
            orient = 'h',
            score = 0.88,
            tilt = null,
            pillW = 40.0,
            fill = 0.72,
            boost = true,
        )

        val out = recognizeFrameInOrder(
            engine = EmptyFastEngine(),
            frame = frame,
            checklist = checklist,
            boxes = listOf(box),
            stopOnFirstCode = true,
            maxBoxes = 1,
        )

        assertEquals(1, out.crops, "empty fast read with no slow fallback should not pay flip/retry rounds")
        assertTrue(out.resolved.isEmpty())
    }

    @Test fun live_ocr_skips_vertical_candidates_when_user_holds_sticker_horizontal() {
        val frame = inkedPillFrame(220, 160, 50, 60, 169, 99)
        val verticalFragment = CodeBox(
            x = 10.0,
            y = 10.0,
            w = 24.0,
            h = 96.0,
            orient = 'v',
            score = 0.90,
            tilt = null,
            pillW = 24.0,
            fill = 0.72,
            boost = true,
        )
        val horizontalPill = CodeBox(
            x = 50.0,
            y = 60.0,
            w = 120.0,
            h = 40.0,
            orient = 'h',
            score = 0.80,
            tilt = null,
            pillW = 40.0,
            fill = 0.72,
            boost = true,
        )

        val out = recognizeFrameInOrder(
            engine = EmptyFastEngine(),
            frame = frame,
            checklist = checklist,
            boxes = listOf(verticalFragment, horizontalPill),
            stopOnFirstCode = true,
            maxBoxes = 2,
            allowReticleRescue = false,
        )

        assertEquals(1, out.boxes, "live OCR should ignore vertical fragments before dispatching crops")
        assertEquals(1, out.crops, "only the horizontal pill should reach OCR")
        assertTrue(out.resolved.isEmpty())
    }

    @Test fun live_ocr_synthesizes_header_candidates_from_small_fragments() {
        val w = 420
        val h = 360
        val px = IntArray(w * h) { card }
        paintInkedPill(px, w, 245, 250, 325, 275)
        val frame = GrayImage(w, h, px)
        val fragments = listOf(
            CodeBox(126.0, 260.9, 38.2, 11.6, 'h', 0.598, null, 8.8, 0.87, false),
            CodeBox(166.0, 263.6, 22.2, 10.7, 'h', 0.727, null, 8.7, 0.86, true),
            CodeBox(190.0, 266.2, 41.8, 12.4, 'h', 0.508, null, 8.7, 0.89, false),
        )

        val out = recognizeFrameInOrder(
            engine = ConstantCodeEngine("NOR 20"),
            frame = frame,
            checklist = checklist,
            boxes = fragments,
            stopOnFirstCode = true,
            maxBoxes = 2,
        )

        assertEquals(listOf("NOR20"), out.resolved.mapNotNull { it.entry?.code })
        assertEquals(1, out.crops, "synthetic header candidate should resolve before fragment crops")
    }

    @Test fun live_ocr_synthesizes_a_compact_header_candidate_from_sloped_fragments() {
        val w = 420
        val h = 360
        val px = IntArray(w * h) { card }
        paintInkedPill(px, w, 220, 250, 295, 276)
        val frame = GrayImage(w, h, px)
        val fragments = listOf(
            CodeBox(103.8, 291.1, 21.3, 9.8, 'h', 0.758, 5.3, 8.4, 0.85, false),
            CodeBox(126.0, 286.7, 34.7, 10.7, 'h', 0.593, null, 8.6, 0.86, false),
            CodeBox(183.8, 280.4, 35.6, 11.6, 'h', 0.550, null, 8.7, 0.86, false),
        )

        val out = recognizeFrameInOrder(
            engine = ConstantCodeEngine("GHA 19"),
            frame = frame,
            checklist = checklist,
            boxes = fragments,
            stopOnFirstCode = true,
            maxBoxes = 2,
        )

        assertEquals(listOf("GHA19"), out.resolved.mapNotNull { it.entry?.code })
        assertEquals(1, out.crops, "compact synthetic candidate should resolve before noisy fragments")
    }

    @Test fun live_ocr_reaches_a_late_thin_wide_candidate_after_small_fragments() {
        val w = 420
        val h = 360
        val px = IntArray(w * h) { card }
        paintInkedPill(px, w, 176, 250, 322, 286)
        val frame = GrayImage(w, h, px)
        val boxes = listOf(
            CodeBox(350.0, 294.0, 44.0, 17.0, 'h', 0.806, null, 8.7, 0.86, false),
            CodeBox(86.0, 241.0, 51.0, 16.0, 'h', 0.734, null, 8.8, 0.87, false),
            CodeBox(151.0, 262.0, 23.0, 9.0, 'h', 0.727, null, 8.7, 0.86, false),
            CodeBox(176.0, 250.0, 147.0, 36.0, 'h', 0.520, null, 9.0, 0.86, false),
        )

        val out = recognizeFrameInOrder(
            engine = EmptyFastEngine(),
            frame = frame,
            checklist = checklist,
            boxes = boxes,
            stopOnFirstCode = true,
            maxBoxes = 2,
        )

        assertEquals(3, out.boxes, "late thin wide candidate should be added after the two fragments")
        assertEquals(1, out.crops, "the inked late candidate should reach OCR")
        assertTrue(out.resolved.isEmpty(), "empty OCR engine must not resolve a code")
    }

    @Test fun live_ocr_uses_a_general_horizontal_reticle_window_after_fragment_miss() {
        val w = 480
        val h = 640
        val px = IntArray(w * h) { card }
        paintInkedPill(px, w, 190, 260, 309, 297)
        val frame = GrayImage(w, h, px)
        val fragment = CodeBox(
            x = 90.0,
            y = 268.0,
            w = 28.0,
            h = 10.0,
            orient = 'h',
            score = 0.72,
            tilt = null,
            pillW = 9.0,
            fill = 0.86,
            boost = false,
        )

        val out = recognizeFrameInOrder(
            engine = ConstantCodeEngine("NOR 20"),
            frame = frame,
            checklist = checklist,
            boxes = listOf(fragment),
            stopOnFirstCode = true,
            maxBoxes = 1,
        )

        assertEquals(listOf("NOR20"), out.resolved.mapNotNull { it.entry?.code })
        assertEquals(1, out.crops, "the generic reticle window should be the first inked OCR crop")
    }
}
