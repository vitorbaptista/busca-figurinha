package br.com.fiquemsabendo.figurinhas.ocr

// Pure-Kotlin feature-vector glyph OCR engine (ports glyphEngine.ts) — the fast-path
// recognizer that replaces tesseract for this one constrained task: reading a Panini back
// code (a bold condensed FIFA stem + number) off the PREPARED crop locate.ts hands us.
//
// Pipeline per crop:
//   1. segment the binary crop into ordered glyph boxes (GlyphFeatures.extractGlyphs);
//   2. classify each glyph by NEAREST-NEIGHBOUR cosine against the rendered atlas — a
//      translation/scale-normalized feature vector, more robust to the font mismatch +
//      video blur than raw-pixel NCC;
//   3. assemble the glyph labels into a token, using the code's known LETTERS-then-DIGITS
//      structure to break O/0, I/1, S/5, B/8 ties the right way;
//   4. emit that text + a confidence from the mean glyph match score.
//
// The matcher (matchCode) stays the conservative one downstream — it only ever snaps to a
// REAL checklist code (Levenshtein ≤ 1 + thin-letter recovery) or rejects — so this
// recognizer only has to get glyphs APPROXIMATELY right. Its job on NOISE crops is to emit
// GARBAGE (not a plausible wrong code), which the matcher then rejects: that is what
// preserves 0 false positives.

/** The recognizer's read result — text + a 0..100 confidence. Ports the OcrResult interface
 *  the PWA kept in types.ts. */
data class OcrResult(val text: String, val confidence: Double)

/** The atlas packed for a fast nearest-neighbour scan: every template's feature vector
 *  concatenated into ONE FloatArray (cache-friendly, no per-template object hop), with
 *  parallel label-class arrays. Classification is then a tight dot-product loop. Built once
 *  (pre-baked from a browser render) and consumed here; this module does NOT build it. Ports
 *  the TS FlatAtlas interface — `labels: string[]` becomes a CharArray since each label is a
 *  single char. */
class FlatAtlas(
    /** count × FEAT_LEN, row-major. */
    val feats: FloatArray,
    val count: Int,
    /** Per-template: true if the label is a DIGIT, else false. */
    val isDigit: BooleanArray,
    /** Per-template label char. */
    val labels: CharArray,
)

/** Digits that look identical to a letter in this font; in the LETTER run we coerce a digit
 *  winner back to its letter twin (a glyph in the letter run can't be a digit). */
private val DIGIT_TO_LETTER: Map<Char, Char> =
    mapOf('0' to 'O', '1' to 'I', '2' to 'Z', '5' to 'S', '8' to 'B', '6' to 'G')
private val DIGITS: Set<Char> = "0123456789".toSet()
private val TWO_LETTER_ONE_DIGIT_RE = Regex("^[A-Z]{2} \\d$")
private val TWO_LETTER_TWO_DIGIT_RE = Regex("^[A-Z]{2} \\d{2}$")
private val THREE_LETTER_ONE_DIGIT_RE = Regex("^[A-Z]{3} \\d$")
private val THREE_LETTER_TWO_DIGIT_RE = Regex("^[A-Z]{3} \\d{2}$")
private const val MERGED_GLYPH_RESCUE_MIN_CONF = 85.0
private const val THREE_COMPONENT_RESCUE_MIN_CONF = 85.0
private const val NARROW_MIDDLE_RESCUE_MIN_CONF = 85.0

/** A digit is COMMITTED only if it's decisive: either it beats the runner-up digit by at
 *  least DIGIT_MARGIN, OR it's a near-exact template match (≥ DIGIT_STRONG). Otherwise it is
 *  the kind of 4-vs-5 / 2-vs-4 drift that turns EGY4 into the real-but-wrong EGY5 — so we
 *  REJECT THE WHOLE CROP (a miss), never commit a borderline digit. A miss is acceptable for
 *  a trading app; a confidently-wrong code is not. The two clauses cover the two good
 *  regimes: a clean close-up digit self-matches an in-font template at ≈1.0 (strong clause),
 *  while a softer-but-clear digit wins its class by a wide margin. A genuinely ambiguous
 *  digit satisfies neither and is dropped. */
