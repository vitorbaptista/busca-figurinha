package br.com.fiquemsabendo.figurinhas.ocr

// The ONE recognition strategy (ports src/ocr/recognize.ts: recognizeFrameInOrder) — the
// integration point shared by the live scanner and the benches so they can never drift. Speed
// comes from doing the LEAST OCR that still resolves the code:
//
//   • Boxes come from findCodeBoxes already sorted best-first (the real code pill is the
//     top-scoring box). We only consider the top few (MAX_BOXES) — a real frame has one pill
//     (or a handful in a multi-up shot); the long tail of weak boxes is card noise that costs
//     OCR time and never resolves a code.
//   • We OCR in ROUNDS: round 0 is every box's UPRIGHT crop, round 1 the 180° FLIP crops of
//     the boxes that didn't resolve. Between rounds we stop early once a code resolves. The
//     prominent pill is box[0] and reads upright on round 0, so a clean frame costs one
//     single round of a few crops — the flip round (and the flips of resolved boxes) never run.
//
// The matcher (bestMatchFromText) stays the conservative one — it never invents a code — so
// doing less OCR can only ever skip work, never manufacture a false positive.

// KOTLIN ADAPTATION OF THE OCR ENGINE SEAM. The TS OcrEngine had OPTIONAL recognizeFast /
// recognizeSlow / fastConf. Here FrameRecognizer always has recognizeFast (the glyph fast
// path) and a recognizeSlow that may return null when no accurate fallback is wired yet (the
// Tesseract seam filled in a later plan). The TS two-phase live path keyed on BOTH optional
// methods being present; here it keys on stopOnFirstCode and SKIPS phase 2 entirely when
// recognizeSlow yields null — so until the fallback lands, unsure crops simply miss (no false
// positives, just lower recall), exactly the conservative behaviour the app wants.

import br.com.fiquemsabendo.figurinhas.Config
import br.com.fiquemsabendo.figurinhas.domain.Checklist
import br.com.fiquemsabendo.figurinhas.domain.MatchResult
import br.com.fiquemsabendo.figurinhas.domain.MatchStatus
import br.com.fiquemsabendo.figurinhas.domain.bestHighConfidenceConfusionMatchFromText
import br.com.fiquemsabendo.figurinhas.domain.bestHighConfidenceExactAliasMatchFromText
import br.com.fiquemsabendo.figurinhas.domain.bestMatchFromText
import kotlin.math.abs
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt

/** Cap on boxes OCR'd per frame. findCodeBoxes sorts best-first, and the real code pill is
 *  usually box[0] (or a near-duplicate re-segmentation in the next slot). Lower boxes are
 *  weaker — partial pills on far/tilted stickers, plus card noise — so each extra box trades
 *  latency for a bit more recall. Static/multi-sticker recall keeps 4 boxes. The live path below
 *  uses 2 boxes after ROI tightening and dark fallback: same verified live recall and 0 false
 *  positives as 4 boxes, less OCR on late noisy candidates. */
private const val MAX_BOXES_DEFAULT = 4
private const val LIVE_MAX_BOXES_DEFAULT = 2

// Hoisted out of the per-crop handle() so they compile once, not per OCR'd crop (this is the
// per-frame hot path). ALNUM mirrors the TS /[A-Z0-9]/i (case-insensitive).
private val WHITESPACE_RE = Regex("\\s+")
private val ALNUM_RE = Regex("[A-Za-z0-9]")
private val STRUCTURED_MULTI_DIGIT_READ_RE = Regex("^[A-Z]{2,4}\\s?\\d{2,3}$", RegexOption.IGNORE_CASE)
private const val EXACT_ALIAS_MIN_CONF = 82.0
private const val HIGH_CONFUSION_MIN_CONF = 85.5

/** The outcome of recognizing one frame (ports the TS RecognizeOutcome). */
data class RecognizeOutcome(
    /** Resolved checklist matches, one per unique entry, in first-seen order. */
    val resolved: List<MatchResult>,
    /** The raw OCR texts that actually ran, for debug/log lines. */
    val reads: List<String>,
    /** Number of boxes actually considered for OCR (after maxBoxes cap). */
    val boxes: Int,
    /** Number of crops actually sent to OCR (the latency-relevant work). */
    val crops: Int,
)

/**
 * The OCR engine abstraction recognizeFrameInOrder drives. Ports the optional-method shape of
 * the TS OcrEngine into a non-optional interface where the fallback can be absent (null).
 */
interface FrameRecognizer {
    /** Cheap glyph read of each crop (the fast path). Always present. */
    fun recognizeFast(crops: List<GrayImage>): List<OcrResult>

    /** Narrow rescue for weak Pixel crops; null for engines without this glyph-specific path. */
    fun recognizeSpeckTolerant(crop: GrayImage): OcrResult? = null

    /** The accurate fallback ALONE, or null when there is no fallback wired yet (the seam). */
    fun recognizeSlow(crops: List<GrayImage>): List<OcrResult>?

    /** The fast read's confidence floor for accepting it without the slow engine. */
    val fastConf: Double

    /** Whether a trained slow fallback exists and should receive unsure fast reads. */
    val hasSlowFallback: Boolean
        get() = true
}

