package br.com.fiquemsabendo.figurinhas.ocr

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class GlyphFeaturesTest {
    private val ink = 0
    private val bg = 255

    /** Build a white GrayImage and paint filled ink rectangles into it. ink = dark (0). */
    private fun canvas(w: Int, h: Int, vararg rects: IntArray): GrayImage {
        val px = IntArray(w * h) { bg }
        for (r in rects) {
            val x0 = r[0]; val y0 = r[1]; val x1 = r[2]; val y1 = r[3]
            for (y in y0..y1) for (x in x0..x1) px[y * w + x] = ink
        }
        return GrayImage(w, h, px)
    }

    private fun rect(x0: Int, y0: Int, x1: Int, y1: Int) = intArrayOf(x0, y0, x1, y1)

    private fun sumSq(v: FloatArray): Float {
        var s = 0f
        for (f in v) s += f * f
        return s
    }

    @Test fun two_separated_rects_give_two_left_to_right_normalized_boxes() {
        // Two glyph-sized filled rectangles with a clear horizontal gap.
        val img = canvas(
            60, 30,
            rect(6, 6, 17, 23),  // left glyph (12 x 18)
            rect(34, 6, 45, 23), // right glyph (12 x 18)
        )
        val glyphs = extractGlyphs(img)
        assertEquals(2, glyphs.size, "expected two glyph boxes")
        // Ordered left-to-right.
        assertTrue(glyphs[0].x < glyphs[1].x, "boxes must be ordered left-to-right")
        for (g in glyphs) {
            assertEquals(FEAT_LEN, g.feat.size, "feature length must be FEAT_LEN")
            assertEquals(1.0f, sumSq(g.feat), 1e-3f) // L2-normalized
        }
    }

    @Test fun feat_len_is_298() {
        // GRID*GRID + GRID + GRID + ZONE*ZONE + 1 = 256 + 16 + 16 + 9 + 1.
        assertEquals(298, FEAT_LEN)
        assertEquals(16, GRID)
    }

    @Test fun thin_tall_vs_wide_differ_in_ar_and_are_distinguishable() {
        // A thin-tall glyph and a wide glyph, each segmented on its own crop so each is the
        // band median (avoids cross-glyph band filtering).
        val thin = canvas(30, 30, rect(13, 4, 16, 25)) // 4 wide, 22 tall -> tiny min/max
        val wide = canvas(40, 30, rect(6, 11, 18, 20)) // 13 wide (<14, not split), 10 tall
        val tg = extractGlyphs(thin)
        val wg = extractGlyphs(wide)
        assertEquals(1, tg.size)
        assertEquals(1, wg.size)
        val tAr = tg[0].feat.last()
        val wAr = wg[0].feat.last()
        // Thin glyph -> small min/max ratio -> small AR channel; wide -> larger.
        assertTrue(tAr < wAr, "thin AR ($tAr) should be smaller than wide AR ($wAr)")
        // The two glyphs are clearly distinguishable by cosine.
        assertTrue(cosine(tg[0].feat, wg[0].feat) < 0.99f, "thin vs wide should be distinguishable")
    }

    @Test fun tiny_speck_alongside_normal_glyph_is_dropped() {
        // A normal glyph plus a 2x2 speck far below the band height -> filtered out.
        val img = canvas(
            60, 40,
            rect(6, 6, 17, 27),  // normal glyph (12 x 22)
            rect(40, 35, 41, 36), // 2x2 speck
        )
        val glyphs = extractGlyphs(img)
        assertEquals(1, glyphs.size, "the speck must be dropped by the band/area filter")
    }

    @Test fun wide_bridged_blob_is_split_into_two() {
        // Two glyph-sized boxes joined by a thin 1px-tall bridge; total width > 1.25x height,
        // so splitWide cuts it at the column-ink valley (the bridge).
        val img = canvas(
            60, 30,
            rect(8, 4, 21, 25),  // left body (14 x 22)
            rect(30, 4, 43, 25), // right body (14 x 22)
            rect(22, 14, 29, 14), // 1px-tall bridge joining them (one connected blob)
        )
        // Sanity: with the bridge it is one connected component spanning ~36 wide vs 22 tall.
        val glyphs = extractGlyphs(img)
        assertEquals(2, glyphs.size, "a wide bridged blob must be split into two glyphs")
        assertTrue(glyphs[0].x < glyphs[1].x, "split halves ordered left-to-right")
    }

    @Test fun short_code_with_merged_middle_component_splits_the_middle_glyph() {
        // A 3-letter + 1-digit code can arrive as three components when the middle two letters
        // bridge softly. The middle blob is wide enough to be suspicious but below the global
        // split threshold, so the short-code rescue should split only that middle component.
        val img = canvas(
            100, 36,
            rect(8, 7, 19, 28),   // first glyph
            rect(32, 7, 57, 28),  // two middle glyphs merged, 26 x 22 (< 1.25h, > 1.10h)
            rect(74, 7, 85, 28),  // last glyph
        )

        val glyphs = extractGlyphs(img)

        assertEquals(4, glyphs.size, "a short-code middle merge must be split into four glyphs")
        assertTrue(glyphs[0].x < glyphs[1].x && glyphs[1].x < glyphs[2].x && glyphs[2].x < glyphs[3].x)
    }
}