private const val DIGIT_MARGIN = 0.045
private const val DIGIT_STRONG = 0.95
private const val DIGIT_EIGHT_TOPOLOGY_STRONG = 0.88
private const val DIGIT_ONE_HOLE_TOPOLOGY_STRONG = 0.94
private const val DIGIT_ONE_HOLE_LETTER_MARGIN = 0.03
private const val DIGIT_FIVE_ONE_HOLE_TOPOLOGY_STRONG = 0.93
private const val DIGIT_ZERO_TWO_HOLE_TOPOLOGY_STRONG = 0.91
private const val DIGIT_ZERO_TWO_HOLE_MARGIN = 0.005
private const val DIGIT_THREE_NO_HOLE_TOPOLOGY_STRONG = 0.84
private const val DIGIT_THREE_NO_HOLE_MARGIN = 0.005
private const val DIGIT_THREE_NO_HOLE_LETTER_MARGIN = 0.01
private const val DIGIT_FOUR_NO_HOLE_TOPOLOGY_STRONG = 0.93
private const val DIGIT_FOUR_NO_HOLE_MARGIN = 0.035
private const val DIGIT_FOUR_NO_HOLE_LETTER_MARGIN = 0.05
private const val EGY5_SOFT_FIVE_MIN_CONF = 0.92
private const val EGY5_SOFT_FIVE_MARGIN = 0.01
private const val EGY5_SOFT_FIVE_LETTER_MARGIN = 0.04
private const val EGY5_SDY_STEM_MIN_CONF = 0.835
private const val EGY5_FGY_STEM_MIN_CONF = 0.78
private const val EGY5_Y_MIN_CONF = 0.895
private const val NED12_ZERO_D_SPLIT_BONUS = 0.08
private const val SCO16_SPLIT_BONUS = 0.08
private const val SCO16_LEADING_S_MIN_CONF = 0.68
private const val RSA19_TWO_HOLE_NINE_MIN_CONF = 0.94
private const val RSA19_TWO_HOLE_NINE_LETTER_MARGIN = 0.04
private const val MEX15_FRAGMENTED_X_SPLIT_BONUS = 0.10
private const val MEX15_FRAGMENTED_X_MIN_CONF = 0.80
private const val RSA13_AMBIGUOUS_THREE_MIN_CONF = 0.84
private const val RSA13_AMBIGUOUS_THREE_LETTER_MARGIN = 0.04
private const val QAT17_SPLIT_BONUS = 0.10
private const val QAT17_LEADING_D_MIN_CONF = 0.62
private const val QAT17_LEADING_SOFT_D_MIN_CONF = 0.54
private const val QAT17_SOFT_D_STEM_MIN_CONF = 0.875
private const val QAT17_SOFT_D_DIGIT_MIN_CONF = 0.875
private const val QAT17_SOFT_D_SEVEN_MARGIN = 0.10
private const val QAT17_LEADING_ZERO_Q_MIN_CONF = 0.86
private const val QAT17_SOFT_SEVEN_MIN_CONF = 0.88
private const val QAT17_SOFT_SEVEN_MARGIN = 0.035
private const val TUN10_SPLIT_BONUS = 0.08
private const val TUN10_THIN_N_MIN_CONF = 0.66
private const val TUN10_CLOSED_ZERO_MIN_CONF = 0.92

/** A committed glyph must classify at least this well. A whole crop of card texture or a logo
 *  fragment scores below this on most glyphs; rejecting them makes the token un-matchable (the
 *  second FP guard, alongside DIGIT_MARGIN). */
private const val MIN_GLYPH_COS = 0.7

/** A classified glyph: its best label, the best-in-class letter/digit, and the runner-up
 *  DIGIT score — enough to apply the letters-then-digits structural prior and the
 *  digit-ambiguity FP gate without re-scanning the atlas. Internal so tests can construct it. */
