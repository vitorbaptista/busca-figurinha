package br.com.fiquemsabendo.figurinhas.scan

import br.com.fiquemsabendo.figurinhas.Config
import br.com.fiquemsabendo.figurinhas.ocr.CodeBox
import br.com.fiquemsabendo.figurinhas.ocr.GrayImage
import br.com.fiquemsabendo.figurinhas.ocr.Roi
import br.com.fiquemsabendo.figurinhas.ocr.findCodeBoxes
import kotlin.math.abs
import kotlin.math.floor
import kotlin.math.max
import kotlin.math.min

enum class ScanGuidance {
    MOVE_CLOSER,
    CENTER_CODE,
    STRAIGHTEN_CODE,
    HOLD_STILL,
}

data class FrameQuality(
    val canCapture: Boolean,
    val guidance: ScanGuidance?,
    val boxes: List<CodeBox>,
)

/**
 * Live capture quality probe. It never recognizes or matches a code; it decides whether there is
 * enough visual evidence to spend a burst and exposes guidance for the existing hint text.
 */
fun assessFrameQuality(frame: GrayImage): FrameQuality =
    assessFrameQuality(frame, findCodeBoxes(frame, Roi.CONFIG))

internal fun assessFrameQuality(frame: GrayImage, boxes: List<CodeBox>): FrameQuality {
    if (frame.width <= 0 || frame.height <= 0) return FrameQuality(false, null, boxes)
    val candidates = boxes.take(Config.CaptureQuality.MAX_BOXES)
    if (candidates.isEmpty()) return FrameQuality(false, null, boxes)

    val roi = roiRect(frame)
    val checked = candidates.map { CandidateQuality(it, blockerFor(frame, roi, it), sharpness(frame, it)) }
    val accepted = checked.firstOrNull { it.blocker == null }
    if (accepted != null) {
        return FrameQuality(
            canCapture = true,
            guidance = if (accepted.sharpness < Config.CaptureQuality.MIN_SHARPNESS) {
                ScanGuidance.HOLD_STILL
            } else {
                null
            },
            boxes = boxes,
        )
    }

    return FrameQuality(true, checked.firstOrNull()?.blocker, boxes)
}

private data class CandidateQuality(
    val box: CodeBox,
    val blocker: ScanGuidance?,
    val sharpness: Double,
)

private data class RectD(val left: Double, val top: Double, val right: Double, val bottom: Double) {
    val width: Double get() = right - left
    val height: Double get() = bottom - top
    val centerX: Double get() = (left + right) / 2
    val centerY: Double get() = (top + bottom) / 2
}

private fun roiRect(frame: GrayImage): RectD =
    RectD(
        left = Config.Detect.ROI_LEFT * frame.width,
        top = Config.Detect.ROI_TOP * frame.height,
        right = Config.Detect.ROI_RIGHT * frame.width,
        bottom = Config.Detect.ROI_BOTTOM * frame.height,
    )

private fun blockerFor(frame: GrayImage, roi: RectD, box: CodeBox): ScanGuidance? {
    val edgeX = roi.width * Config.CaptureQuality.ROI_EDGE_MARGIN_FRACTION
    val edgeY = roi.height * Config.CaptureQuality.ROI_EDGE_MARGIN_FRACTION
    val touchesEdge =
        box.x <= roi.left + edgeX ||
            box.x + box.w >= roi.right - edgeX ||
            box.y <= roi.top + edgeY ||
            box.y + box.h >= roi.bottom - edgeY
    val cx = box.x + box.w / 2
    val cy = box.y + box.h / 2
    val offCenter =
        abs(cx - roi.centerX) > roi.width * Config.CaptureQuality.MAX_CENTER_OFFSET_X_ROI_FRACTION ||
            abs(cy - roi.centerY) > roi.height * Config.CaptureQuality.MAX_CENTER_OFFSET_Y_ROI_FRACTION
    if (touchesEdge || offCenter) return ScanGuidance.CENTER_CODE

    val longSide = max(box.w, box.h)
    val minLongSide = min(frame.width, frame.height) *
        Config.CaptureQuality.MIN_CODE_LONG_SIDE_FRAME_FRACTION
    if (longSide < minLongSide) return ScanGuidance.MOVE_CLOSER

    if (horizontalTiltDeg(box) > Config.CaptureQuality.MAX_HORIZONTAL_TILT_DEG) {
        return ScanGuidance.STRAIGHTEN_CODE
    }

    return null
}

private fun horizontalTiltDeg(box: CodeBox): Double {
    val tilt = box.tilt ?: return if (box.orient == 'h') 0.0 else 90.0
    return abs(tilt)
}

private fun sharpness(frame: GrayImage, box: CodeBox): Double {
    if (frame.width < 3 || frame.height < 3) return 0.0
    val x0 = floor(box.x).toInt().coerceIn(1, frame.width - 2)
    val y0 = floor(box.y).toInt().coerceIn(1, frame.height - 2)
    val x1 = floor(box.x + box.w).toInt().coerceIn(x0 + 1, frame.width - 1)
    val y1 = floor(box.y + box.h).toInt().coerceIn(y0 + 1, frame.height - 1)
    val step = max(1, min(x1 - x0, y1 - y0) / 72)
    var sum = 0.0
    var count = 0
    for (y in y0 until y1 step step) {
        val row = y * frame.width
        for (x in x0 until x1 step step) {
            val c = frame.pixels[row + x]
            val lap = 4 * c -
                frame.pixels[row + x - 1] -
                frame.pixels[row + x + 1] -
                frame.pixels[row - frame.width + x] -
                frame.pixels[row + frame.width + x]
            sum += abs(lap).toDouble()
            count++
        }
    }
    return if (count == 0) 0.0 else sum / count
}
