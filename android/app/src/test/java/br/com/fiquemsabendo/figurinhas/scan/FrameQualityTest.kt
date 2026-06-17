package br.com.fiquemsabendo.figurinhas.scan

import br.com.fiquemsabendo.figurinhas.Config
import br.com.fiquemsabendo.figurinhas.ocr.CodeBox
import br.com.fiquemsabendo.figurinhas.ocr.GrayImage
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNull
import kotlin.test.assertTrue

class FrameQualityTest {
    private val width = 480
    private val height = 640

    private fun sharpFrame(): GrayImage {
        val pixels = IntArray(width * height) { 160 }
        for (y in 0 until height) {
            val row = y * width
            for (x in 0 until width) {
                pixels[row + x] = if (((x / 4) + (y / 4)) % 2 == 0) 48 else 224
            }
        }
        return GrayImage(width, height, pixels)
    }

    private fun softFrame(): GrayImage = GrayImage(width, height, IntArray(width * height) { 160 })

    private fun box(
        x: Double = 165.0,
        y: Double = 262.0,
        w: Double = 150.0,
        h: Double = 52.0,
        orient: Char = 'h',
        tilt: Double? = 0.0,
    ): CodeBox =
        CodeBox(
            x = x,
            y = y,
            w = w,
            h = h,
            orient = orient,
            score = 0.88,
            tilt = tilt,
            pillW = h * 0.7,
            fill = 0.72,
            boost = false,
        )

    @Test fun centered_sharp_horizontal_code_can_capture_without_guidance() {
        val q = assessFrameQuality(sharpFrame(), listOf(box()))

        assertTrue(q.canCapture)
        assertNull(q.guidance)
    }

    @Test fun no_detected_code_does_not_capture() {
        val q = assessFrameQuality(sharpFrame(), emptyList())

        assertFalse(q.canCapture)
        assertNull(q.guidance)
    }

    @Test fun small_code_can_capture_with_move_closer_guidance() {
        val q = assessFrameQuality(sharpFrame(), listOf(box(x = 215.0, y = 280.0, w = 50.0, h = 18.0)))

        assertTrue(q.canCapture)
        assertEquals(ScanGuidance.MOVE_CLOSER, q.guidance)
    }

    @Test fun code_touching_roi_edge_can_capture_with_center_guidance() {
        val roiLeft = Config.Detect.ROI_LEFT * width
        val q = assessFrameQuality(sharpFrame(), listOf(box(x = roiLeft + 2.0, y = 262.0)))

        assertTrue(q.canCapture)
        assertEquals(ScanGuidance.CENTER_CODE, q.guidance)
    }

    @Test fun tilted_code_can_capture_with_straighten_guidance() {
        val q = assessFrameQuality(sharpFrame(), listOf(box(tilt = 24.0)))

        assertTrue(q.canCapture)
        assertEquals(ScanGuidance.STRAIGHTEN_CODE, q.guidance)
    }

    @Test fun soft_code_guides_but_does_not_block_ocr() {
        val q = assessFrameQuality(softFrame(), listOf(box()))

        assertTrue(q.canCapture)
        assertEquals(ScanGuidance.HOLD_STILL, q.guidance)
    }

    @Test fun any_acceptable_candidate_allows_capture() {
        val roiLeft = Config.Detect.ROI_LEFT * width
        val q = assessFrameQuality(sharpFrame(), listOf(box(x = roiLeft + 2.0), box()))

        assertTrue(q.canCapture)
        assertNull(q.guidance)
    }
}