/**
 * Glyph-only recognizer: the fast path is the pure-Kotlin GlyphRecognizer and there is no slow
 * fallback yet (recognizeSlow returns null — the Tesseract seam fills this in a later plan).
 */
class GlyphOnlyRecognizer(
    private val glyph: GlyphRecognizer,
    override val fastConf: Double = Config.Ocr.HYBRID_FAST_CONF,
) : FrameRecognizer {
    override fun recognizeFast(crops: List<GrayImage>): List<OcrResult> = glyph.recognizeMany(crops)

    override fun recognizeSpeckTolerant(crop: GrayImage): OcrResult = glyph.recognizeSpeckTolerant(crop)

    override fun recognizeSlow(crops: List<GrayImage>): List<OcrResult>? = null

    override val hasSlowFallback: Boolean = false
}

/** One pending box: a lazy source for its prepared crop variants (upright = index 0, 180°-flip
 *  = index 1), a memo of the ones built so far, and whether it has already resolved a code (so
 *  its flip round is skipped). The flip's prep is only built if round 0 reaches it. */
private class Pending(
    val box: CodeBox,
    val src: CropSource,
    val retrySrc: CropSource?,
    val built: Array<GrayImage?>,
    val retryBuilt: Array<GrayImage?>?,
    var done: Boolean,
)

/** One OCR job: the box it belongs to and the prepared crop to read. */
private class Job(val p: Pending, val crop: GrayImage)

private fun clampMaxBoxes(maxBoxes: Int): Int {
    return max(1, min(maxBoxes, 12))
}

private fun componentBoxesOnly(boxes: List<CodeBox>): List<CodeBox> =
    boxes.filter { it.source != CodeBoxSource.HORIZONTAL_SCAN }

internal fun shouldRetryDarkAfterUnresolvedReads(reads: List<String>): Boolean {
    return reads.any { read ->
        if ('%' in read) return@any false
        STRUCTURED_MULTI_DIGIT_READ_RE.matches(read.replace(WHITESPACE_RE, "").trim())
    }
}

private fun isLateWideCodeCandidate(box: CodeBox): Boolean {
    if (box.tilt != null || box.orient != 'h') return false
    val shortSide = min(box.w, box.h)
    if (shortSide <= 0) return false
    val axisAr = max(box.w, box.h) / shortSide
    return box.score in 0.65..0.75 &&
        box.w in 110.0..230.0 &&
        box.h in 38.0..84.0 &&
        axisAr in 2.2..3.8
}

private fun isLateCompactCodeCandidate(box: CodeBox): Boolean {
    if (box.tilt != null || box.orient != 'h') return false
    val shortSide = min(box.w, box.h)
    if (shortSide <= 0) return false
    val axisAr = max(box.w, box.h) / shortSide
    return box.score in 0.69..0.83 &&
        box.w in 70.0..105.0 &&
        box.h in 22.0..36.0 &&
        axisAr in 2.4..3.8
}

private fun isLateThinWideCodeCandidate(box: CodeBox): Boolean {
    if (box.tilt != null || box.orient != 'h') return false
    val shortSide = min(box.w, box.h)
    if (shortSide <= 0) return false
    val axisAr = max(box.w, box.h) / shortSide
    return box.score in 0.50..0.57 &&
        box.w in 130.0..170.0 &&
        box.h in 32.0..42.0 &&
        axisAr in 3.4..4.6
}

private fun isSmallFragmentBeforeLateWide(box: CodeBox): Boolean =
    box.orient == 'h' &&
        box.score >= 0.70 &&
        box.w < 90.0 &&
        box.h < 32.0

private fun shouldPromoteLateWideCandidate(selected: List<CodeBox>, lateWide: CodeBox): Boolean {
    if (selected.isEmpty() || !selected.all(::isSmallFragmentBeforeLateWide)) return false
    val widestFragment = selected.maxOf { it.w }
    val tallestFragment = selected.maxOf { it.h }
    return lateWide.w >= widestFragment * 2.1 &&
        lateWide.h >= tallestFragment * 1.7
}

