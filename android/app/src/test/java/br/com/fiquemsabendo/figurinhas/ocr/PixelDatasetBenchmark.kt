package br.com.fiquemsabendo.figurinhas.ocr

import br.com.fiquemsabendo.figurinhas.Config
import br.com.fiquemsabendo.figurinhas.data.checklist
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
// This class is intentionally assertion-free by default; it writes a report with metrics so we can
// compare strategy changes by reading the resulting file.
class PixelDatasetBenchmark {

    private val repoRoot: File = run {
        var dir = File(".").canonicalFile
        while (true) {
            if (File(dir, "captures/datasets/swe8-live-20260616-v1/dataset_manifest.csv").exists()) {
                return@run dir
            }
            val parent = dir.parentFile
            if (parent == null || parent.path == dir.path) break
            dir = parent
        }
        File(".").canonicalFile
    }

    private val datasetName = "swe8-live-20260616-v1"
    private val expectedCode = "SWE8"
    private val verificationFileName = "ground_truth_verification.csv"
    private val notStickerLabel = "not_sticker"

    private data class ManifestRow(
        val frameId: String,
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

    private data class FrameResult(
        val frameId: String,
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
        val reason: FailReason,
        val verified: Boolean,
        val diagnostics: List<String>,
    )

    private fun datasetRoot(): File = File(repoRoot, "captures/datasets/$datasetName")

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
                if (cols.size < 8) continue
                val split = cols[5].trim()
                val expected = cols[7].trim()
                if (split.isEmpty() || expected.isEmpty()) continue
                val frameId = cols[0].trim()
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
                        rawFramePath = cols[4].trim(),
                        split = split,
                        expected = expected,
                        verifiedCode = verifiedCode,
                        verificationStatus = status,
                        targetLabel = targetLabel,
                        isScored = verified != null && (status == "confirmed" || status == "not_sticker"),
                    ),
                )
            }
        }
        return rows
    }

    private fun loadVerification(): Map<String, VerificationRow> {
        val file = File(datasetRoot(), verificationFileName)
        if (!file.exists()) return emptyMap()

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
                rows[frameId] = VerificationRow(
                    frameId = frameId,
                    verifiedCode = cols.getOrNull(idxCode)?.trim() ?: "",
                    status = cols.getOrNull(idxStatus)?.trim()?.lowercase() ?: "",
                )
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

    private fun runBenchmark(
        roi: Roi = Roi.CONFIG,
        fastConf: Double = Config.Ocr.HYBRID_FAST_CONF,
        maxBoxes: Int = 4,
        modes: Array<ForegroundMode> = ForegroundMode.values(),
        fallbackToFullOnMiss: Boolean = false,
        fallbackDarkOnMiss: Boolean = false,
        hasManualVerification: Boolean = false,
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
            if (fallbackDarkOnMiss && outcome.resolved.isEmpty()) {
                val darkBoxes = findCodeBoxes(frame, roi, arrayOf(ForegroundMode.DARK))
                val darkOutcome = recognizeFrameInOrder(
                    engine = engine,
                    frame = frame,
                    checklist = checklist,
                    boxes = darkBoxes,
                    stopOnFirstCode = true,
                    maxBoxes = maxBoxes,
                )
                if (darkOutcome.resolved.isNotEmpty() || darkOutcome.reads.isNotEmpty() || darkOutcome.crops > 0) {
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
            val shouldScore = !hasManualVerification || row.isScoredFrame
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
                boxesToRun.flatMapIndexed { boxIndex, box ->
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
                    reads = reads,
                    hasExpected = hasExpected,
                    expected = target,
                    split = row.split,
                    hasFalsePositive = hasFalsePositive,
                    verified = row.isScored,
                    resolvedCodes = resolved,
                    detectionMs = detectionNs / 1_000_000L,
                    ocrMs = ocrNs / 1_000_000L,
                    boxes = outcome.boxes,
                    inkBoxes = inkBoxes,
                    crops = outcome.crops,
                    reason = reason,
                    diagnostics = diagnostics,
                ),
            )
        }
        return results
    }

    // Tunable matrix over ROI/confidence/box cap for live Pixel tuning.
    @Test fun run_swe8_pixel_dataset_benchmark() {
        runBenchmarkAndWrite(roi = Roi.CONFIG, fastConf = Config.Ocr.HYBRID_FAST_CONF, maxBoxes = 4, reportBase = "baseline", fallbackDarkOnMiss = true)
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
        fallbackDarkOnMiss: Boolean = false,
    ) {
        val hasManualVerificationGlobal = File(datasetRoot(), verificationFileName).exists()
        val results = runBenchmark(
            roi = roi,
            fastConf = fastConf,
            maxBoxes = maxBoxes,
            modes = modes,
            fallbackToFullOnMiss = fallbackToFullOnMiss,
            fallbackDarkOnMiss = fallbackDarkOnMiss,
            hasManualVerification = hasManualVerificationGlobal,
        )
        val manifestRows = manifestRows()
        val verificationExists = File(datasetRoot(), verificationFileName).exists()
        val scoringRows = if (verificationExists) manifestRows.filter { it.isScored } else manifestRows.filter { it.expected == expectedCode }
        val scoredResults = results.filter { it.verified || !verificationExists }
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
        val reasonNoBoxes = results.count { it.reason == FailReason.NO_BOXES }
        val reasonNoInk = results.count { it.reason == FailReason.BOXES_NO_INK }
        val reasonNoMatch = results.count { it.reason == FailReason.NO_MATCH }
        val p95Det = detection.p95()
        val p95Ocr = ocr.p95()

        val sortedWorst = results.sortedByDescending { it.ocrMs + it.detectionMs }.take(12)
        val unresolved = scoredResults.filter { it.expected != notStickerLabel && !it.hasExpected }
        val byReason = scoredResults.filter { it.reason != FailReason.NONE }.groupBy { it.reason }
        val bySplit = scoredResults.groupBy { it.split }
        val hits = scoredResults.filter { it.hasExpected }

        if (reportBase == "baseline" && maxBoxes == 4 && roi == Roi.CONFIG && fastConf == Config.Ocr.HYBRID_FAST_CONF) {
            assertEquals(0, falsePositives, "baseline Pixel benchmark must keep 0 false positives")
            assertEquals(0, missingPositiveFiles, "baseline Pixel benchmark has verified positives without frame files")
            if (positiveRows >= 3) {
                for (splitName in arrayOf("train", "val", "test")) {
                    assertTrue(
                        bySplit[splitName].orEmpty().any { it.expected != notStickerLabel },
                        "baseline Pixel benchmark split '$splitName' has no verified positives",
                    )
                }
            }
            assertEquals(
                positiveRows,
                truePositives,
                "baseline Pixel benchmark recall regressed: resolved $truePositives/$positiveRows positives",
            )
        }

        val lines = ArrayList<String>(260)
        lines += "# SWE8 Pixel Live Dataset Benchmark"
        val modeConfig = modes.joinToString(".") { it.name.lowercase() }
        lines += "- config: roi=${String.format(Locale.US, "%.2f", roi.left)},${String.format(Locale.US, "%.2f", roi.top)},${String.format(Locale.US, "%.2f", roi.right)},${String.format(Locale.US, "%.2f", roi.bottom)} fastConf=${String.format(Locale.US, "%.1f", fastConf)} maxBoxes=$maxBoxes modes=$modeConfig"
        lines += "- frames no manifest: ${manifestRows.size}"
        lines += "- frames processados (frame disponível): ${results.size}"
        if (verificationExists) {
            lines += "- frames com ground-truth confirmado: ${scoringRows.size}"
        } else {
            lines += "- frames com ground-truth confirmado: 0 (usando labels do manifesto)"
        }
        lines += "- frames faltando arquivo de frame: $missingFiles"
        if (missingFiles > 0) {
            lines += "- frames positivos/negativos faltando arquivo: $missingPositiveFiles/$missingNegativeFiles"
        }
        val fallbackLabel = buildString {
            if (fallbackToFullOnMiss && roi != Roi.FULL) append(" + fallback_full")
            if (fallbackDarkOnMiss) append(" + fallback_dark")
        }
        lines += "- estratégia de busca: $fallbackLabel"
        lines += "- resolvidos positivos: $truePositives/$positiveRows"
        lines += "- precisão positiva: ${String.format(Locale.US, "%.2f", if ((truePositives + falsePositives) > 0) truePositives * 100.0 / (truePositives + falsePositives) else 0.0)}%"
        lines += "- recall positivo: ${String.format(Locale.US, "%.2f", if (positiveRows > 0) truePositives * 100.0 / positiveRows else 0.0)}%"
        lines += "- positivos não lidos: $misses"
        lines += "- falsos positivos: $falsePositives de $negativeRows não-sticker processados"
        if (verificationExists) {
            lines += "- frames positivos/negativos no GT manual: $manifestPositiveRows/$manifestNegativeRows"
        }
        val negativeFalsePositiveRate = if (negativeRows > 0) {
            String.format(Locale.US, "%.2f", falsePositives * 100.0 / negativeRows)
        } else {
            "0.00"
        }
        lines += "- taxa de falso positivo por não-sticker: $negativeFalsePositiveRate%"
        lines += "- média de leituras candidatas por frame: $positivesPredicted"
        val unscored = results.count { !it.verified && verificationExists }
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
        lines += "- média de crops com ink: ${String.format(Locale.US, "%.2f", results.map { it.inkBoxes }.average())}"
        lines += ""

        lines += "## Acertos ($expectedCode)"
        if (hits.isEmpty()) {
            lines += "- nenhum"
        } else {
            hits.forEach { lines += "- ${it.frameId}: ${it.resolvedCodes.joinToString(", ")}" }
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
        lines += "## Falsos positivos"
        val falsePositiveRows = results.filter { it.hasFalsePositive }
        if (falsePositiveRows.isEmpty()) {
            lines += "- sem falsos positivos"
        } else {
            falsePositiveRows.forEach { lines += "- ${it.frameId}: ${it.resolvedCodes.joinToString(", ")}" }
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
    }
}