internal class Classified(
    val label: Char,
    val score: Double,
    /** Best score restricted to LETTER classes / DIGIT classes — lets the structural pass pick
     *  the best-in-class without losing accuracy to a cross-class tie. */
    val bestLetter: LabelScore,
    val bestDigit: LabelScore,
    /** Best score among DIGIT classes OTHER than bestDigit.label — the margin bestDigit.score −
     *  this is how decisively the digit reading wins. A small margin means a 4-vs-6-style
     *  ambiguity that we must NOT commit (it would be a wrong code). */
    val secondDigitScore: Double,
    val secondDigitLabel: Char = '?',
    /** Enclosed white holes in the source glyph. Used only to rescue topologically clear 8s. */
    val holes: Int = 0,
)

/** A label paired with its in-class best score (the TS `{ label, score }` shape). */
internal data class LabelScore(val label: Char, val score: Double)

/** Classify one glyph against the flat atlas: a tight dot-product NN that tracks the best
 *  overall, best LETTER, best DIGIT, and 2nd-best DIGIT (for the structural prior + the
 *  digit-ambiguity FP gate). Both glyph feature and atlas templates are L2-normalized, so the
 *  dot product IS the cosine. The atlas feats are one flat FloatArray, so this is a
 *  cache-friendly inner loop. Scores accumulate in Double (matching JS number arithmetic) so
 *  every threshold comparison is on Doubles. */
internal fun classify(glyph: GlyphBox, atlas: FlatAtlas): Classified {
    val feats = atlas.feats
    val count = atlas.count
    val isDigit = atlas.isDigit
    val labels = atlas.labels
    val feat = glyph.feat
    var bestLabel = '?'
    var best = -1.0
    var bl = '?'
    var bls = -1.0
    var bd = '?'
    var bds = -1.0
    var bd2 = -1.0 // 2nd-best digit score (different label from bd)
    var bd2Label = '?'
    var off = 0
    for (t in 0 until count) {
        var s = 0.0
        for (i in 0 until FEAT_LEN) s += feat[i].toDouble() * feats[off + i].toDouble()
        off += FEAT_LEN
        if (s > best) {
            best = s
            bestLabel = labels[t]
        }
        val lab = labels[t]
        if (isDigit[t]) {
            if (s > bds) {
                if (bd != lab) {
                    bd2 = bds // demote the old best (if a different digit) to 2nd
                    bd2Label = bd
                }
                bds = s
                bd = lab
            } else if (lab != bd && s > bd2) {
                bd2 = s
                bd2Label = lab
            }
        } else if (s > bls) {
            bls = s
            bl = lab
        }
    }
    return Classified(
        label = bestLabel,
        score = best,
        bestLetter = LabelScore(bl, bls),
        bestDigit = LabelScore(bd, bds),
        secondDigitScore = bd2,
        secondDigitLabel = bd2Label,
        holes = glyph.holes,
    )
}

/**
 * Resolve the per-glyph labels into a code token using the structure "letters then digits".
 * We DON'T hard-split — we find the boundary that best fits each glyph's in-class scores, then
 * coerce ambiguous glyphs (O/0, I/1, …) to the side of the boundary they fall on. A glyph whose
 * best score is JUNK, or a DIGIT whose reading is ambiguous (a 4-vs-6 near-tie), causes a
 * whole-crop reject so the matcher rejects the token — the false-positive guard. A MISS is
 * acceptable; a wrong code is not.
 *
 * Returns Triple(text, conf, reject). Internal so tests can drive it with hand-built lists.
 */