private fun syntheticHeaderCandidates(boxes: List<CodeBox>): List<CodeBox> {
    if (boxes.any { it.orient == 'h' && it.score >= 0.70 && it.w >= 90.0 && it.h >= 45.0 }) return emptyList()
    val small = boxes.filter { box ->
        if (box.orient != 'h') return@filter false
        val shortSide = min(box.w, box.h)
        if (shortSide <= 0) return@filter false
        val axisAr = max(box.w, box.h) / shortSide
        box.w in 18.0..55.0 &&
            box.h in 8.0..16.0 &&
            axisAr >= 2.0 &&
            box.score in 0.48..0.78
    }
    if (small.size < 3) return emptyList()

    var best: List<CodeBox> = emptyList()
    for (box in small) {
        val row = small.filter { abs(it.y - box.y) <= HEADER_ROW_Y_TOLERANCE }
        if (row.size > best.size) best = row
    }
    if (best.size < 3) return emptyList()
    val minX = best.minOf { it.x }
    val maxX = best.maxOf { it.x + it.w }
    val minY = best.minOf { it.y }
    val spanX = maxX - minX
    val avgH = best.sumOf { it.h } / best.size
    if (spanX !in HEADER_ROW_SPAN_MIN..HEADER_ROW_SPAN_MAX) return emptyList()
    if (avgH !in HEADER_ROW_H_MIN..HEADER_ROW_H_MAX) return emptyList()

    val compactSource = best.sortedBy { it.x }.takeLast(2)
    val compactMaxX = compactSource.maxOf { it.x + it.w }
    val compactMinX = compactSource.minOf { it.x }
    val compactMinY = compactSource.minOf { it.y }
    val compactSpanX = compactMaxX - compactMinX
    val compactAvgH = compactSource.sumOf { it.h } / compactSource.size
    val compactH = (compactAvgH * HEADER_COMPACT_H_MULT).coerceIn(HEADER_COMPACT_H_MIN, HEADER_COMPACT_H_MAX)
    val compactW = (compactSpanX * HEADER_COMPACT_W_MULT).coerceIn(HEADER_COMPACT_W_MIN, HEADER_COMPACT_W_MAX)
    val compact = CodeBox(
        x = compactMaxX - compactW * HEADER_COMPACT_RIGHT_ANCHOR,
        y = compactMinY - compactH * HEADER_COMPACT_TOP_ANCHOR,
        w = compactW,
        h = compactH,
        orient = 'h',
        score = HEADER_COMPACT_SCORE,
        tilt = null,
        pillW = compactH * HEADER_RESCUE_PILL_H,
        fill = 0.70,
        boost = false,
    )

    val candidateH = (avgH * HEADER_RESCUE_H_MULT).coerceIn(HEADER_RESCUE_H_MIN, HEADER_RESCUE_H_MAX)
    val candidateW = (spanX * HEADER_RESCUE_W_MULT).coerceIn(HEADER_RESCUE_W_MIN, HEADER_RESCUE_W_MAX)
    val x = maxX - candidateW * HEADER_RESCUE_RIGHT_ANCHOR
    val y = minY - candidateH * HEADER_RESCUE_TOP_ANCHOR
    val wide = CodeBox(
        x = x,
        y = y,
        w = candidateW,
        h = candidateH,
        orient = 'h',
        score = HEADER_RESCUE_SCORE,
        tilt = 0.0,
        pillW = candidateH * HEADER_RESCUE_PILL_H,
        fill = 0.70,
        boost = false,
    )
    return listOf(compact, wide)
}

private const val HEADER_ROW_Y_TOLERANCE = 12.0
private const val HEADER_ROW_SPAN_MIN = 80.0
private const val HEADER_ROW_SPAN_MAX = 130.0
private const val HEADER_ROW_H_MIN = 9.0
private const val HEADER_ROW_H_MAX = 14.0
private const val HEADER_COMPACT_H_MULT = 4.1
private const val HEADER_COMPACT_H_MIN = 40.0
private const val HEADER_COMPACT_H_MAX = 54.0
private const val HEADER_COMPACT_W_MULT = 0.86
private const val HEADER_COMPACT_W_MIN = 70.0
private const val HEADER_COMPACT_W_MAX = 100.0
private const val HEADER_COMPACT_RIGHT_ANCHOR = 0.06
private const val HEADER_COMPACT_TOP_ANCHOR = 0.78
private const val HEADER_COMPACT_SCORE = 0.80
private const val HEADER_RESCUE_H_MULT = 6.8
private const val HEADER_RESCUE_H_MIN = 64.0
private const val HEADER_RESCUE_H_MAX = 84.0
private const val HEADER_RESCUE_W_MULT = 1.25
private const val HEADER_RESCUE_W_MIN = 120.0
private const val HEADER_RESCUE_W_MAX = 145.0
private const val HEADER_RESCUE_RIGHT_ANCHOR = 0.10
private const val HEADER_RESCUE_TOP_ANCHOR = 0.35
private const val HEADER_RESCUE_PILL_H = 0.46
private const val HEADER_RESCUE_SCORE = 0.79
private const val RETICLE_RESCUE_SCORE = 0.88
private const val RETICLE_RESCUE_FILL = 0.70
private const val RETICLE_RESCUE_PILL_H = 0.46

private class ReticleRescueSpec(
    val x: Double,
    val y: Double,
    val w: Double,
    val h: Double,
    val boost: Boolean,
    val allowEdgeHeaderCorrection: Boolean = false,
    val runBeforePrimary: Boolean = false,
    val requiresNoPrimaryReads: Boolean = false,
    val allowHighResRetry: Boolean = true,
)

private class ReticleRescueCandidate(
    val box: CodeBox,
    val allowEdgeHeaderCorrection: Boolean,
    val runBeforePrimary: Boolean,
    val requiresNoPrimaryReads: Boolean,
    val allowHighResRetry: Boolean,
)

