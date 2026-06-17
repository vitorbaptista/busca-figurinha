package br.com.fiquemsabendo.figurinhas.ocr

import br.com.fiquemsabendo.figurinhas.Config
import br.com.fiquemsabendo.figurinhas.data.checklist
import br.com.fiquemsabendo.figurinhas.domain.Confirmer
import br.com.fiquemsabendo.figurinhas.domain.MatchStatus
import br.com.fiquemsabendo.figurinhas.domain.bestHighConfidenceConfusionMatchFromText
import br.com.fiquemsabendo.figurinhas.domain.bestMatchFromText
import java.io.BufferedReader
import java.io.File
import java.io.FileInputStream
import java.io.FileWriter
import java.io.InputStreamReader
import java.nio.charset.StandardCharsets
import java.util.Locale
import java.util.zip.GZIPInputStream
import kotlin.math.max
import kotlin.math.min
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

// Bench the live Android scanner against real captured frames (no Android runtime, host JVM only).
// The normal test keeps a small baseline gate; the broader strategy matrix is left as a manual
// helper so local tuning does not make every unit-test run crawl.
class PixelDatasetBenchmark {

    private val repoRoot: File = run {
        var dir = File(".").canonicalFile
        while (true) {
            if (File(dir, "package.json").exists() && File(dir, "android/settings.gradle.kts").exists()) {
                return@run dir
            }
            val parent = dir.parentFile
            if (parent == null || parent.path == dir.path) break
            dir = parent
        }
        File(".").canonicalFile
    }

    private val defaultDatasetName = "combined-live-20260616-20260617"
    private val datasetArg = (
        System.getProperty("figurinhas.pixelDataset")
            ?: System.getenv("FIGURINHAS_PIXEL_DATASET")
            ?: defaultDatasetName
    ).trim().ifEmpty { defaultDatasetName }
    private val verificationFileName = "ground_truth_verification.csv"
    private val notStickerLabel = "not_sticker"
    private val baselineMinPositiveRows = 216
    private val baselineMinNegativeRows = 157
    private val baselineMinRecallPercent = 72.2
    private val baselineMinConfirmedHolds = 41
    private val baselineMaxAverageCrops = 1.50
    private val baselineMaxCropsP95 = 4
    private val baselineMaxCropsPerFrame = 6
    private val baselineMinExactHits = 68
    private val baselineMaxCorrectionDependentHits = 88
    private val usefulFramesPerDifficultCode = 3
    private val watchedDifficultCodes = listOf("MEX15", "IRQ20", "TUN10")

    private data class ManifestRow(
        val frameId: String,
        val sourceDir: String,
        val frameNumber: Int,
        val rawFramePath: String,
        val split: String,
        val expected: String,
        val verifiedCode: String,
        val verificationStatus: String,
        val targetLabel: String,
        val isScored: Boolean,
    ) {
        val isVerifiedSticker: Boolean
            get() = verificationStatus == "confirmed" && verifiedCode.isNotBlank()
        val isVerifiedNoSticker: Boolean
            get() = verificationStatus == "not_sticker"
        val isScoredFrame: Boolean
            get() = isVerifiedSticker || isVerifiedNoSticker
        val isPositiveTarget: Boolean
            get() = isScored && targetLabel.isNotBlank() && targetLabel != "not_sticker"
    }

    private data class VerificationRow(
        val frameId: String,
        val verifiedCode: String,
        val status: String,
    )

    private enum class FailReason {
        NONE,
        NO_BOXES,
        BOXES_NO_INK,
        NO_MATCH,
    }

    private enum class ExpectedHitPath {
        NONE,
        EXACT,
        STANDARD_CORRECTION,
        HIGH_CONFUSION,
    }

    private enum class DarkFallbackPolicy {
        NEVER,
        ON_MISS,
        ON_MISS_WITHOUT_PRIMARY_READS,
        ON_MISS_WITHOUT_PRIMARY_INK,
    }

    private data class FrameResult(
        val frameId: String,
        val sourceDir: String,
        val frameNumber: Int,
        val reads: List<String>,
        val hasExpected: Boolean,
        val expected: String,
        val split: String,
        val hasFalsePositive: Boolean,
        val resolvedCodes: List<String>,
        val detectionMs: Long,
        val ocrMs: Long,
        val boxes: Int,
        val inkBoxes: Int,
        val crops: Int,
        val darkFallbackAttempted: Boolean,
        val darkFallbackUsed: Boolean,
        val reason: FailReason,
        val expectedHitPath: ExpectedHitPath,
        val verified: Boolean,
        val diagnostics: List<String>,
    )

    private data class HoldResult(
        val expected: String,
        val sourceDir: String,
        val startFrame: Int,
        val endFrame: Int,
        val manualFrames: Int,
        val hits: Int,
        val confirmed: Boolean,
        val wrongCommits: Set<String>,
    )

    private fun datasetRoot(): File {
        val requested = File(datasetArg)
        return when {
            requested.isAbsolute -> requested
            datasetArg.contains("/") || datasetArg.contains(File.separatorChar) -> File(repoRoot, datasetArg)
            else -> File(repoRoot, "captures/datasets/$datasetArg")
        }.canonicalFile
    }

    private fun isDefaultDataset(): Boolean = datasetRoot() == File(repoRoot, "captures/datasets/$defaultDatasetName").canonicalFile

    private fun verificationFile(): File? {
        val datasetLocal = File(datasetRoot(), verificationFileName)
        if (datasetLocal.exists()) return datasetLocal
        return null
    }

