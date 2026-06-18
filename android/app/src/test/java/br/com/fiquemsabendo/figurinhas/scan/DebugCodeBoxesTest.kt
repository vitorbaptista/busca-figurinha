package br.com.fiquemsabendo.figurinhas.scan

import br.com.fiquemsabendo.figurinhas.ocr.CodeBox
import br.com.fiquemsabendo.figurinhas.ocr.CodeBoxSource
import kotlin.test.Test
import kotlin.test.assertEquals

class DebugCodeBoxesTest {
    private fun box(
        x: Double,
        y: Double,
        w: Double,
        h: Double,
        score: Double = 0.80,
        source: CodeBoxSource = CodeBoxSource.COMPONENT,
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
        source = source,
    )

    @Test fun selectDebugCodeBoxes_collapses_shifted_boxes_on_the_same_pill_band() {
        val selected = selectDebugCodeBoxes(
            listOf(
                box(100.0, 100.0, 120.0, 38.0, score = 0.92),
                box(142.0, 96.0, 112.0, 34.0, score = 0.86),
                box(82.0, 112.0, 190.0, 54.0, score = 0.70, source = CodeBoxSource.HORIZONTAL_SCAN),
            ),
        )

        assertEquals(1, selected.size, "same-band debug boxes should draw as one rectangle")
    }

    @Test fun selectDebugCodeBoxes_keeps_side_by_side_boxes() {
        val selected = selectDebugCodeBoxes(
            listOf(
                box(80.0, 100.0, 100.0, 34.0, score = 0.90),
                box(250.0, 100.0, 100.0, 34.0, score = 0.88),
            ),
        )

        assertEquals(2, selected.size, "separate side-by-side candidates should remain visible")
    }
}