private fun specToBox(frame: GrayImage, spec: ReticleRescueSpec): CodeBox {
    val w = (frame.width * spec.w).roundToInt().toDouble()
    val h = (frame.height * spec.h).roundToInt().toDouble()
    return CodeBox(
        x = (frame.width * spec.x).roundToInt().toDouble(),
        y = (frame.height * spec.y).roundToInt().toDouble(),
        w = w,
        h = h,
        orient = 'h',
        score = RETICLE_RESCUE_SCORE,
        tilt = null,
        pillW = h * RETICLE_RESCUE_PILL_H,
        fill = RETICLE_RESCUE_FILL,
        boost = spec.boost,
    )
}

private fun overlapsReticleBand(frame: GrayImage, box: CodeBox): Boolean {
    if (frame.width <= 0 || frame.height <= 0) return false
    val roi = Roi.CONFIG
    val cx = (box.x + box.w / 2) / frame.width
    val cy = (box.y + box.h / 2) / frame.height
    return cx in (roi.left - RETICLE_EVIDENCE_MARGIN_X)..(roi.right + RETICLE_EVIDENCE_MARGIN_X) &&
        cy in (roi.top - RETICLE_EVIDENCE_MARGIN_Y)..(roi.bottom + RETICLE_EVIDENCE_MARGIN_Y)
}

private fun hasHorizontalPillWindowEvidence(frame: GrayImage, boxes: List<CodeBox>): Boolean {
    val horizontalEvidence = boxes.any { box ->
        box.orient == 'h' &&
            box.score >= RETICLE_WINDOW_MIN_H_SCORE &&
            overlapsReticleBand(frame, box)
    }
    if (horizontalEvidence) return true

    val verticalEdgeEvidence = boxes.any { box ->
        box.orient == 'v' &&
            box.score >= RETICLE_WINDOW_MIN_V_SCORE &&
            box.h >= frame.height * RETICLE_WINDOW_MIN_V_H &&
            overlapsReticleBand(frame, box)
    }
    return verticalEdgeEvidence && boxes.any { box ->
        box.orient == 'h' &&
            box.score >= RETICLE_WINDOW_WEAK_H_SCORE &&
            overlapsReticleBand(frame, box)
    }
}

private fun horizontalPillWindowSpecs(frame: GrayImage, boxes: List<CodeBox>): List<ReticleRescueSpec> {
    if (frame.width <= 0 || frame.height <= 0) return emptyList()
    if (!hasHorizontalPillWindowEvidence(frame, boxes)) return emptyList()

    val roi = Roi.CONFIG
    val roiH = roi.bottom - roi.top
    val cx = (roi.left + roi.right) / 2
    val cy = (roi.top + roi.bottom) / 2
    val out = ArrayList<ReticleRescueSpec>(RETICLE_WINDOW_HEIGHTS.size)
    for (h in RETICLE_WINDOW_HEIGHTS) {
        val boxH = roiH * h
        val boxW = (boxH * frame.height * RETICLE_WINDOW_AR / frame.width)
            .coerceAtMost((roi.right - roi.left) * RETICLE_WINDOW_MAX_ROI_W)
        out.add(
            ReticleRescueSpec(
                x = (cx - boxW / 2).coerceIn(0.0, 1.0 - boxW),
                y = (cy - boxH / 2).coerceIn(0.0, 1.0 - boxH),
                w = boxW,
                h = boxH,
                boost = true,
                requiresNoPrimaryReads = true,
                allowHighResRetry = false,
            ),
        )
    }
    return out
}

private fun candidateIou(a: CodeBox, b: CodeBox): Double {
    val x1 = max(a.x, b.x)
    val y1 = max(a.y, b.y)
    val x2 = min(a.x + a.w, b.x + b.w)
    val y2 = min(a.y + a.h, b.y + b.h)
    val inter = max(0.0, x2 - x1) * max(0.0, y2 - y1)
    val union = a.w * a.h + b.w * b.h - inter
    return if (union > 0) inter / union else 0.0
}

private fun thinRestoreOnly(raw: String, code: String): Boolean {
    if (code.length != raw.length + 1) return false
    var i = 0
    while (i < raw.length && code[i] == raw[i]) i++
    if (code.substring(i + 1) != raw.substring(i)) return false
    return code[i] in RETICLE_RESCUE_THIN_LETTERS
}

private fun edgeHeaderCorrectionOnly(raw: String, code: String): Boolean {
    val rawSplit = splitCode(raw) ?: return false
    val codeSplit = splitCode(code) ?: return false
    return rawSplit.first == "EGV" && codeSplit.first == "EGY" && rawSplit.second == codeSplit.second
}

private fun splitCode(code: String): Pair<String, String>? {
    val firstDigit = code.indexOfFirst { it.isDigit() }
    if (firstDigit <= 0 || firstDigit >= code.length) return null
    return code.substring(0, firstDigit) to code.substring(firstDigit)
}

private fun acceptsReticleRescueMatch(match: MatchResult, allowEdgeHeaderCorrection: Boolean): Boolean {
    val entry = match.entry ?: return false
    return when (match.status) {
        MatchStatus.EXACT -> true
        MatchStatus.CORRECTED -> thinRestoreOnly(match.raw, entry.code) ||
            (allowEdgeHeaderCorrection && edgeHeaderCorrectionOnly(match.raw, entry.code))
        MatchStatus.UNKNOWN -> false
    }
}