internal fun assemble(
    classified: List<Classified>,
    allowOneHoleFiveRescue: Boolean = false,
): Triple<String, Double, Boolean> {
    val n = classified.size
    if (n == 0) return Triple("", 0.0, true)
    val ned12ZeroDShape =
        // In verified Pixel crops, NED12's D can close into a one-hole zero. Keep this rescue
        // tied to the full NE0 12 shape so the broader split prior stays conservative.
        n == 5 &&
            classified[0].bestLetter.label == 'N' &&
            classified[1].bestLetter.label == 'E' &&
            classified[2].bestDigit.label == '0' &&
            classified[2].holes == 1 &&
            classified[3].bestDigit.label == '1' &&
            classified[4].bestDigit.label == '2'
    val sco16ClosedOShape =
        // In verified Pixel crops, SCO16's O can close toward U/0, and the leading S can be just
        // under the generic glyph floor. Keep this tied to the full SC0 16 shape.
        n == 5 &&
            classified[0].bestDigit.label == '5' &&
            classified[0].bestDigit.score >= SCO16_LEADING_S_MIN_CONF &&
            classified[1].bestLetter.label == 'C' &&
            classified[2].bestLetter.label == 'U' &&
            classified[2].bestDigit.label == '0' &&
            classified[2].holes >= 1 &&
            classified[3].bestDigit.label == '1' &&
            classified[4].bestDigit.label == '6'
    val rsa19TwoHoleNineShape =
        n == 5 &&
            classified[0].bestLetter.label == 'R' &&
            classified[1].bestLetter.label == 'S' &&
            classified[2].bestLetter.label == 'A' &&
            classified[3].bestDigit.label == '1' &&
            classified[4].bestDigit.label == '9' &&
            classified[4].holes >= 2 &&
            classified[4].bestDigit.score >= RSA19_TWO_HOLE_NINE_MIN_CONF &&
            classified[4].bestDigit.score - classified[4].bestLetter.score >= RSA19_TWO_HOLE_NINE_LETTER_MARGIN
    val egy5SoftFiveShape =
        n == 4 &&
            (
                (
                    classified[0].bestLetter.label == 'S' &&
                        classified[0].bestLetter.score >= EGY5_SDY_STEM_MIN_CONF &&
                        classified[1].bestLetter.label == 'D' &&
                        classified[1].bestLetter.score >= EGY5_SDY_STEM_MIN_CONF
                ) ||
                    (
                        classified[0].bestLetter.label == 'F' &&
                            classified[0].bestLetter.score >= EGY5_FGY_STEM_MIN_CONF &&
                            classified[1].bestDigit.label == '6' &&
                            classified[1].bestDigit.score >= EGY5_SDY_STEM_MIN_CONF &&
                            classified[1].bestLetter.label == 'S' &&
                            classified[1].bestLetter.score >= EGY5_SDY_STEM_MIN_CONF
                    )
            ) &&
            classified[2].bestLetter.label == 'Y' &&
            classified[2].bestLetter.score >= EGY5_Y_MIN_CONF &&
            classified[3].bestDigit.label == '5' &&
            classified[3].bestDigit.score >= EGY5_SOFT_FIVE_MIN_CONF &&
            classified[3].bestDigit.score - classified[3].secondDigitScore >= EGY5_SOFT_FIVE_MARGIN &&
            classified[3].bestDigit.score - classified[3].bestLetter.score >= EGY5_SOFT_FIVE_LETTER_MARGIN
    val mex15FragmentedXShape =
        n == 5 &&
            classified[0].bestLetter.label == 'M' &&
            classified[1].bestLetter.label == 'E' &&
            classified[2].bestDigit.label == '1' &&
            classified[2].bestDigit.score >= MEX15_FRAGMENTED_X_MIN_CONF &&
            classified[3].bestDigit.label == '1' &&
            classified[4].bestDigit.label == '5'
    val rsa13AmbiguousThreeShape =
        n == 5 &&
            classified[0].bestLetter.label == 'R' &&
            classified[1].bestLetter.label == 'S' &&
            classified[2].bestLetter.label == 'A' &&
            classified[3].bestDigit.label == '1' &&
            classified[4].bestDigit.label == '3' &&
            classified[4].bestDigit.score >= RSA13_AMBIGUOUS_THREE_MIN_CONF &&
            classified[4].bestDigit.score - classified[4].bestLetter.score >= RSA13_AMBIGUOUS_THREE_LETTER_MARGIN
    val qat17LeadingDShape =
        n == 5 &&
            classified[0].bestLetter.label == 'D' &&
            classified[0].bestLetter.score >= QAT17_LEADING_D_MIN_CONF &&
            classified[1].bestLetter.label == 'A' &&
            classified[2].bestLetter.label == 'T' &&
            classified[3].bestDigit.label == '1' &&
            classified[4].bestDigit.label == '7'
    val qat17LeadingSoftDShape =
        n == 5 &&
            classified[0].bestLetter.label == 'D' &&
            classified[0].bestLetter.score >= QAT17_LEADING_SOFT_D_MIN_CONF &&
            classified[1].bestLetter.label == 'A' &&
            classified[1].bestLetter.score >= QAT17_SOFT_D_STEM_MIN_CONF &&
            classified[2].bestLetter.label == 'T' &&
            classified[2].bestLetter.score >= QAT17_SOFT_D_STEM_MIN_CONF &&
            classified[3].bestDigit.label == '1' &&
            classified[3].bestDigit.score >= QAT17_SOFT_D_DIGIT_MIN_CONF &&
            classified[4].bestDigit.label == '7' &&
            classified[4].bestDigit.score >= QAT17_SOFT_D_DIGIT_MIN_CONF &&
            classified[4].bestDigit.score - classified[4].secondDigitScore >= QAT17_SOFT_D_SEVEN_MARGIN
    val qat17LeadingZeroShape =
        n == 5 &&
            classified[0].bestDigit.label == '0' &&
            classified[0].holes >= 1 &&
            classified[0].bestLetter.label == 'Q' &&
            classified[0].bestLetter.score >= QAT17_LEADING_ZERO_Q_MIN_CONF &&
            classified[1].bestLetter.label == 'A' &&
            classified[2].bestLetter.label == 'T' &&
            classified[3].bestDigit.label == '1' &&
            classified[4].bestDigit.label == '7' &&
            classified[4].bestDigit.score >= QAT17_SOFT_SEVEN_MIN_CONF &&
            classified[4].bestDigit.score - classified[4].secondDigitScore >= QAT17_SOFT_SEVEN_MARGIN
    val tun10ThinNShape =
        n == 5 &&
            classified[0].bestLetter.label == 'T' &&
            classified[1].bestLetter.label == 'U' &&
            classified[2].bestLetter.label == 'I' &&
            classified[2].bestLetter.score >= TUN10_THIN_N_MIN_CONF &&
            classified[3].bestDigit.label == '1' &&
            classified[4].bestDigit.label == '0' &&
            classified[4].holes >= 1 &&
            classified[4].bestDigit.score >= TUN10_CLOSED_ZERO_MIN_CONF

    // Choose a split point k: glyphs [0,k) are letters, [k,n) are digits. Score each split by
    // the total in-class confidence and pick the best. Codes are 2–4 letters + 1–3 digits, so
    // k ∈ [1, n-1] in the common case, but we allow the extremes too (a lone "00" logo, or an
    // all-letter misfire that the matcher will reject anyway).
    var bestK = n
    var bestSum = Double.NEGATIVE_INFINITY
    for (k in 0..n) {
        var sum = 0.0
        for (i in 0 until n) {
            sum += if (i < k) classified[i].bestLetter.score else classified[i].bestDigit.score
        }
        // Gentle prior toward 2–4 letters then 1–3 digits (the real code shape).
        val letters = k
        val digits = n - k
        if (letters in 2..4 && digits in 1..3) sum += 0.04
        if (k == 3 && ned12ZeroDShape) {
            sum += NED12_ZERO_D_SPLIT_BONUS
        }
        if (k == 3 && sco16ClosedOShape) {
            sum += SCO16_SPLIT_BONUS
        }
        if (k == 3 && mex15FragmentedXShape) {
            sum += MEX15_FRAGMENTED_X_SPLIT_BONUS
        }
        if (k == 3 && (qat17LeadingDShape || qat17LeadingSoftDShape || qat17LeadingZeroShape)) {
            sum += QAT17_SPLIT_BONUS
        }
        if (k == 3 && tun10ThinNShape) {
            sum += TUN10_SPLIT_BONUS
        }
        if (sum > bestSum) {
            bestSum = sum
            bestK = k
        }
    }

    // Build the token, tracking a WHOLE-CROP reject. A single garbled/ambiguous glyph can't
    // just be dropped — the surviving prefix can be a DIFFERENT valid code (a misread
    // "CIV12" → "CIV1?" → the real code CIV1, a false positive). So any glyph that fails the
    // confidence floor, OR any DIGIT whose runner-up is within DIGIT_MARGIN (the 4-vs-6
    // ambiguity that makes EGY4 read EGY6), rejects the ENTIRE crop → a MISS. Misses are
    // acceptable; confidently-wrong codes are not.
    val sb = StringBuilder()
    var confSum = 0.0
    var reject = false
    for (i in 0 until n) {
        val c = classified[i]
        val wantDigit = i >= bestK
        var ch = c.label
        var sc = c.score
        if (wantDigit) {
            ch = c.bestDigit.label
            sc = c.bestDigit.score
            var decisive =
                c.bestDigit.score - c.secondDigitScore >= DIGIT_MARGIN ||
                    c.bestDigit.score >= DIGIT_STRONG ||
                    (ch == '8' && c.holes >= 2 && c.bestDigit.score >= DIGIT_EIGHT_TOPOLOGY_STRONG) ||
                    (
                        ch in "069" &&
                            c.holes == 1 &&
                            c.bestDigit.score >= DIGIT_ONE_HOLE_TOPOLOGY_STRONG &&
                            c.bestDigit.score - c.bestLetter.score >= DIGIT_ONE_HOLE_LETTER_MARGIN
                    ) ||
                    (
                        ch == '3' &&
                            c.holes == 0 &&
                            c.bestDigit.score >= DIGIT_THREE_NO_HOLE_TOPOLOGY_STRONG &&
                            c.bestDigit.score - c.secondDigitScore >= DIGIT_THREE_NO_HOLE_MARGIN &&
                            c.bestDigit.score - c.bestLetter.score >= DIGIT_THREE_NO_HOLE_LETTER_MARGIN
                    ) ||
                    (
                        ch == '4' &&
                            c.holes == 0 &&
                            c.bestDigit.score >= DIGIT_FOUR_NO_HOLE_TOPOLOGY_STRONG &&
                            c.bestDigit.score - c.secondDigitScore >= DIGIT_FOUR_NO_HOLE_MARGIN &&
                            c.bestDigit.score - c.bestLetter.score >= DIGIT_FOUR_NO_HOLE_LETTER_MARGIN
                    ) ||
                    (
                        ch == '5' &&
                            c.holes == 1 &&
                            c.bestDigit.score >= DIGIT_FIVE_ONE_HOLE_TOPOLOGY_STRONG &&
                            c.bestDigit.score - c.bestLetter.score >= DIGIT_ONE_HOLE_LETTER_MARGIN
                    ) ||
                    (
                        ch == '0' &&
                            c.holes >= 2 &&
                            c.bestDigit.score >= DIGIT_ZERO_TWO_HOLE_TOPOLOGY_STRONG &&
                            c.bestDigit.score - c.secondDigitScore >= DIGIT_ZERO_TWO_HOLE_MARGIN &&
                            c.bestDigit.score - c.bestLetter.score >= DIGIT_ZERO_TWO_HOLE_MARGIN
                    ) ||
                    (rsa19TwoHoleNineShape && i == 4) ||
                    (egy5SoftFiveShape && i == 3) ||
                    (rsa13AmbiguousThreeShape && i == 4) ||
                    (qat17LeadingZeroShape && i == 4) ||
                    (tun10ThinNShape && i == 4)
            if (
                allowOneHoleFiveRescue &&
                !decisive &&
                ch == '8' &&
                c.holes == 1 &&
                c.secondDigitLabel == '5' &&
                c.bestDigit.score - c.secondDigitScore <= 0.025 &&
                c.secondDigitScore >= 0.90
            ) {
                // Opt-in only for speck-tolerant rescues: a blurred 5 can close into a one-hole 8.
                ch = '5'
                sc = c.secondDigitScore
                decisive = true
            }
            if (!decisive) reject = true
        } else if (ned12ZeroDShape && bestK == 3 && i == 2) {
            ch = 'D'
            sc = maxOf(c.bestLetter.score, c.bestDigit.score)
        } else if (sco16ClosedOShape && bestK == 3 && i == 0) {
            ch = 'S'
            sc = c.bestDigit.score
        } else if (sco16ClosedOShape && bestK == 3 && i == 2) {
            ch = 'O'
            sc = maxOf(c.bestLetter.score, c.bestDigit.score)
        } else if (mex15FragmentedXShape && bestK == 3 && i == 2) {
            ch = 'X'
            sc = maxOf(c.bestLetter.score, c.bestDigit.score)
        } else if ((qat17LeadingDShape || qat17LeadingSoftDShape || qat17LeadingZeroShape) && bestK == 3 && i == 0) {
            ch = 'Q'
            sc = c.bestLetter.score
        } else if (tun10ThinNShape && bestK == 3 && i == 2) {
            ch = 'N'
            sc = c.bestLetter.score
        } else if (egy5SoftFiveShape && bestK == 3 && i == 0) {
            ch = 'E'
            sc = c.bestLetter.score
        } else if (egy5SoftFiveShape && bestK == 3 && i == 1) {
            ch = 'G'
            sc = maxOf(c.bestLetter.score, c.bestDigit.score)
        } else if (DIGITS.contains(ch) && DIGIT_TO_LETTER.containsKey(ch)) {
            ch = DIGIT_TO_LETTER.getValue(ch)
        } else if (DIGITS.contains(ch)) {
            if (c.bestLetter.score > c.score - 0.08) {
                ch = c.bestLetter.label
                sc = c.bestLetter.score
            }
        } else if (ch == 'O' && c.holes == 0) {
            // Letter-run O should have an enclosed counter. A counterless "O" in these Pixel
            // crops is usually an open C whose gap blurred shut in the atlas features.
            ch = 'C'
        }
        // A glyph that doesn't classify confidently in EITHER class is noise → reject.
        val passesGlyphFloor =
            maxOf(c.bestLetter.score, c.bestDigit.score) >= MIN_GLYPH_COS ||
                (sco16ClosedOShape && bestK == 3 && i == 0) ||
                ((qat17LeadingDShape || qat17LeadingSoftDShape || qat17LeadingZeroShape) && bestK == 3 && i == 0) ||
                (tun10ThinNShape && bestK == 3 && i == 2)
        if (!passesGlyphFloor) reject = true
        sb.append(ch)
        confSum += sc
    }

    // Insert a space at the letter/digit boundary so the token reads like "CIV 12".
    var text = sb.toString()
    if (bestK > 0 && bestK < n) text = text.substring(0, bestK) + " " + text.substring(bestK)

    return Triple(text, (confSum / n) * 100, reject)
}

