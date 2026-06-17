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
import br.com.fiquemsabendo.figurinhas.domain.bestHighConfidenceConfusionMatchFromText
import br.com.fiquemsabendo.figurinhas.domain.bestMatchFromText
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

private fun isLateWideCodeCandidate(box: CodeBox): Boolean {
    if (box.tilt != null || box.orient != 'h') return false
    val shortSide = min(box.w, box.h)
    if (shortSide <= 0) return false
    val axisAr = max(box.w, box.h) / shortSide
    return box.score in 0.65..0.75 &&
        box.w >= 110.0 &&
        box.h >= 38.0 &&
        axisAr in 2.2..3.8
}

private fun selectBoxesForOcr(
    boxes: List<CodeBox>,
    maxBoxes: Int,
    stopOnFirstCode: Boolean,
    allowLateWideCandidates: Boolean,
): List<CodeBox> {
    val boxesForOcr = boxes.filter { it.orient == 'h' }
    val selected = ArrayList(boxesForOcr.take(maxBoxes))
    if (!allowLateWideCandidates || !stopOnFirstCode || maxBoxes > LIVE_MAX_BOXES_DEFAULT) return selected
    val firstScore = boxesForOcr.firstOrNull()?.score
    if (firstScore != null && firstScore in 0.84..0.92 && selected.any { isLateWideCodeCandidate(it) }) return selected
    for (box in boxesForOcr.drop(maxBoxes)) {
        if (isLateWideCodeCandidate(box)) selected.add(box)
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
): RecognizeOutcome {
    val effectiveMax = clampMaxBoxes(maxBoxes)
    val selected = selectBoxesForOcr(boxes, effectiveMax, stopOnFirstCode, allowLateWideCandidates)
    onDetected?.invoke()

    val resolved = ArrayList<MatchResult>()
    val seen = HashSet<String>()
    val reads = ArrayList<String>()
    var crops = 0

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
    // small-source high-res retry after the normal upright+flip pair, but only for boxes that
    // still have not resolved; frames that already read correctly never pay the retry cost.
    val totalRounds = if (retrySmallCrops) 4 else 2
    for (round in 0 until totalRounds) {
        val retryRound = round >= 2
        val variant = round % 2
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
            } else if (confidence != null && confidence >= 90.0) {
                bestHighConfidenceConfusionMatchFromText(text, checklist)
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

    return RecognizeOutcome(
        resolved = resolved,
        reads = reads,
        boxes = selected.size,
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
    if (primary.reads.isNotEmpty()) return primary
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
    if (dark.resolved.isEmpty() && dark.reads.isEmpty() && dark.crops == 0) return primary
    return RecognizeOutcome(
        resolved = dark.resolved,
        reads = primary.reads + dark.reads,
        boxes = primary.boxes + dark.boxes,
        crops = primary.crops + dark.crops,
    )
}