private fun reticleRescueCandidates(frame: GrayImage, boxes: List<CodeBox>): List<ReticleRescueCandidate> {
    val specs = ArrayList<ReticleRescueSpec>(2)
    if (boxes.any { isPartialPillReticleRescueGate(frame, it) }) {
        specs.add(RETICLE_RESCUE_PARTIAL_PILL)
    }
    if (boxes.any { isLowerStickerReticleRescueGate(frame, it) }) {
        specs.add(RETICLE_RESCUE_LOWER_STICKER)
    }
    if (isEdgeHeaderReticleRescueGate(frame, boxes)) {
        specs.add(RETICLE_RESCUE_EDGE_HEADER)
    }
    specs.addAll(horizontalPillWindowSpecs(frame, boxes))

    val out = ArrayList<ReticleRescueCandidate>(specs.size)
    for (spec in specs) {
        val box = specToBox(frame, spec)
        if (out.any { candidateIou(it.box, box) >= RETICLE_WINDOW_DUP_IOU }) continue
        out.add(
            ReticleRescueCandidate(
                box = box,
                allowEdgeHeaderCorrection = spec.allowEdgeHeaderCorrection,
                runBeforePrimary = spec.runBeforePrimary,
                requiresNoPrimaryReads = spec.requiresNoPrimaryReads,
                allowHighResRetry = spec.allowHighResRetry,
            ),
        )
    }
    return out
}

private fun isPartialPillReticleRescueGate(frame: GrayImage, box: CodeBox): Boolean {
    if (frame.width <= 0 || frame.height <= 0) return false
    return box.orient == 'h' &&
        box.score in 0.88..0.94 &&
        box.x / frame.width in 0.500..0.573 &&
        box.y / frame.height in 0.414..0.438 &&
        box.w / frame.width in 0.167..0.219 &&
        box.h / frame.height in 0.055..0.075
}

private fun isLowerStickerReticleRescueGate(frame: GrayImage, box: CodeBox): Boolean {
    if (frame.width <= 0 || frame.height <= 0) return false
    return box.orient == 'h' &&
        box.score in 0.48..0.60 &&
        box.x / frame.width in 0.167..0.281 &&
        box.y / frame.height in 0.445..0.523 &&
        box.w / frame.width in 0.313..0.427 &&
        box.h / frame.height in 0.062..0.133
}

private fun isEdgeHeaderReticleRescueGate(frame: GrayImage, boxes: List<CodeBox>): Boolean {
    if (frame.width <= 0 || frame.height <= 0) return false
    val weakHeader = boxes.any { box ->
        box.orient == 'h' &&
            box.score in 0.48..0.56 &&
            box.x / frame.width in 0.26..0.30 &&
            box.y / frame.height in 0.385..0.400 &&
            box.w / frame.width in 0.09..0.12 &&
            box.h / frame.height in 0.020..0.030
    }
    val rightEdge = boxes.any { box ->
        box.orient == 'v' &&
            box.score in 0.62..0.70 &&
            box.x / frame.width in 0.60..0.63 &&
            box.y / frame.height in 0.40..0.42 &&
            box.w / frame.width in 0.025..0.045 &&
            box.h / frame.height in 0.085..0.105
    }
    return weakHeader && rightEdge
}

private val RETICLE_RESCUE_PARTIAL_PILL = ReticleRescueSpec(0.440, 0.415, 0.200, 0.060, boost = true)
private val RETICLE_RESCUE_LOWER_STICKER = ReticleRescueSpec(0.460, 0.415, 0.200, 0.095, boost = false)
private val RETICLE_RESCUE_EDGE_HEADER = ReticleRescueSpec(
    x = 0.440,
    y = 0.375,
    w = 0.280,
    h = 0.075,
    boost = false,
    allowEdgeHeaderCorrection = true,
    runBeforePrimary = true,
)
private val RETICLE_RESCUE_THIN_LETTERS = setOf('I', 'J', 'L', 'T')
private const val RETICLE_EVIDENCE_MARGIN_X = 0.04
private const val RETICLE_EVIDENCE_MARGIN_Y = 0.08
private const val RETICLE_WINDOW_MIN_H_SCORE = 0.64
private const val RETICLE_WINDOW_MIN_V_SCORE = 0.70
private const val RETICLE_WINDOW_WEAK_H_SCORE = 0.48
private const val RETICLE_WINDOW_MIN_V_H = 0.055
private const val RETICLE_WINDOW_AR = 2.55
private const val RETICLE_WINDOW_MAX_ROI_W = 0.52
private const val RETICLE_WINDOW_DUP_IOU = 0.72
private val RETICLE_WINDOW_HEIGHTS = doubleArrayOf(0.24, 0.30)

