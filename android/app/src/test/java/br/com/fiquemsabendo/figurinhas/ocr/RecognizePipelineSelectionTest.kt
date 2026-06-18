package br.com.fiquemsabendo.figurinhas.ocr

import kotlin.test.Test
import kotlin.test.assertEquals

class RecognizePipelineSelectionTest {
    private fun box(
        x: Double,
        y: Double,
        w: Double,
        h: Double,
        score: Double,
    ) = CodeBox(
        x = x,
        y = y,
        w = w,
        h = h,
        orient = 'h',
        score = score,
        tilt = null,
        pillW = h,
        fill = 0.70,
        boost = false,
    )

    @Test fun selectBoxesForOcr_keeps_overlapping_candidates_before_ocr() {
        val selected = selectBoxesForOcr(
            boxes = listOf(
                box(86.0, 318.0, 136.0, 52.0, score = 0.80),
                box(141.0, 334.0, 68.0, 20.0, score = 0.74),
            ),
            maxBoxes = 2,
            stopOnFirstCode = true,
            allowLateWideCandidates = false,
        )

        assertEquals(listOf(136.0, 68.0), selected.map { it.w })
    }

}