    private fun manifestRows(): List<ManifestRow> {
        val manifest = File(datasetRoot(), "dataset_manifest.csv")
        if (!manifest.exists()) return emptyList()
        val verification = loadVerification()

        val rows = ArrayList<ManifestRow>()
        BufferedReader(InputStreamReader(FileInputStream(manifest), StandardCharsets.UTF_8)).use { br ->
            br.readLine() // header
            while (true) {
                val line = br.readLine() ?: break
                if (line.isBlank()) continue
                val cols = parseCsvLine(line)
                if (cols.size < 6) continue
                val split = cols[5].trim()
                if (split.isEmpty()) continue
                val frameId = cols[0].trim()
                val expected = cols.getOrNull(7)?.trim() ?: ""
                val verified = verification[frameId]
                val status = verified?.status ?: ""
                val verifiedCode = verified?.verifiedCode ?: ""
                val targetLabel = when {
                    status == "confirmed" && verifiedCode.isNotBlank() -> verifiedCode
                    status == "not_sticker" -> notStickerLabel
                    else -> ""
                }
                rows.add(
                    ManifestRow(
                        frameId = frameId,
                        sourceDir = cols[1].trim(),
                        frameNumber = cols.getOrNull(3)?.trim()?.toIntOrNull() ?: -1,
                        rawFramePath = cols[4].trim(),
                        split = split,
                        expected = expected,
                        verifiedCode = verifiedCode,
                        verificationStatus = status,
                        targetLabel = targetLabel,
                        isScored = (status == "confirmed" && verifiedCode.isNotBlank()) || status == "not_sticker",
                    ),
                )
            }
        }
        return rows
    }

    private fun loadVerification(): Map<String, VerificationRow> {
        val file = verificationFile() ?: return emptyMap()

        val rows = HashMap<String, VerificationRow>()
        BufferedReader(InputStreamReader(FileInputStream(file), StandardCharsets.UTF_8)).use { br ->
            val header = parseCsvLine(br.readLine().trim())
            val idx = { name: String -> header.indexOf(name) }
            val idxFrame = idx("frame_id")
            val idxCode = idx("verified_code")
            val idxStatus = idx("status")
            if (idxFrame < 0 || idxCode < 0 || idxStatus < 0) return emptyMap()

            while (true) {
                val line = br.readLine() ?: break
                if (line.isBlank()) continue
                val cols = parseCsvLine(line)
                val frameId = cols.getOrNull(idxFrame)?.trim() ?: continue
                if (frameId.isEmpty()) continue
                val verifiedCode = cols.getOrNull(idxCode)?.trim() ?: ""
                val status = cols.getOrNull(idxStatus)?.trim()?.lowercase() ?: ""
                val isScored = (status == "confirmed" && verifiedCode.isNotBlank()) || status == "not_sticker"
                if (isScored) {
                    rows[frameId] = VerificationRow(
                        frameId = frameId,
                        verifiedCode = verifiedCode,
                        status = status,
                    )
                }
            }
        }
        return rows
    }

    private fun parseCsvLine(line: String): List<String> {
        val out = ArrayList<String>()
        val sb = StringBuilder()
        var inQuotes = false
        var i = 0

        while (i < line.length) {
            val ch = line[i]
            when {
                ch == '"' -> {
                    if (inQuotes && i + 1 < line.length && line[i + 1] == '"') {
                        sb.append('"')
                        i += 1
                    } else {
                        inQuotes = !inQuotes
                    }
                }
                ch == ',' && !inQuotes -> {
                    out.add(sb.toString())
                    sb.setLength(0)
                }
                else -> sb.append(ch)
            }
            i += 1
        }
        out.add(sb.toString())
        return out.map { it.trim().trim('"') }
    }

    private fun loadAtlas(): FlatAtlas? {
        val atlasFile = File(repoRoot, "android/app/src/main/assets/glyph_atlas.bin")
        if (!atlasFile.exists()) return null
        return loadAtlas(atlasFile.inputStream())
    }

    private fun loadFrame(file: File): GrayImage? {
        if (!file.exists()) return null
        val raw = file.inputStream().use { GZIPInputStream(it).readBytes() }
        var pos = 0

        fun skipWs() {
            while (pos < raw.size) {
                val c = raw[pos].toInt().toChar()
                when {
                    c == '#' -> {
                        while (pos < raw.size && raw[pos].toInt().toChar() != '\n') pos++
                    }
                    c.isWhitespace() -> pos++
                    else -> return
                }
            }
        }

        fun token(): String {
            skipWs()
            val sb = StringBuilder()
            while (pos < raw.size && !raw[pos].toInt().toChar().isWhitespace()) {
                sb.append(raw[pos].toInt().toChar())
                pos++
            }
            return sb.toString()
        }

        if (token() != "P5") return null
        val w = token().toIntOrNull() ?: return null
        val h = token().toIntOrNull() ?: return null
        token() // maxval
        pos++
        if (pos + w * h > raw.size) return null

        val out = IntArray(w * h)
        for (i in out.indices) out[i] = raw[pos + i].toInt() and 0xFF
        return try {
            GrayImage(w, h, out)
        } catch (_: Throwable) {
            null
        }
    }

    private fun toLongArray(values: List<FrameResult>, selector: (FrameResult) -> Long): LongArray {
        return LongArray(values.size) { i -> selector(values[i]) }
    }

    private fun LongArray.median(): Double {
        if (isEmpty()) return 0.0
        val sorted = copyOf().also { it.sort() }
        val mid = sorted.size / 2
        return if (sorted.size % 2 == 1) {
            sorted[mid].toDouble()
        } else {
            (sorted[mid - 1] + sorted[mid]) / 2.0
        }
    }

    private fun LongArray.p95(): Double {
        if (isEmpty()) return 0.0
        val sorted = copyOf().also { it.sort() }
        val idx = ((sorted.size - 1) * 95L / 100).toInt().coerceIn(0, sorted.size - 1)
        return sorted[idx].toDouble()
    }

    private fun avg(values: IntArray): Double = if (values.isEmpty()) 0.0 else values.sum().toDouble() / values.size

    private fun glyphDebug(crop: GrayImage, atlas: FlatAtlas): String =
        extractGlyphs(crop).joinToString(" | ") { glyph ->
            val c = classify(glyph, atlas)
            "x=${glyph.x} ${glyph.w}x${glyph.h} ar=${String.format(Locale.US, "%.2f", glyph.ar)} " +
                "holes=${glyph.holes} " +
                "best=${c.label}:${String.format(Locale.US, "%.2f", c.score)} " +
                "L=${c.bestLetter.label}:${String.format(Locale.US, "%.2f", c.bestLetter.score)} " +
                "D=${c.bestDigit.label}:${String.format(Locale.US, "%.2f", c.bestDigit.score)} " +
                "D2=${String.format(Locale.US, "%.2f", c.secondDigitScore)}"
        }

    private fun formatPercent(numerator: Int, denominator: Int): String {
        if (denominator == 0) return "0.00"
        return String.format(Locale.US, "%.2f", numerator * 100.0 / denominator)
    }