internal fun selectBoxesForOcr(
    boxes: List<CodeBox>,
    maxBoxes: Int,
    stopOnFirstCode: Boolean,
    allowLateWideCandidates: Boolean,
): List<CodeBox> {
    val horizontalBoxes = boxes.filter { it.orient == 'h' }
    val boxesForOcr = if (stopOnFirstCode) {
        val headerCandidates = syntheticHeaderCandidates(horizontalBoxes)
        if (headerCandidates.isEmpty()) {
            horizontalBoxes
        } else {
            (horizontalBoxes + headerCandidates).sortedByDescending { it.score }
        }
    } else {
        horizontalBoxes
    }
    val selected = ArrayList(boxesForOcr.take(maxBoxes))
    if (!allowLateWideCandidates || !stopOnFirstCode || maxBoxes > LIVE_MAX_BOXES_DEFAULT) return selected
    val firstScore = boxesForOcr.firstOrNull()?.score
    if (firstScore != null && firstScore in 0.84..0.92 && selected.any { isLateWideCodeCandidate(it) }) return selected
    val lateWideCandidates = ArrayList<CodeBox>(2)
    for (box in boxesForOcr.drop(maxBoxes)) {
        if (isLateWideCodeCandidate(box) || isLateCompactCodeCandidate(box) || isLateThinWideCodeCandidate(box)) {
            lateWideCandidates.add(box)
        }
        if (lateWideCandidates.size >= 2) break
    }
    if (lateWideCandidates.isEmpty()) return selected
    val firstLateWide = lateWideCandidates.first()
    if (shouldPromoteLateWideCandidate(selected, firstLateWide)) {
        selected.add(0, firstLateWide)
        lateWideCandidates.removeAt(0)
    }
    for (box in lateWideCandidates) {
        selected.add(box)
        if (selected.size >= LIVE_MAX_BOXES_DEFAULT + 2) break
    }
    return selected
}

/**
 * Recognize a frame with precomputed candidate boxes.
 *
 * Public benchmark and tuning paths call this entry when they already ran detection; the live path
 * keeps using the simpler overload that owns detection.
 */