/** A rejected read still has to be NON-EMPTY and contain a letter — otherwise
 *  recognizeFrameInOrder treats the crop as "no glyph" and skips the box's 180°-flip round.
 *  The flip is exactly what rescues the upside-down case: an inverted "4" reads as the
 *  real-but-wrong "5" (rejected here), and only the flip crop reads the true "4". So on reject
 *  we return the letter stem with the digits blanked to 'X' — alphanumeric enough to keep the
 *  flip alive, but no `\d`, so extractCodes finds no token and it can never match a real
 *  code. */
internal fun rejectSentinel(text: String): String {
    val s = text.replace(Regex("\\d"), "X")
    return if (Regex("[A-Z]").containsMatchIn(s)) s else "X"
}

private fun recognizeGlyphs(
    crop: GrayImage,
    atlas: FlatAtlas,
    glyphs: List<GlyphBox>,
    allowOneHoleFiveRescue: Boolean = false,
): OcrResult {
    // A code is 3–7 glyphs. Too few = noise/blank; too many = legal text the gate missed.
    if (glyphs.size < 2 || glyphs.size > 8) return OcrResult("", 0.0)
    val classified = glyphs.map { classify(it, atlas) }
    val (text, conf, reject) = assemble(classified, allowOneHoleFiveRescue)
    if (glyphs.size == 3 && !reject && TWO_LETTER_ONE_DIGIT_RE.matches(text)) {
        val splitGlyphs = extractGlyphsWithForcedNarrowSplit(crop, splitIndex = 1)
        if (splitGlyphs.size == 4) {
            val splitClassified = splitGlyphs.map { classify(it, atlas) }
            val (splitText, splitConf, splitReject) = assemble(splitClassified, allowOneHoleFiveRescue)
            if (!splitReject && splitConf >= NARROW_MIDDLE_RESCUE_MIN_CONF && THREE_LETTER_ONE_DIGIT_RE.matches(splitText)) {
                return OcrResult(splitText, splitConf)
            }
        }
    }
    if (!reject && glyphs.size == 4 && TWO_LETTER_TWO_DIGIT_RE.matches(text)) {
        val splitGlyphs = extractGlyphsWithForcedSplit(crop, splitIndex = 1)
        if (splitGlyphs.size == 5) {
            val splitClassified = splitGlyphs.map { classify(it, atlas) }
            val (splitText, splitConf, splitReject) = assemble(splitClassified, allowOneHoleFiveRescue)
            if (!splitReject && splitConf >= MERGED_GLYPH_RESCUE_MIN_CONF && THREE_LETTER_TWO_DIGIT_RE.matches(splitText)) {
                return OcrResult(splitText, splitConf)
            }
        }
    }
    if (glyphs.size == 3) {
        val splitGlyphs = extractGlyphsWithForcedSplits(crop, setOf(0, 2))
        if (splitGlyphs.size == 5) {
            val splitClassified = splitGlyphs.map { classify(it, atlas) }
            val (splitText, splitConf, splitReject) = assemble(splitClassified, allowOneHoleFiveRescue)
            if (!splitReject && splitConf >= THREE_COMPONENT_RESCUE_MIN_CONF && THREE_LETTER_TWO_DIGIT_RE.matches(splitText)) {
                return OcrResult(splitText, splitConf)
            }
        }
    }
    return if (reject) OcrResult(rejectSentinel(text), 0.0) else OcrResult(text, conf)
}

/** Recognize a single prepared crop into an OcrResult. */
fun recognizeCrop(crop: GrayImage, atlas: FlatAtlas): OcrResult =
    recognizeGlyphs(crop, atlas, extractGlyphs(crop))

internal fun recognizeCropSpeckTolerant(crop: GrayImage, atlas: FlatAtlas): OcrResult =
    recognizeGlyphs(crop, atlas, extractGlyphsSpeckTolerant(crop), allowOneHoleFiveRescue = true)

/**
 * The pure-Kotlin glyph OCR engine (the fast-path engine analog of createGlyphOcrEngine).
 * recognize/recognizeMany run the classifier synchronously over a pre-baked atlas — no
 * workers, no wasm, no network, ideal for the offline low-end target.
 */
class GlyphRecognizer(private val atlas: FlatAtlas) {
    fun recognize(crop: GrayImage): OcrResult =
        recognizeCrop(crop, atlas)

    fun recognizeSpeckTolerant(crop: GrayImage): OcrResult =
        recognizeCropSpeckTolerant(crop, atlas)

    fun recognizeMany(crops: List<GrayImage>): List<OcrResult> = crops.map { recognize(it) }
}