    private fun ExpectedHitPath.priority(): Int = when (this) {
        ExpectedHitPath.NONE -> 0
        ExpectedHitPath.HIGH_CONFUSION -> 1
        ExpectedHitPath.STANDARD_CORRECTION -> 2
        ExpectedHitPath.EXACT -> 3
    }

    private fun hitPathLabel(path: ExpectedHitPath): String = when (path) {
        ExpectedHitPath.NONE -> "sem acerto"
        ExpectedHitPath.EXACT -> "leitura exata"
        ExpectedHitPath.STANDARD_CORRECTION -> "correção conservadora"
        ExpectedHitPath.HIGH_CONFUSION -> "confusão conhecida"
    }

    private fun stripReadPrefix(read: String): String =
        if (read.startsWith("dark:")) read.removePrefix("dark:") else read

    private fun classifyExpectedHit(reads: List<String>, expected: String): ExpectedHitPath {
        var best = ExpectedHitPath.NONE
        for (read in reads) {
            val text = stripReadPrefix(read)
            val normalMatch = bestMatchFromText(text, checklist)
            val candidate = when {
                normalMatch?.entry?.code == expected && normalMatch.status == MatchStatus.EXACT -> {
                    ExpectedHitPath.EXACT
                }
                normalMatch?.entry?.code == expected && normalMatch.status == MatchStatus.CORRECTED -> {
                    ExpectedHitPath.STANDARD_CORRECTION
                }
                normalMatch?.entry == null -> {
                    val confusionMatch = bestHighConfidenceConfusionMatchFromText(text, checklist)
                    if (confusionMatch?.entry?.code == expected) {
                        ExpectedHitPath.HIGH_CONFUSION
                    } else {
                        ExpectedHitPath.NONE
                    }
                }
                else -> ExpectedHitPath.NONE
            }
            if (candidate.priority() > best.priority()) best = candidate
        }
        return best
    }

    private fun runBenchmark(
        roi: Roi = Roi.CONFIG,
        fastConf: Double = Config.Ocr.HYBRID_FAST_CONF,
        maxBoxes: Int = 4,
        modes: Array<ForegroundMode> = ForegroundMode.values(),
        fallbackToFullOnMiss: Boolean = false,
        darkFallbackPolicy: DarkFallbackPolicy = DarkFallbackPolicy.NEVER,
    ): List<FrameResult> {
        val atlas = loadAtlas() ?: return emptyList()
        val engine = GlyphOnlyRecognizer(GlyphRecognizer(atlas), fastConf = fastConf)
        val rows = manifestRows()
        val results = ArrayList<FrameResult>(rows.size)
        val effectiveMaxBoxes = max(1, min(maxBoxes, 12))

        for (row in rows) {
            val frameDir = File(datasetRoot(), row.rawFramePath)
            val framePgm = frameDir.resolve("frame.pgm.gz")
            val frame = loadFrame(framePgm) ?: continue

            val detectStart = System.nanoTime()
            var detectionNs = 0L
            val boxes = if (fallbackToFullOnMiss && roi != Roi.FULL) {
                val primary = findCodeBoxes(frame, roi, modes)
                if (primary.isNotEmpty()) {
                    primary
                } else {
                    findCodeBoxes(frame, Roi.FULL, modes)
                }
            } else {
                findCodeBoxes(frame, roi, modes)
            }
            val boxesToRun = boxes.take(effectiveMaxBoxes)
            val inkBoxes = boxesToRun.count { box ->
                val src = codeCropSource(frame, box)
                val upright = src.build(0)
                cropHasOcrInk(upright)
            }

            var outcome = recognizeFrameInOrder(
                engine = engine,
                frame = frame,
                checklist = checklist,
                boxes = boxes,
                stopOnFirstCode = true,
                maxBoxes = maxBoxes,
                onDetected = {
                    detectionNs = System.nanoTime() - detectStart
                },
            )
            val shouldFallbackDark = when (darkFallbackPolicy) {
                DarkFallbackPolicy.NEVER -> false
                DarkFallbackPolicy.ON_MISS -> outcome.resolved.isEmpty()
                DarkFallbackPolicy.ON_MISS_WITHOUT_PRIMARY_READS -> outcome.resolved.isEmpty() && outcome.reads.isEmpty()
                DarkFallbackPolicy.ON_MISS_WITHOUT_PRIMARY_INK -> outcome.resolved.isEmpty() && inkBoxes == 0
            }
            var darkFallbackUsed = false
            if (shouldFallbackDark) {
                val darkBoxes = findCodeBoxes(frame, roi, arrayOf(ForegroundMode.DARK))
                val darkOutcome = recognizeFrameInOrder(
                    engine = engine,
                    frame = frame,
                    checklist = checklist,
                    boxes = darkBoxes,
                    stopOnFirstCode = true,
                    maxBoxes = maxBoxes,
                    allowLateWideCandidates = false,
                    allowHighResRetry = false,
                )
                if (darkOutcome.resolved.isNotEmpty() || darkOutcome.reads.isNotEmpty() || darkOutcome.crops > 0) {
                    darkFallbackUsed = true
                    outcome = RecognizeOutcome(
                        resolved = darkOutcome.resolved,
                        reads = outcome.reads + darkOutcome.reads.map { "dark:$it" },
                        boxes = outcome.boxes + darkOutcome.boxes,
                        crops = outcome.crops + darkOutcome.crops,
                    )
                }
            }

            val totalNs = System.nanoTime() - detectStart
            if (detectionNs == 0L) {
                detectionNs = totalNs
            }
            val ocrNs = (totalNs - detectionNs).coerceAtLeast(0L)

            val resolved = outcome.resolved.mapNotNull { it.entry?.code }.distinct()
            val reads = outcome.reads
            val target = if (row.isScored && row.targetLabel.isNotBlank()) row.targetLabel else ""
            val shouldScore = row.isScoredFrame
            val hasExpected = shouldScore && row.isPositiveTarget && resolved.contains(target)
            val hasFalsePositive = shouldScore && row.isScoredFrame && when {
                row.isVerifiedNoSticker -> resolved.isNotEmpty()
                row.isPositiveTarget -> resolved.any { it != target }
                else -> false
            }
            val reason = when {
                outcome.resolved.isNotEmpty() -> FailReason.NONE
                outcome.boxes == 0 -> FailReason.NO_BOXES
                outcome.crops == 0 && inkBoxes == 0 -> FailReason.BOXES_NO_INK
                else -> FailReason.NO_MATCH
            }
            val diagnostics = if (row.isPositiveTarget && !hasExpected) {
                boxes.take(10).flatMapIndexed { boxIndex, box ->
                    val src = codeCropSource(frame, box)
                    (0 until min(src.count, 2)).map { cropIndex ->
                        val crop = src.build(cropIndex)
                        val read = recognizeCrop(crop, atlas)
                        val ink = cropHasOcrInk(crop)
                        "box=$boxIndex x=${String.format(Locale.US, "%.1f", box.x)} y=${String.format(Locale.US, "%.1f", box.y)} " +
                            "w=${String.format(Locale.US, "%.1f", box.w)} h=${String.format(Locale.US, "%.1f", box.h)} " +
                            "score=${String.format(Locale.US, "%.3f", box.score)} tilt=${box.tilt?.let { String.format(Locale.US, "%.1f", it) } ?: "-"} " +
                            "crop=$cropIndex ink=$ink read=${read.text}/${String.format(Locale.US, "%.1f", read.confidence)} glyphs=${glyphDebug(crop, atlas)}"
                    }
                }
            } else {
                emptyList()
            }

            results.add(
                FrameResult(
                    frameId = row.frameId,
                    sourceDir = row.sourceDir,
                    frameNumber = row.frameNumber,
                    reads = reads,
                    hasExpected = hasExpected,
                    expected = target,
                    split = row.split,
                    hasFalsePositive = hasFalsePositive,
                    verified = shouldScore,
                    resolvedCodes = resolved,
                    detectionMs = detectionNs / 1_000_000L,
                    ocrMs = ocrNs / 1_000_000L,
                    boxes = outcome.boxes,
                    inkBoxes = inkBoxes,
                    crops = outcome.crops,
                    darkFallbackAttempted = shouldFallbackDark,
                    darkFallbackUsed = darkFallbackUsed,
                    reason = reason,
                    expectedHitPath = if (hasExpected) classifyExpectedHit(reads, target) else ExpectedHitPath.NONE,
                    diagnostics = diagnostics,
                ),
            )
        }
        return results
    }