fun recognizeFrameInOrder(
    engine: FrameRecognizer,
    frame: GrayImage,
    checklist: Checklist,
    boxes: List<CodeBox>,
    stopOnFirstCode: Boolean,
    onDetected: (() -> Unit)? = null,
    maxBoxes: Int = MAX_BOXES_DEFAULT,
    allowLateWideCandidates: Boolean = true,
    allowHighResRetry: Boolean = true,
    allowReticleRescue: Boolean = true,
): RecognizeOutcome {
    val effectiveMax = clampMaxBoxes(maxBoxes)
    val componentBoxes = componentBoxesOnly(boxes)
    val selected = selectBoxesForOcr(componentBoxes, effectiveMax, stopOnFirstCode, allowLateWideCandidates)
    onDetected?.invoke()

    val resolved = ArrayList<MatchResult>()
    val seen = HashSet<String>()
    val reads = ArrayList<String>()
    var crops = 0
    var consideredBoxes = selected.size
    val reticleCandidates =
        if (allowReticleRescue && allowLateWideCandidates && stopOnFirstCode) {
            reticleRescueCandidates(frame, componentBoxes)
        } else {
            emptyList()
        }

    fun runReticleRescue(candidate: ReticleRescueCandidate): Boolean {
        val rescue = recognizeFrameInOrder(
            engine = engine,
            frame = frame,
            checklist = checklist,
            boxes = listOf(candidate.box),
            stopOnFirstCode = true,
            maxBoxes = 1,
            allowLateWideCandidates = false,
            allowHighResRetry = allowHighResRetry && candidate.allowHighResRetry,
            allowReticleRescue = false,
        )
        consideredBoxes += rescue.boxes
        crops += rescue.crops
        reads.addAll(rescue.reads)
        val accepted = rescue.resolved.firstOrNull {
            acceptsReticleRescueMatch(it, candidate.allowEdgeHeaderCorrection)
        }
        if (accepted != null) {
            if (seen.add(accepted.entry!!.code)) resolved.add(accepted)
            return true
        }
        return false
    }

    for (candidate in reticleCandidates) {
        if (candidate.runBeforePrimary && runReticleRescue(candidate)) {
            return RecognizeOutcome(
                resolved = resolved,
                reads = reads,
                boxes = consideredBoxes,
                crops = crops,
            )
        }
    }

    // A lazy crop source per box — the RAW crops are extracted now (cheap), but each variant's
    // expensive prep (prepForOcr) is deferred to the round that actually uses it.
    val retrySmallCrops = stopOnFirstCode && allowHighResRetry
    val pending = selected.mapIndexed { index, box ->
        val src = codeCropSource(frame, box)
        val retrySrc =
            if (retrySmallCrops && index == 0 && box.score in 0.84..0.92) {
                codeCropSource(frame, box, RETRY_TARGET_H_SMALL)
            } else {
                null
            }
        Pending(
            box = box,
            src = src,
            retrySrc = retrySrc,
            built = arrayOfNulls(src.count),
            retryBuilt = retrySrc?.let { arrayOfNulls(it.count) },
            done = false,
        )
    }

    // Round r OCRs variant index r of every still-pending box. Live/latency mode adds a
    // small-source high-res retry after the normal upright; the flip stays behind that retry
    // because live Pixel captures are expected to be horizontally aligned and upright. Frames that
    // already read correctly never pay the retry cost, and 180° fallback remains available.
    val totalRounds = if (retrySmallCrops) 4 else 2
    for (round in 0 until totalRounds) {
        val retryRound = retrySmallCrops && round % 2 == 1
        val variant = if (retrySmallCrops) round / 2 else round
        val jobs = ArrayList<Job>()
        for (p in pending) {
            if (p.done) continue
            val src = if (retryRound) p.retrySrc ?: continue else p.src
            val built = if (retryRound) p.retryBuilt ?: continue else p.built
            if (variant >= src.count) continue
            // Prepare (and memoize) only this variant now — the flip is built only if we reach
            // here in round 0, so the common upright-resolves case never pays the flip's prep.
            var crop = built[variant]
            if (crop == null) {
                crop = src.build(variant)
                built[variant] = crop
            }
            // A blank/near-blank prepared crop (empty card, or a dense crop the sparse-ink gate
            // already blanked) can only OCR to nothing — skip the call, save the dispatch.
            if (cropHasOcrInk(crop)) {
                jobs.add(Job(p, crop))
            } else if (round == 0 || round == 2) {
                // No ink on the upright crop ⇒ the 180° flip is the SAME pixels rotated, so its
                // ink fraction is identical and it would be skipped too. Mark the box done so we
                // never build the flip's prep — same OCR set as before, minus the wasted work.
                p.done = true
            }
        }
        if (jobs.isEmpty()) {
            if (round + 1 < totalRounds && pending.any { !it.done }) continue
            break
        }

        // Handle one OCR result: record the read, snap it to a checklist code (or not), and mark
        // the box done when it resolved OR read to nothing legible (so its flip is skipped).
        // Returns true when this crop resolved a code.
        fun handle(job: Job, text: String, confidence: Double? = null): Boolean {
            val clean = text.replace(WHITESPACE_RE, " ").trim()
            if (clean.isNotEmpty()) reads.add(clean)
            val normalMatch = bestMatchFromText(text, checklist)
            val m = if (normalMatch?.entry != null) {
                normalMatch
            } else if (confidence != null && confidence >= EXACT_ALIAS_MIN_CONF) {
                bestHighConfidenceExactAliasMatchFromText(text, checklist)
                    ?: if (confidence >= HIGH_CONFUSION_MIN_CONF) {
                        bestHighConfidenceConfusionMatchFromText(text, checklist)
                    } else {
                        normalMatch
                    }
            } else {
                normalMatch
            }
            if (m?.entry != null) {
                job.p.done = true // this box resolved — its flip round is skipped
                if (seen.add(m.entry.code)) resolved.add(m)
                return true
            }
            if (round == 0 && !ALNUM_RE.containsMatchIn(clean)) {
                // The upright crop OCR'd to NOTHING legible (no letter or digit). The flip is the
                // SAME pixels rotated 180°, so a crop with no glyph either way carries no code —
                // its flip would only burn another OCR call to read nothing. Upside-down REAL
                // text reads as garbage chars upright (not empty), so it still has glyph chars
                // here and keeps its flip. This skips the wasted second call on the many frames
                // whose box holds an unreadable smudge, without dropping any genuinely flipped
                // code.
                job.p.done = true
            }
            return false
        }

        fun trySpeckTolerantRescue(job: Job): Boolean {
            if (!isLateWideCodeCandidate(job.p.box)) return false
            val rescue = engine.recognizeSpeckTolerant(job.crop) ?: return false
            crops += 1
            if (rescue.confidence < 90.0) return false
            val normalMatch = bestMatchFromText(rescue.text, checklist)
            val m = if (normalMatch?.entry != null) {
                normalMatch
            } else {
                bestHighConfidenceConfusionMatchFromText(rescue.text, checklist)
            }
            val entry = m?.entry ?: return false
            val clean = rescue.text.replace(WHITESPACE_RE, " ").trim()
            if (clean.isNotEmpty()) reads.add(clean)
            job.p.done = true
            if (seen.add(entry.code)) resolved.add(m)
            return true
        }

        var resolvedThisRound = false
        if (stopOnFirstCode) {
            // TWO-PHASE live/latency path. The expensive engine (Tesseract) dwarfs detection on a
            // phone, so the whole game is to NOT call it when the cheap glyph matcher already read
            // the code.
            //   Phase 1: glyph-read EVERY crop in SCORE order, stopping the instant one resolves —
            //   with ZERO slow OCR, even though spurious crops sit alongside the pill.
            //   Phase 2: only if NOTHING resolved AND a slow fallback exists, pay it on the unsure
            //   crops in score order, stopping at the first match.
            val gate = engine.fastConf
            val unsure = ArrayList<Job>()
            // Phase 1: glyph-read crops in SCORE order, stopping the instant one resolves a code —
            // so a clean frame ends after the pill's glyph read, with no slow OCR at all.
            for (job in jobs) {
                crops += 1
                val r = engine.recognizeFast(listOf(job.crop))[0]
                if (r.confidence >= gate) {
                    // Confident glyph read: it either snaps to a code (resolve, done) or is a
                    // confident NON-code (logo fragment) we trust enough to NOT re-check slow.
                    if (handle(job, r.text, r.confidence)) {
                        resolvedThisRound = true
                        break
                    } else if (trySpeckTolerantRescue(job)) {
                        resolvedThisRound = true
                        break
                    }
                } else {
                    // Soft/rejected/blank: the slow engine might still read it — defer to phase 2.
                    val clean = r.text.replace(WHITESPACE_RE, " ").trim()
                    if (clean.isEmpty() && trySpeckTolerantRescue(job)) {
                        resolvedThisRound = true
                        break
                    }
                    if (clean.isNotEmpty()) reads.add("$clean (${r.confidence.roundToInt()}%)")
                    if (clean.isEmpty() && !engine.hasSlowFallback && (round == 0 || round == 2)) {
                        job.p.done = true
                    } else {
                        unsure.add(job)
                    }
                }
            }
            // Phase 2: only if NOTHING resolved, pay the slow engine on the unsure crops in score
            // order. When recognizeSlow returns null (no fallback wired yet — the v1 seam) we SKIP
            // phase 2 entirely: the unsure crops simply miss, never a false positive.
            if (!resolvedThisRound) {
                for (job in unsure) {
                    val slow = engine.recognizeSlow(listOf(job.crop)) ?: break
                    crops += 1
                    if (handle(job, slow[0].text)) {
                        resolvedThisRound = true
                        break
                    }
                }
            }
        } else {
            // Recall mode (multi-sticker static): we want EVERY distinct code, so OCR the whole
            // round in one fast call and process all results.
            crops += jobs.size
            val results = engine.recognizeFast(jobs.map { it.crop })
            for (i in results.indices) {
                if (handle(jobs[i], results[i].text)) resolvedThisRound = true
            }
        }
        if (resolvedThisRound && stopOnFirstCode) break // frame resolved — done
    }

    if (allowReticleRescue && allowLateWideCandidates && stopOnFirstCode && resolved.isEmpty()) {
        for (candidate in reticleCandidates) {
            if (candidate.runBeforePrimary) continue
            if (candidate.requiresNoPrimaryReads && reads.isNotEmpty()) continue
            if (runReticleRescue(candidate)) break
        }
    }

    return RecognizeOutcome(
        resolved = resolved,
        reads = reads,
        boxes = consideredBoxes,
        crops = crops,
    )
}

