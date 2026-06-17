package br.com.fiquemsabendo.figurinhas.ocr

import kotlin.math.sqrt
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class GlyphEngineTest {

    // ---- helpers ------------------------------------------------------------------------

    /** L2-normalize a FloatArray in place and return it (templates + glyph feats must be unit
     *  length for the dot product to be the cosine, exactly as glyphFeature does). */
    private fun normalize(v: FloatArray): FloatArray {
        var n = 0f
        for (f in v) n += f * f
        n = sqrt(n).let { if (it != 0f) it else 1f }
        for (i in v.indices) v[i] /= n
        return v
    }

    /** A one-hot-ish FEAT_LEN vector with `mag` placed at `axis`, normalized. Distinct axes
     *  give near-orthogonal templates so a glyph aimed at one axis classifies unambiguously. */
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

    /** A GlyphBox whose feature vector is `feat` (the rest is positional padding). */
    private fun glyphWith(feat: FloatArray): GlyphBox =
        GlyphBox(x = 0, y = 0, w = 10, h = 18, area = 100, feat = feat, ar = 1.8f, holes = 0)

    /** A confident in-class Classified: best == label at `score`, runner-up digit far below so
     *  digits are decisive. For a letter, bestDigit is set low; for a digit, bestLetter low. */
    private fun classifiedLetter(label: Char, score: Double): Classified =
        Classified(
            label = label,
            score = score,
            bestLetter = LabelScore(label, score),
            bestDigit = LabelScore('5', 0.30),
            secondDigitScore = 0.10,
        )

    /** A confident, DECISIVE digit: bestDigit beats secondDigit by >> DIGIT_MARGIN. */
    private fun classifiedDigit(label: Char, score: Double, second: Double = 0.10, holes: Int = 0): Classified =
        Classified(
            label = label,
            score = score,
            bestLetter = LabelScore('O', 0.30),
            bestDigit = LabelScore(label, score),
            secondDigitScore = second,
            holes = holes,
        )

    // ---- classify -----------------------------------------------------------------------

    @Test fun classify_picks_the_nearest_template_and_tracks_in_class_bests() {
        // 'C' on axis 0 (letter), '1' on axis 100 (digit) — near-orthogonal.
        val atlas = atlasOf('C' to axisFeat(0), '1' to axisFeat(100))

        val cGlyph = glyphWith(axisFeat(0))
        val c = classify(cGlyph, atlas)
        assertEquals('C', c.label, "glyph on the 'C' axis must classify as C")
        assertEquals('C', c.bestLetter.label, "best LETTER must be C")
        assertEquals('1', c.bestDigit.label, "best DIGIT must be the only digit, 1")
        // bestLetter ~ 1.0 (self dot product), bestDigit ~ 0 (orthogonal).
        assertTrue(c.bestLetter.score > 0.99, "C self-match ~1.0, got ${c.bestLetter.score}")
        assertTrue(c.bestDigit.score < 0.01, "C vs digit ~0, got ${c.bestDigit.score}")

        val dGlyph = glyphWith(axisFeat(100))
        val d = classify(dGlyph, atlas)
        assertEquals('1', d.label, "glyph on the '1' axis must classify as 1")
        assertEquals('1', d.bestDigit.label)
        assertEquals('C', d.bestLetter.label)
        assertTrue(d.bestDigit.score > 0.99)
    }

    @Test fun classify_tracks_second_best_digit_via_bd2_demotion() {
        // Three digits at descending similarity to a glyph aimed at the '4' axis. bd2 must hold
        // the runner-up digit's score (the bd2-demotion path), not -1.
        val atlas = atlasOf(
            '4' to axisFeat(0),
            // '6' shares some of axis 0 -> moderate similarity to the glyph.
            '6' to normalize(FloatArray(FEAT_LEN).also { it[0] = 0.6f; it[1] = 0.8f }),
            // '8' mostly off-axis -> low similarity.
            '8' to normalize(FloatArray(FEAT_LEN).also { it[0] = 0.2f; it[2] = 0.98f }),
        )
        val glyph = glyphWith(axisFeat(0))
        val r = classify(glyph, atlas)
        assertEquals('4', r.bestDigit.label, "closest digit is 4")
        // secondDigitScore must equal the 6-vs-glyph cosine (~0.6), proving demotion ran.
        assertTrue(
            r.secondDigitScore in 0.5..0.7,
            "second-best digit score should be ~0.6 (the 6), got ${r.secondDigitScore}",
        )
        assertTrue(r.bestDigit.score > r.secondDigitScore, "best digit must beat the runner-up")
    }

    // ---- assemble -----------------------------------------------------------------------

    @Test fun assemble_reads_CIV_12_with_a_space_and_no_reject() {
        // 3 confident letters then 2 confident decisive digits -> "CIV 12".
        val list = listOf(
            classifiedLetter('C', 0.95),
            classifiedLetter('I', 0.93),
            classifiedLetter('V', 0.94),
            classifiedDigit('1', 0.96),
            classifiedDigit('2', 0.95),
        )
        val (text, conf, reject) = assemble(list)
        assertEquals("CIV 12", text)
        assertFalse(reject, "all glyphs confident + decisive -> no reject")
        assertTrue(conf > 0, "confidence must be positive, got $conf")
    }

    @Test fun assemble_coerces_a_digit_lookalike_in_the_letter_run_to_its_letter_twin() {
        // The label of the 2nd glyph is the digit '1' (an O/0, I/1 lookalike) but it sits in
        // the letter run, so it must coerce to 'I' via DIGIT_TO_LETTER.
        val lookalike = Classified(
            label = '1',
            score = 0.92,
            bestLetter = LabelScore('I', 0.90),
            bestDigit = LabelScore('1', 0.92),
            secondDigitScore = 0.10,
        )
        val list = listOf(
            classifiedLetter('C', 0.95),
            lookalike,
            classifiedLetter('V', 0.94),
            classifiedDigit('1', 0.96),
            classifiedDigit('2', 0.95),
        )
        val (text, _, reject) = assemble(list)
        assertEquals("CIV 12", text, "the '1' in the letter run must coerce to 'I'")
        assertFalse(reject)
    }

    @Test fun assemble_coerces_counterless_letter_O_to_C() {
        val counterlessO = Classified(
            label = 'O',
            score = 0.82,
            bestLetter = LabelScore('O', 0.82),
            bestDigit = LabelScore('0', 0.78),
            secondDigitScore = 0.70,
            holes = 0,
        )
        val list = listOf(
            counterlessO,
            classifiedLetter('V', 0.94),
            classifiedDigit('4', 0.98),
        )
        val (text, _, reject) = assemble(list)
        assertEquals("CV 4", text)
        assertFalse(reject)
    }

    @Test fun assemble_rejects_an_ambiguous_digit_below_the_margin() {
        // A digit whose runner-up is within DIGIT_MARGIN and which is below DIGIT_STRONG ->
        // not decisive -> whole-crop reject.
        val ambiguous = Classified(
            label = '4',
            score = 0.80,
            bestLetter = LabelScore('A', 0.72),
            bestDigit = LabelScore('4', 0.80),
            secondDigitScore = 0.77, // margin 0.03 < DIGIT_MARGIN, and 0.80 < DIGIT_STRONG
        )
        val list = listOf(
            classifiedLetter('E', 0.95),
            classifiedLetter('G', 0.93),
            classifiedLetter('Y', 0.94),
            ambiguous,
        )
        val (_, _, reject) = assemble(list)
        assertTrue(reject, "a digit within DIGIT_MARGIN and below DIGIT_STRONG must reject")
    }

    @Test fun assemble_accepts_two_hole_zero_when_zero_still_wins() {
        val twoHoleZero = Classified(
            label = '0',
            score = 0.919959,
            bestLetter = LabelScore('O', 0.902532),
            bestDigit = LabelScore('0', 0.919959),
            secondDigitScore = 0.897755,
            holes = 2,
        )
        val list = listOf(
            classifiedLetter('N', 0.90),
            Classified(
                label = 'O',
                score = 0.92,
                bestLetter = LabelScore('O', 0.92),
                bestDigit = LabelScore('0', 0.84),
                secondDigitScore = 0.10,
                holes = 1,
            ),
            classifiedLetter('R', 0.91),
            classifiedDigit('2', 0.932089, second = 0.877189),
            twoHoleZero,
        )

        val (text, _, reject) = assemble(list)

        assertFalse(reject)
        assertEquals("NOR 20", text)
    }

    @Test fun assemble_rejects_two_hole_zero_without_margin() {
        val tiedZero = Classified(
            label = '0',
            score = 0.919959,
            bestLetter = LabelScore('O', 0.918000),
            bestDigit = LabelScore('0', 0.919959),
            secondDigitScore = 0.918500,
            holes = 2,
        )
        val list = listOf(
            classifiedLetter('N', 0.90),
            Classified(
                label = 'O',
                score = 0.92,
                bestLetter = LabelScore('O', 0.92),
                bestDigit = LabelScore('0', 0.84),
                secondDigitScore = 0.10,
                holes = 1,
            ),
            classifiedLetter('R', 0.91),
            classifiedDigit('2', 0.932089, second = 0.877189),
            tiedZero,
        )

        val (_, _, reject) = assemble(list)

        assertTrue(reject, "two-hole zero rescue still needs separation from letter and runner-up")
    }

    @Test fun assemble_does_not_reject_a_near_exact_digit_even_with_a_close_runner_up() {
        // The strong clause: bestDigit >= DIGIT_STRONG commits even if the margin is tiny.
        val strongButClose = Classified(
            label = '4',
            score = 0.98,
            bestLetter = LabelScore('A', 0.30),
            bestDigit = LabelScore('4', 0.98), // >= DIGIT_STRONG (0.97)
            secondDigitScore = 0.97, // margin 0.01 < DIGIT_MARGIN but strong clause saves it
        )
        val list = listOf(
            classifiedLetter('E', 0.95),
            classifiedLetter('G', 0.93),
            classifiedLetter('Y', 0.94),
            strongButClose,
        )
        val (text, _, reject) = assemble(list)
        assertFalse(reject, "a near-exact digit (>= DIGIT_STRONG) must commit despite a close runner-up")
        assertEquals("EGY 4", text)
    }

    @Test fun assemble_keeps_one_hole_8_vs_5_ambiguous_by_default() {
        val ambiguous = Classified(
            label = '8',
            score = 0.94,
            bestLetter = LabelScore('B', 0.88),
            bestDigit = LabelScore('8', 0.94),
            secondDigitScore = 0.923,
            secondDigitLabel = '5',
            holes = 1,
        )
        val list = listOf(
            classifiedLetter('M', 0.95),
            classifiedLetter('E', 0.93),
            classifiedLetter('X', 0.94),
            classifiedDigit('1', 0.96),
            ambiguous,
        )

        val (_, _, reject) = assemble(list)

        assertTrue(reject, "normal OCR must keep a one-hole 8/5 tie as a miss")
    }

    @Test fun assemble_one_hole_8_vs_5_rescue_is_opt_in() {
        val ambiguous = Classified(
            label = '8',
            score = 0.94,
            bestLetter = LabelScore('B', 0.88),
            bestDigit = LabelScore('8', 0.94),
            secondDigitScore = 0.923,
            secondDigitLabel = '5',
            holes = 1,
        )
        val list = listOf(
            classifiedLetter('M', 0.95),
            classifiedLetter('E', 0.93),
            classifiedLetter('X', 0.94),
            classifiedDigit('1', 0.96),
            ambiguous,
        )

        val (text, _, reject) = assemble(list, allowOneHoleFiveRescue = true)

        assertFalse(reject)
        assertEquals("MEX 15", text)
    }

    @Test fun assemble_accepts_a_strong_one_hole_digit_when_the_letter_score_is_lower() {
        // Pixel crops can make 6/9/0 tie with each other while still showing one enclosed hole
        // and clearly beating the best letter. This should commit; a letter-like tie should not.
        val strongOneHole = Classified(
            label = '6',
            score = 0.94,
            bestLetter = LabelScore('B', 0.90),
            bestDigit = LabelScore('6', 0.94),
            secondDigitScore = 0.94,
            holes = 1,
        )
        val list = listOf(
            classifiedLetter('R', 0.95),
            classifiedLetter('S', 0.93),
            classifiedLetter('A', 0.94),
            strongOneHole,
        )
        val (text, _, reject) = assemble(list)
        assertFalse(reject, "a strong one-hole digit with lower letter score should commit")
        assertEquals("RSA 6", text)
    }

    @Test fun assemble_rejects_a_low_cosine_glyph() {
        // A glyph whose max(bestLetter, bestDigit) < MIN_GLYPH_COS is noise -> reject.
        val noise = Classified(
            label = 'C',
            score = 0.55,
            bestLetter = LabelScore('C', 0.55), // < MIN_GLYPH_COS (0.7)
            bestDigit = LabelScore('5', 0.40), // < MIN_GLYPH_COS
            secondDigitScore = 0.10,
        )
        val list = listOf(
            noise,
            classifiedLetter('I', 0.93),
            classifiedLetter('V', 0.94),
            classifiedDigit('1', 0.96),
            classifiedDigit('2', 0.95),
        )
        val (_, _, reject) = assemble(list)
        assertTrue(reject, "a glyph below MIN_GLYPH_COS in both classes must reject the crop")
    }

    // ---- rejectSentinel -----------------------------------------------------------------

    @Test fun rejectSentinel_blanks_digits_to_X_but_keeps_a_letter_stem() {
        // From the task spec: rejectSentinel("CIV12") -> "CIVXX" (letters kept, digits -> X).
        assertEquals("CIVXX", rejectSentinel("CIV12"))
    }

    @Test fun rejectSentinel_keeps_the_space_when_present_in_the_input() {
        // Faithful to the TS: only \d -> X; other chars (incl. space) pass through, and a [A-Z]
        // presence is what keeps the stem (the assembled token has a boundary space).
        assertEquals("CIV XX", rejectSentinel("CIV 12"))
    }

    @Test fun rejectSentinel_all_digits_becomes_all_X_which_IS_a_letter_class() {
        // EXACT TS behavior: digits -> 'X' FIRST, then the [A-Z] test runs on the result. Since
        // 'X' itself matches [A-Z], an all-digit input -> "XX..." DOES contain a letter and is
        // returned as-is. The "X" fallback only fires when the result has NO [A-Z] at all.
        assertEquals("XX", rejectSentinel("12"))
        assertEquals("X", rejectSentinel("0")) // single digit -> "X", which is also the fallback
    }

    @Test fun rejectSentinel_returns_X_when_the_result_has_no_letter() {
        // No digits, no letters -> no [A-Z] match -> "X" fallback.
        assertEquals("X", rejectSentinel(""))
        assertEquals("X", rejectSentinel(" ")) // a lone space: no \d, no [A-Z] -> "X"
    }

    // ---- recognizeCrop ------------------------------------------------------------------

    @Test fun recognizeCrop_on_a_blank_image_returns_empty_too_few_glyphs() {
        val atlas = atlasOf('C' to axisFeat(0), '1' to axisFeat(100))
        val blank = GrayImage.filled(40, 24) // all white -> no ink -> 0 glyphs
        val r = recognizeCrop(blank, atlas)
        assertEquals("", r.text)
        assertEquals(0.0, r.confidence)
    }

    @Test fun recognizer_wrapper_maps_recognizeMany_over_crops() {
        val atlas = atlasOf('C' to axisFeat(0), '1' to axisFeat(100))
        val rec = GlyphRecognizer(atlas)
        val crops = listOf(GrayImage.filled(40, 24), GrayImage.filled(30, 20))
        val results = rec.recognizeMany(crops)
        assertEquals(2, results.size)
        for (res in results) {
            assertEquals("", res.text)
            assertEquals(0.0, res.confidence)
        }
    }
}