    private fun positiveHoldResults(scoredResults: List<FrameResult>): List<HoldResult> {
        val positives = scoredResults
            .filter { it.expected != notStickerLabel }
            .sortedWith(compareBy<FrameResult> { it.sourceDir }.thenBy { it.frameNumber }.thenBy { it.frameId })
        if (positives.isEmpty()) return emptyList()

        val groups = ArrayList<List<FrameResult>>()
        var current = ArrayList<FrameResult>()
        for (result in positives) {
            val previous = current.lastOrNull()
            val sameHold = previous != null &&
                previous.sourceDir == result.sourceDir &&
                previous.expected == result.expected &&
                previous.frameNumber >= 0 &&
                result.frameNumber >= 0 &&
                result.frameNumber - previous.frameNumber <= 3
            if (!sameHold) {
                if (current.isNotEmpty()) groups.add(current)
                current = ArrayList()
            }
            current.add(result)
        }
        if (current.isNotEmpty()) groups.add(current)

        return groups.map { group ->
            val expected = group.first().expected
            val confirmer = Confirmer(Config.Match.CONFIRMATIONS)
            val wrongCommits = linkedSetOf<String>()
            var confirmed = false
            for (frame in group) {
                val newlyCommitted = confirmer.add(frame.resolvedCodes)
                if (newlyCommitted.contains(expected)) confirmed = true
                wrongCommits += newlyCommitted.filter { it != expected }
            }
            HoldResult(
                expected = expected,
                sourceDir = group.first().sourceDir,
                startFrame = group.first().frameNumber,
                endFrame = group.last().frameNumber,
                manualFrames = group.size,
                hits = group.count { it.hasExpected },
                confirmed = confirmed,
                wrongCommits = wrongCommits,
            )
        }
    }

    @Test fun run_pixel_dataset_benchmark() {
        runBenchmarkAndWrite(roi = Roi.CONFIG, fastConf = Config.Ocr.HYBRID_FAST_CONF, maxBoxes = 2, reportBase = "baseline", darkFallbackPolicy = DarkFallbackPolicy.ON_MISS_WITHOUT_PRIMARY_READS)
    }