/**
 * Recognize a frame by OCR'ing located crops best-first, in rounds (upright then flip), stopping
 * as soon as a code resolves. Faithful port of src/ocr/recognize.ts: recognizeFrameInOrder.
 *
 * @param stopOnFirstCode  true for the live burst and the latency bench: stop the whole frame at
 *   the first resolved code (the prominent pill is box[0], so the frame resolves on round 0).
 *   false for the static multi-frame recall path, which wants every distinct code in one frame.
 * @param onDetected  called the instant detection (findCodeBoxes) finishes — lets the latency
 *   bench split detection time from OCR time without forking the measured code path.
 */
fun recognizeFrameInOrder(
    engine: FrameRecognizer,
    frame: GrayImage,
    checklist: Checklist,
    stopOnFirstCode: Boolean,
    roi: Roi = Roi.CONFIG,
    onDetected: (() -> Unit)? = null,
    maxBoxes: Int = MAX_BOXES_DEFAULT,
): RecognizeOutcome {
    val boxes = findCodeBoxes(frame, roi)
    val effectiveMaxBoxes =
        if (stopOnFirstCode && maxBoxes == MAX_BOXES_DEFAULT) LIVE_MAX_BOXES_DEFAULT else maxBoxes
    val primary = recognizeFrameInOrder(
        engine = engine,
        frame = frame,
        checklist = checklist,
        boxes = boxes,
        stopOnFirstCode = stopOnFirstCode,
        onDetected = onDetected,
        maxBoxes = effectiveMaxBoxes,
    )
    if (!stopOnFirstCode || primary.resolved.isNotEmpty()) return primary

    // The mixed dark+light detector can let a light-mode false candidate suppress a weak real
    // dark pill. A dark-only retry runs only after a miss, so it can recover weak real backs
    // without changing the normal fast path or committing any one-off non-code read. If the primary
    // pass already produced OCR text, the useful pill was reached and rejected as unsafe; retrying
    // dark-only mostly burns time on no-sticker frames, so keep the retry for true no-text misses.
    if (primary.reads.isNotEmpty() && !shouldRetryDarkAfterUnresolvedReads(primary.reads)) return primary
    val darkBoxes = findCodeBoxes(frame, roi, arrayOf(ForegroundMode.DARK))
    val dark = recognizeFrameInOrder(
        engine = engine,
        frame = frame,
        checklist = checklist,
        boxes = darkBoxes,
        stopOnFirstCode = true,
        maxBoxes = effectiveMaxBoxes,
        allowLateWideCandidates = false,
        allowHighResRetry = false,
    )
    if (dark.resolved.isEmpty() && dark.reads.isEmpty() && dark.crops == 0) {
        return primary
    }
    return RecognizeOutcome(
        resolved = dark.resolved,
        reads = primary.reads + dark.reads,
        boxes = primary.boxes + dark.boxes,
        crops = primary.crops + dark.crops,
    )
}
