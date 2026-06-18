package br.com.fiquemsabendo.figurinhas.scan

import br.com.fiquemsabendo.figurinhas.ocr.CapturePhase
import br.com.fiquemsabendo.figurinhas.ocr.CodeBox
import br.com.fiquemsabendo.figurinhas.ocr.CodeBoxSource
import kotlin.math.abs
import kotlin.math.max
import kotlin.math.min

/** Normalized crop rectangle (0..1 in display-oriented frame coordinates) for the debug overlay. */
data class DebugCropBox(
    val left: Float,
    val top: Float,
    val right: Float,
    val bottom: Float,
    val score: Double,
    val source: CodeBoxSource = CodeBoxSource.COMPONENT,
)

/** Live debug snapshot the Scan screen renders when the Ajustes debug toggle is on. */
data class DebugInfo(
    val tick: Long = 0,                         // increments every camera frame (heartbeat)
    val phase: CapturePhase = CapturePhase.WAITING,
    val diffPct: Int = 0,                       // last frame-diff, 0..100
    val heldMs: Long = 0,                       // ms the sticker has been held still
    val reads: List<String> = emptyList(),      // raw OCR texts from the last recognize (RecognizeOutcome.reads)
    val resolved: List<String> = emptyList(),   // checklist codes the last frame resolved
    val committed: List<String> = emptyList(),  // codes that actually committed (post confirm+cooldown)
    val crops: Int = 0,                         // crops OCR'd last recognize (RecognizeOutcome.crops)
    val cropBoxes: List<DebugCropBox> = emptyList(), // detected crop regions from the last recognize
    val lastMs: Long = 0,                        // wall-clock ms the last recognize took
    val cameraFps: Double = 0.0,                 // camera frame-delivery rate (input, ~30 fps)
    val ocrFps: Double = 0.0,                    // recognitions completed per second (OCR throughput)
    val dumpEnabled: Boolean = false,           // is frame/crop dumping on?
    val lastDumpDir: String? = null,            // absolute dir of the last dump (for "adb pull")
)

/** Mirrors Locate.cropRegion's padFrac so the overlay shows the actual OCR crop extent. */
internal const val DEBUG_CROP_PAD_FRAC = 0.18

/** Include late horizontal-scan candidates, not just the first live OCR boxes. */
internal const val DEBUG_CROP_BOXES = 8
private const val DEBUG_COMPONENT_BOXES = 4
private const val DEBUG_HORIZONTAL_SCAN_BOXES = 4
private const val DEBUG_CROP_DUP_COVERAGE = 0.48
private const val DEBUG_CROP_SAME_BAND_X_OVERLAP = 0.18
private const val DEBUG_CROP_SAME_BAND_CENTER_Y_FRAC = 0.70

internal fun selectDebugCodeBoxes(boxes: List<CodeBox>): List<CodeBox> {
    val selected = ArrayList<CodeBox>(DEBUG_CROP_BOXES)
    fun addIfDistinct(box: CodeBox) {
        if (selected.any { debugCropDuplicate(box, it) }) return
        selected.add(box)
    }

    boxes.filter { it.source != CodeBoxSource.HORIZONTAL_SCAN }
        .take(DEBUG_COMPONENT_BOXES)
        .forEach(::addIfDistinct)
    boxes.filter { it.source == CodeBoxSource.HORIZONTAL_SCAN }
        .take(DEBUG_HORIZONTAL_SCAN_BOXES)
        .forEach(::addIfDistinct)
    return selected.take(DEBUG_CROP_BOXES)
}

private fun debugCropDuplicate(a: CodeBox, b: CodeBox): Boolean =
    debugCropCoverage(a, b) > DEBUG_CROP_DUP_COVERAGE || sameDebugHorizontalBand(a, b)

private fun paddedRect(box: CodeBox): DoubleArray {
    val x0 = box.x - box.w * DEBUG_CROP_PAD_FRAC
    val y0 = box.y - box.h * DEBUG_CROP_PAD_FRAC
    val x1 = box.x + box.w * (1 + DEBUG_CROP_PAD_FRAC)
    val y1 = box.y + box.h * (1 + DEBUG_CROP_PAD_FRAC)
    return doubleArrayOf(x0, y0, x1, y1)
}

private fun debugCropCoverage(a: CodeBox, b: CodeBox): Double {
    val ar = paddedRect(a)
    val br = paddedRect(b)
    val inter = max(0.0, min(ar[2], br[2]) - max(ar[0], br[0])) *
        max(0.0, min(ar[3], br[3]) - max(ar[1], br[1]))
    val smaller = min((ar[2] - ar[0]) * (ar[3] - ar[1]), (br[2] - br[0]) * (br[3] - br[1]))
    return if (smaller > 0) inter / smaller else 0.0
}

private fun sameDebugHorizontalBand(a: CodeBox, b: CodeBox): Boolean {
    if (a.orient != 'h' || b.orient != 'h') return false
    val ar = paddedRect(a)
    val br = paddedRect(b)
    val overlapX = min(ar[2], br[2]) - max(ar[0], br[0])
    if (overlapX <= 0) return false
    val smallerW = min(ar[2] - ar[0], br[2] - br[0])
    if (smallerW <= 0 || overlapX / smallerW < DEBUG_CROP_SAME_BAND_X_OVERLAP) return false
    val centerY = abs((ar[1] + ar[3]) / 2 - (br[1] + br[3]) / 2)
    val maxH = max(ar[3] - ar[1], br[3] - br[1])
    return centerY <= maxH * DEBUG_CROP_SAME_BAND_CENTER_Y_FRAC
}