    // Tunable matrix over ROI/confidence/box cap for live Pixel tuning. Call manually while
    // investigating new strategies; keep it outside @Test so CI/local gates stay fast.
    @Suppress("unused")
    private fun writeExploratoryStrategyMatrix() {
        runBenchmarkAndWrite(roi = Roi.CONFIG, fastConf = Config.Ocr.HYBRID_FAST_CONF, maxBoxes = 4, reportBase = "baseline", darkFallbackPolicy = DarkFallbackPolicy.ON_MISS_WITHOUT_PRIMARY_READS)
        runBenchmarkAndWrite(roi = Roi(0.18, 0.32, 0.82, 0.58), fastConf = Config.Ocr.HYBRID_FAST_CONF, maxBoxes = 4, reportBase = "roi_wide_mid")
        runBenchmarkAndWrite(roi = Roi(0.18, 0.32, 0.82, 0.58), fastConf = Config.Ocr.HYBRID_FAST_CONF, maxBoxes = 8, reportBase = "roi_wide_mid")
        runBenchmarkAndWrite(roi = Roi(0.18, 0.32, 0.82, 0.58), fastConf = Config.Ocr.HYBRID_FAST_CONF, maxBoxes = 12, reportBase = "roi_wide_mid")
        runBenchmarkAndWrite(roi = Roi(0.14, 0.28, 0.86, 0.62), fastConf = Config.Ocr.HYBRID_FAST_CONF, maxBoxes = 4, reportBase = "roi_wider_mid")
        runBenchmarkAndWrite(roi = Roi(0.10, 0.24, 0.90, 0.66), fastConf = Config.Ocr.HYBRID_FAST_CONF, maxBoxes = 4, reportBase = "roi_large_mid")
        runBenchmarkAndWrite(roi = Roi(0.12, 0.20, 0.88, 0.72), fastConf = Config.Ocr.HYBRID_FAST_CONF, maxBoxes = 4, reportBase = "roi_tall_mid")
        runBenchmarkAndWrite(roi = Roi.CONFIG, fastConf = Config.Ocr.HYBRID_FAST_CONF, maxBoxes = 4, reportBase = "baseline_fallback_full", modes = arrayOf(ForegroundMode.DARK), fallbackToFullOnMiss = true)
        runBenchmarkAndWrite(roi = Roi.CONFIG, fastConf = Config.Ocr.HYBRID_FAST_CONF, maxBoxes = 4, reportBase = "baseline_dark", modes = arrayOf(ForegroundMode.DARK))
        runBenchmarkAndWrite(roi = Roi.CONFIG, fastConf = Config.Ocr.HYBRID_FAST_CONF, maxBoxes = 4, reportBase = "baseline_light", modes = arrayOf(ForegroundMode.LIGHT))
        runBenchmarkAndWrite(roi = Roi.CONFIG, fastConf = 0.0, maxBoxes = 4, reportBase = "baseline_dark_conf0", modes = arrayOf(ForegroundMode.DARK))
        runBenchmarkAndWrite(roi = Roi.CONFIG, fastConf = 50.0, maxBoxes = 4, reportBase = "baseline_dark_conf50", modes = arrayOf(ForegroundMode.DARK))
        runBenchmarkAndWrite(roi = Roi.CONFIG, fastConf = 30.0, maxBoxes = 4, reportBase = "baseline_dark_conf30", modes = arrayOf(ForegroundMode.DARK))
        runBenchmarkAndWrite(roi = Roi.CONFIG, fastConf = Config.Ocr.HYBRID_FAST_CONF, maxBoxes = 6, reportBase = "baseline6")
        runBenchmarkAndWrite(roi = Roi.CONFIG, fastConf = Config.Ocr.HYBRID_FAST_CONF, maxBoxes = 8, reportBase = "baseline8")

        runBenchmarkAndWrite(roi = Roi.FULL, fastConf = Config.Ocr.HYBRID_FAST_CONF, maxBoxes = 4, reportBase = "full_roi")
        runBenchmarkAndWrite(roi = Roi.FULL, fastConf = 70.0, maxBoxes = 4, reportBase = "full_roi_conf70")
        runBenchmarkAndWrite(roi = Roi.FULL, fastConf = 60.0, maxBoxes = 4, reportBase = "full_roi_conf60")
        runBenchmarkAndWrite(roi = Roi.FULL, fastConf = 50.0, maxBoxes = 4, reportBase = "full_roi_conf50")
        runBenchmarkAndWrite(roi = Roi.FULL, fastConf = 40.0, maxBoxes = 4, reportBase = "full_roi_conf40")
        runBenchmarkAndWrite(roi = Roi.FULL, fastConf = 30.0, maxBoxes = 4, reportBase = "full_roi_conf30")
        runBenchmarkAndWrite(roi = Roi.FULL, fastConf = 0.0, maxBoxes = 4, reportBase = "full_roi_conf0")
    }

    @Test fun dark_static_probe_finds_every_processable_positive() {
        val positives = manifestRows().filter { it.isPositiveTarget }
        assertTrue(positives.isNotEmpty(), "manual Pixel dataset has no verified positives")
        for (row in positives) {
            val frameDir = File(datasetRoot(), row.rawFramePath)
            val frame = loadFrame(frameDir.resolve("frame.pgm.gz"))
                ?: throw AssertionError("verified positive without frame: ${row.frameId}")
            val boxes = findCodeBoxes(frame, Roi.CONFIG, arrayOf(ForegroundMode.DARK))
            assertTrue(boxes.isNotEmpty(), "DARK static-scene probe missed ${row.frameId} (${row.targetLabel})")
        }
    }

    private fun runBenchmarkAndWrite(
        roi: Roi,
        fastConf: Double,
        maxBoxes: Int,
        reportBase: String,
        modes: Array<ForegroundMode> = ForegroundMode.values(),
        fallbackToFullOnMiss: Boolean = false,
        darkFallbackPolicy: DarkFallbackPolicy = DarkFallbackPolicy.NEVER,
    ) {
        val verificationSource = verificationFile()
        val results = runBenchmark(
            roi = roi,
            fastConf = fastConf,
            maxBoxes = maxBoxes,
            modes = modes,
            fallbackToFullOnMiss = fallbackToFullOnMiss,
            darkFallbackPolicy = darkFallbackPolicy,
        )
        val manifestRows = manifestRows()
        val scoringRows = manifestRows.filter { it.isScoredFrame }
        val scoredResults = results.filter { it.verified }
        val reportDir = File(datasetRoot(), "benchmarks")
        reportDir.mkdirs()
        val hasMaxSuffix = Regex("_max\\d+$").matches(reportBase)
        val reportFile = if (hasMaxSuffix) {
            File(reportDir, "$reportBase.md")
        } else {
            File(reportDir, "${reportBase}_max${maxBoxes}.md")
        }

        val truePositives = scoredResults.count { it.hasExpected && it.expected != notStickerLabel }
        val falsePositives = scoredResults.count { it.hasFalsePositive }
        val positiveRows = scoredResults.count { it.expected != notStickerLabel }
        val negativeRows = scoredResults.count { it.expected == notStickerLabel }
        val manifestPositiveRows = scoringRows.count { it.isPositiveTarget }
        val manifestNegativeRows = scoringRows.count { it.targetLabel == notStickerLabel }
        val positivesPredicted = scoredResults.count {
            it.expected != notStickerLabel && it.resolvedCodes.isNotEmpty()
        }
        val misses = positiveRows - truePositives
        val missingFiles = scoringRows.count { row -> results.none { it.frameId == row.frameId } }
        val missingPositiveFiles = scoringRows.count { row -> row.isPositiveTarget && results.none { it.frameId == row.frameId } }
        val missingNegativeFiles = scoringRows.count { row -> row.isVerifiedNoSticker && results.none { it.frameId == row.frameId } }
        val detection = toLongArray(results) { it.detectionMs }
        val ocr = toLongArray(results) { it.ocrMs }
        val boxes = IntArray(results.size) { i -> results[i].boxes }
        val crops = IntArray(results.size) { i -> results[i].crops }
        val totalCrops = crops.sum()
        val maxCrops = crops.maxOrNull() ?: 0
        val cropsP95 = if (crops.isEmpty()) {
            0
        } else {
            crops.sortedArray()[((crops.size - 1) * 95 / 100).coerceIn(0, crops.size - 1)]
        }
        val darkFallbackAttempts = results.count { it.darkFallbackAttempted }
        val darkFallbackUsed = results.count { it.darkFallbackUsed }
        val reasonNoBoxes = results.count { it.reason == FailReason.NO_BOXES }
        val reasonNoInk = results.count { it.reason == FailReason.BOXES_NO_INK }
        val reasonNoMatch = results.count { it.reason == FailReason.NO_MATCH }
        val p95Det = detection.p95()
        val p95Ocr = ocr.p95()

        val sortedWorst = results.sortedByDescending { it.ocrMs + it.detectionMs }.take(12)
        val unresolved = scoredResults.filter { it.expected != notStickerLabel && !it.hasExpected }
        val byReason = scoredResults.filter { it.reason != FailReason.NONE }.groupBy { it.reason }
        val bySplit = scoredResults.groupBy { it.split }
        val byPositiveCode = scoredResults
            .filter { it.expected != notStickerLabel }
            .groupBy { it.expected }
            .toSortedMap()
        val hits = scoredResults.filter { it.hasExpected }
        val exactHits = hits.count { it.expectedHitPath == ExpectedHitPath.EXACT }
        val standardCorrectionHits = hits.count { it.expectedHitPath == ExpectedHitPath.STANDARD_CORRECTION }
        val highConfusionHits = hits.count { it.expectedHitPath == ExpectedHitPath.HIGH_CONFUSION }
        val correctionDependentHits = hits.filter {
            it.expectedHitPath == ExpectedHitPath.STANDARD_CORRECTION ||
                it.expectedHitPath == ExpectedHitPath.HIGH_CONFUSION
        }
        val positiveHolds = positiveHoldResults(scoredResults)
        val confirmableHolds = positiveHolds.filter { it.manualFrames >= Config.Match.CONFIRMATIONS }
        val confirmedHolds = confirmableHolds.count { it.confirmed }
        val missedHolds = confirmableHolds.filter { !it.confirmed }
        val wrongHoldCommits = positiveHolds.flatMap { it.wrongCommits }.distinct()

        val lines = ArrayList<String>(260)
        lines += "# Benchmark Pixel com GT manual"
        lines += "- dataset: ${datasetRoot().relativeToOrSelf(repoRoot).path}"
        val modeConfig = modes.joinToString(".") { it.name.lowercase() }
        lines += "- config: roi=${String.format(Locale.US, "%.2f", roi.left)},${String.format(Locale.US, "%.2f", roi.top)},${String.format(Locale.US, "%.2f", roi.right)},${String.format(Locale.US, "%.2f", roi.bottom)} fastConf=${String.format(Locale.US, "%.1f", fastConf)} maxBoxes=$maxBoxes modes=$modeConfig"
        lines += "- arquivo de GT manual: ${verificationSource?.relativeToOrSelf(repoRoot)?.path ?: "ausente"}"
        lines += "- critério de GT manual: verified_code/status revisados; ground_truth_code automático é ignorado"
        lines += "- frames no manifest: ${manifestRows.size}"
        lines += "- frames processados (frame disponível): ${results.size}"
        lines += "- frames com ground-truth manual confirmado: ${scoringRows.size}"
        lines += "- frames faltando arquivo de frame: $missingFiles"
        if (missingFiles > 0) {
            lines += "- frames positivos/negativos faltando arquivo: $missingPositiveFiles/$missingNegativeFiles"
        }
        val fallbackParts = ArrayList<String>()
        if (fallbackToFullOnMiss && roi != Roi.FULL) {
            fallbackParts += "fallback_full"
        }
        when (darkFallbackPolicy) {
            DarkFallbackPolicy.NEVER -> Unit
            DarkFallbackPolicy.ON_MISS -> fallbackParts += "fallback_dark"
            DarkFallbackPolicy.ON_MISS_WITHOUT_PRIMARY_READS -> fallbackParts += "fallback_dark_no_primary_reads"
            DarkFallbackPolicy.ON_MISS_WITHOUT_PRIMARY_INK -> fallbackParts += "fallback_dark_no_primary_ink"
        }
        val fallbackLabel = if (fallbackParts.isEmpty()) {
            "sem fallback"
        } else {
            fallbackParts.joinToString(" + ")
        }
        lines += "- estratégia de busca: $fallbackLabel"
        lines += "- resolvidos positivos: $truePositives/$positiveRows"
        lines += "- precisão positiva: ${String.format(Locale.US, "%.2f", if ((truePositives + falsePositives) > 0) truePositives * 100.0 / (truePositives + falsePositives) else 0.0)}%"
        lines += "- recall positivo: ${String.format(Locale.US, "%.2f", if (positiveRows > 0) truePositives * 100.0 / positiveRows else 0.0)}%"
        lines += "- acertos por leitura exata/correção/confusão conhecida: $exactHits/$standardCorrectionHits/$highConfusionHits"
        lines += "- acertos dependentes de correção textual: ${correctionDependentHits.size}/$truePositives"
        lines += "- positivos não lidos: $misses"
        lines += "- falsos positivos: $falsePositives de $negativeRows não-sticker processados"
        lines += "- frames positivos/negativos no GT manual: $manifestPositiveRows/$manifestNegativeRows"
        lines += "- seguradas positivas manuais: ${positiveHolds.size}"
        lines += "- seguradas positivas avaliáveis (>= ${Config.Match.CONFIRMATIONS} frames manuais): ${confirmableHolds.size}"
        lines += "- seguradas avaliáveis confirmadas com ${Config.Match.CONFIRMATIONS} leituras: $confirmedHolds/${confirmableHolds.size}"
        lines += "- seguradas avaliáveis sem confirmação: ${missedHolds.size}"
        lines += "- seguradas com frames manuais insuficientes: ${positiveHolds.size - confirmableHolds.size}"
        lines += "- commits errados em seguradas positivas: ${wrongHoldCommits.size}"
        val negativeFalsePositiveRate = if (negativeRows > 0) {
            String.format(Locale.US, "%.2f", falsePositives * 100.0 / negativeRows)
        } else {
            "0.00"
        }
        lines += "- taxa de falso positivo por não-sticker: $negativeFalsePositiveRate%"
        lines += "- média de leituras candidatas por frame: $positivesPredicted"
        val unscored = results.count { !it.verified }
        if (unscored > 0) {
            lines += "- frames sem GT confirmado (ignorados na métrica): $unscored"
        }
        lines += "- razão no-frame sem detecção (boxes=0): $reasonNoBoxes"
        lines += "- razão sem texto no crop (box com 0 ink): $reasonNoInk"
        lines += "- razão sem match apesar de OCR: $reasonNoMatch"
        lines += "- mediana detecção/ocr (ms): ${String.format(Locale.US, "%.2f", detection.median())} / ${String.format(Locale.US, "%.2f", ocr.median())}"
        lines += "- p95 detecção/ocr (ms): ${String.format(Locale.US, "%.2f", p95Det)} / ${String.format(Locale.US, "%.2f", p95Ocr)}"
        lines += "- média boxes: ${String.format(Locale.US, "%.2f", avg(boxes))}"
        lines += "- média crops: ${String.format(Locale.US, "%.2f", avg(crops))}"
        lines += "- total crops OCR: $totalCrops"
        lines += "- p95/max crops OCR: $cropsP95/$maxCrops"
        lines += "- média de crops com ink: ${String.format(Locale.US, "%.2f", results.map { it.inkBoxes }.average())}"
        lines += "- fallback dark tentado/usado: $darkFallbackAttempts/$darkFallbackUsed"
        lines += ""

        lines += "## Seguradas positivas avaliáveis sem confirmação"
        if (missedHolds.isEmpty()) {
            lines += "- nenhuma"
        } else {
            missedHolds.forEach { hold ->
                val wrong = if (hold.wrongCommits.isEmpty()) "-" else hold.wrongCommits.joinToString(", ")
                lines += "- ${hold.expected} em ${hold.sourceDir} frames ${hold.startFrame}-${hold.endFrame}: acertos=${hold.hits}/${hold.manualFrames} commits_errados=$wrong"
            }
        }
        lines += ""

        lines += "## Acertos (GT manual)"
        if (hits.isEmpty()) {
            lines += "- nenhum"
        } else {
            hits.forEach { lines += "- ${it.frameId}: ${it.resolvedCodes.joinToString(", ")}" }
        }
        lines += ""

        lines += "## Cobertura por código manual"
        if (byPositiveCode.isEmpty()) {
            lines += "- nenhum código positivo confirmado"
        } else {
            for ((code, entries) in byPositiveCode) {
                val codeHits = entries.count { it.hasExpected }
                val splitSummary = entries
                    .groupingBy { it.split }
                    .eachCount()
                    .toSortedMap()
                    .entries
                    .joinToString(", ") { "${it.key}:${it.value}" }
                val avgCropsForCode = entries.map { it.crops }.average()
                val maxCropsForCode = entries.maxOf { it.crops }
                val exactForCode = entries.count { it.hasExpected && it.expectedHitPath == ExpectedHitPath.EXACT }
                val correctedForCode = entries.count { it.hasExpected && it.expectedHitPath == ExpectedHitPath.STANDARD_CORRECTION }
                val confusionForCode = entries.count { it.hasExpected && it.expectedHitPath == ExpectedHitPath.HIGH_CONFUSION }
                lines += "- $code: acertos=$codeHits/${entries.size} leitura_exata=$exactForCode correção=$correctedForCode confusão=$confusionForCode splits=$splitSummary crops_média=${String.format(Locale.US, "%.2f", avgCropsForCode)} crops_max=$maxCropsForCode"
            }
        }
        val missingWatchedCodes = watchedDifficultCodes.filter { code -> !byPositiveCode.containsKey(code) }
        if (missingWatchedCodes.isNotEmpty()) {
            lines += ""
            lines += "## Códigos difíceis sem GT manual"
            missingWatchedCodes.forEach { code ->
                lines += "- $code: sem frame confirmado no CSV manual; não usar para benchmark até existir captura revisada"
            }
        }
        val captureSuggestions = ArrayList<String>()
        for (code in watchedDifficultCodes) {
            val entries = byPositiveCode[code].orEmpty()
            val splitNames = entries.map { it.split }.toSet()
            when {
                entries.isEmpty() -> {
                    captureSuggestions += "- $code: capturar uma segurada com pelo menos $usefulFramesPerDifficultCode frames revisados manualmente"
                }
                entries.size < usefulFramesPerDifficultCode -> {
                    captureSuggestions += "- $code: só ${entries.size}/$usefulFramesPerDifficultCode frames revisados; capturar mais ${usefulFramesPerDifficultCode - entries.size}"
                }
                splitNames.size < 2 -> {
                    captureSuggestions += "- $code: cobertura só em ${splitNames.joinToString(", ")}; capturar variação para validação/teste"
                }
            }
        }
        if (captureSuggestions.isNotEmpty()) {
            lines += ""
            lines += "## Próximas capturas úteis"
            lines += "- Prioridade: seguradas curtas e horizontais dos códigos difíceis, com debug ligado e validação manual depois."
            lines.addAll(captureSuggestions)
        }
        lines += ""

        lines += "## Acertos dependentes de correção textual"
        if (correctionDependentHits.isEmpty()) {
            lines += "- nenhum"
        } else {
            correctionDependentHits.forEach { entry ->
                val readText = if (entry.reads.isEmpty()) "-" else entry.reads.joinToString(" | ")
                lines += "- ${entry.frameId}: esperado=${entry.expected} via ${hitPathLabel(entry.expectedHitPath)} leituras=$readText"
            }
        }
        lines += ""

        lines += "## Leituras não resolvidas por razão"
        for ((reason, entries) in byReason) {
            lines += "### $reason (${entries.size})"
            entries.take(16).forEach { entry ->
                val readText = if (entry.reads.isEmpty()) "-" else entry.reads.joinToString(" | ")
                lines += "- ${entry.frameId}: boxes=${entry.boxes} crops=${entry.crops} reads=$readText"
            }
            if (entries.size > 16) {
                lines += "- ... e mais ${entries.size - 16} itens"
            }
        }
        lines += ""
        lines += "## Piores latências"
        sortedWorst.forEachIndexed { index, result ->
            val resolved = if (result.resolvedCodes.isEmpty()) "-" else result.resolvedCodes.joinToString(", ")
            lines += "${index + 1}. ${result.frameId} det=${result.detectionMs}ms ocr=${result.ocrMs}ms boxes=${result.boxes}/${result.inkBoxes} crops=${result.crops} respostas=$resolved"
        }
        lines += ""
        lines += "## Maior trabalho OCR"
        results.sortedByDescending { it.crops }.take(12).forEachIndexed { index, result ->
            val resolved = if (result.resolvedCodes.isEmpty()) "-" else result.resolvedCodes.joinToString(", ")
            val readText = if (result.reads.isEmpty()) "-" else result.reads.joinToString(" | ")
            lines += "${index + 1}. ${result.frameId} crops=${result.crops} boxes=${result.boxes}/${result.inkBoxes} respostas=$resolved leituras=$readText"
        }
        lines += ""
        lines += "## Falsos positivos"
        val falsePositiveRows = results.filter { it.hasFalsePositive }
        if (falsePositiveRows.isEmpty()) {
            lines += "- sem falsos positivos"
        } else {
            falsePositiveRows.forEach {
                val readText = if (it.reads.isEmpty()) "-" else it.reads.joinToString(" | ")
                lines += "- ${it.frameId}: resolvido=${it.resolvedCodes.joinToString(", ")} esperado=${it.expected.ifBlank { "-" }} leituras=$readText"
            }
        }
        lines += "## Split"
        lines += "- treino: ${bySplit["train"]?.size ?: 0}"
        lines += "- validação: ${bySplit["val"]?.size ?: 0}"
        lines += "- teste: ${bySplit["test"]?.size ?: 0}"
        lines += "- total com resultado: ${results.size}"
        for (name in arrayOf("train", "val", "test")) {
            val splitRows = bySplit[name].orEmpty()
            val positives = splitRows.filter { it.expected != notStickerLabel }
            val tp = positives.count { it.hasExpected }
            val fp = splitRows.count { it.hasFalsePositive }
            val miss = positives.count { !it.hasExpected }
            lines += "- $name -> tp=$tp miss=$miss fp=$fp"
        }
        lines += "- unresolved: ${unresolved.size}"
        if (unresolved.isNotEmpty()) {
            lines += "- sem leitura mas com ocr: ${unresolved.count { it.reads.isNotEmpty() }}"
            lines += "- sem leitura e sem ocr: ${unresolved.count { it.reads.isEmpty() }}"
        }
        if (unresolved.isNotEmpty()) {
            lines += ""
            lines += "## Diagnóstico dos positivos não resolvidos"
            unresolved.forEach { entry ->
                lines += "### ${entry.frameId} esperado=${entry.expected}"
                if (entry.diagnostics.isEmpty()) {
                    lines += "- sem diagnóstico"
                } else {
                    entry.diagnostics.take(16).forEach { lines += "- $it" }
                }
            }
        }

        FileWriter(reportFile).use { writer ->
            writer.write(lines.joinToString(System.lineSeparator()))
        }
        println("${reportFile.name}: positivos=$truePositives/$positiveRows fp=$falsePositives detMed=${String.format(Locale.US, "%.2f", detection.median())}ms ocrMed=${String.format(Locale.US, "%.2f", ocr.median())}ms")

        if (reportBase == "baseline" && maxBoxes == 2 && roi == Roi.CONFIG && fastConf == Config.Ocr.HYBRID_FAST_CONF) {
            assertTrue(verificationSource != null, "baseline Pixel benchmark requires a manually reviewed ground-truth CSV")
            assertTrue(scoringRows.isNotEmpty(), "baseline Pixel benchmark has no manually reviewed frames")
            if (isDefaultDataset()) {
                assertTrue(
                    positiveRows >= baselineMinPositiveRows,
                    "baseline Pixel benchmark is not using all manually reviewed positive frames: positives=$positiveRows",
                )
                assertTrue(
                    negativeRows >= baselineMinNegativeRows,
                    "baseline Pixel benchmark is not using all manually reviewed not-sticker frames: negatives=$negativeRows",
                )
            }
            assertEquals(0, falsePositives, "baseline Pixel benchmark must keep 0 false positives")
            assertEquals(0, missingPositiveFiles, "baseline Pixel benchmark has verified positives without frame files")
            if (isDefaultDataset() && positiveRows >= 3) {
                for (splitName in arrayOf("train", "val", "test")) {
                    assertTrue(
                        bySplit[splitName].orEmpty().any { it.expected != notStickerLabel },
                        "baseline Pixel benchmark split '$splitName' has no verified positives",
                    )
                }
            }
            val recallPercent = if (positiveRows > 0) truePositives * 100.0 / positiveRows else 0.0
            assertTrue(
                recallPercent >= baselineMinRecallPercent,
                "baseline Pixel benchmark recall regressed: resolved $truePositives/$positiveRows positives (${String.format(Locale.US, "%.2f", recallPercent)}%)",
            )
            if (isDefaultDataset()) {
                assertTrue(
                    confirmedHolds >= baselineMinConfirmedHolds,
                    "baseline Pixel benchmark hold confirmation regressed: confirmed $confirmedHolds/${confirmableHolds.size} confirmable holds",
                )
                assertTrue(
                    exactHits >= baselineMinExactHits,
                    "baseline Pixel benchmark exact OCR regressed: exact=$exactHits minimum=$baselineMinExactHits",
                )
                assertTrue(
                    correctionDependentHits.size <= baselineMaxCorrectionDependentHits,
                    "baseline Pixel benchmark correction debt regressed: correction-dependent=${correctionDependentHits.size} maximum=$baselineMaxCorrectionDependentHits",
                )
            }
            assertTrue(wrongHoldCommits.isEmpty(), "baseline Pixel benchmark produced wrong hold commits: $wrongHoldCommits")
            if (isDefaultDataset()) {
                assertTrue(
                    results.isEmpty() || totalCrops.toDouble() / results.size <= baselineMaxAverageCrops,
                    "baseline Pixel benchmark OCR work regressed: total crops=$totalCrops frames=${results.size}",
                )
                assertTrue(cropsP95 <= baselineMaxCropsP95, "baseline Pixel benchmark typical OCR work regressed: p95 crops=$cropsP95")
                assertTrue(maxCrops <= baselineMaxCropsPerFrame, "baseline Pixel benchmark has a high-work frame: max crops=$maxCrops")
            }
        }
    }
}
