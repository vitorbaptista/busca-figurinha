package br.com.fiquemsabendo.figurinhas.ocr

import java.io.File
import java.nio.ByteBuffer
import java.nio.ByteOrder
import kotlin.math.abs
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class AtlasTest {
    private fun pack(labels: CharArray, feats: Array<FloatArray>): ByteArray {
        val count = labels.size
        val buf = ByteBuffer.allocate(12 + count + count * FEAT_LEN * 4).order(ByteOrder.LITTLE_ENDIAN)
        buf.put('A'.code.toByte()); buf.put('T'.code.toByte()); buf.put('L'.code.toByte()); buf.put('1'.code.toByte())
        buf.putInt(count); buf.putInt(FEAT_LEN)
        for (l in labels) buf.put(l.code.toByte())
        for (f in feats) { require(f.size == FEAT_LEN); for (v in f) buf.putFloat(v) }
        return buf.array()
    }

    @Test fun round_trips_a_synthetic_atlas() {
        val f0 = FloatArray(FEAT_LEN) { if (it == 0) 1f else 0f }
        val f1 = FloatArray(FEAT_LEN) { if (it == 1) 1f else 0f }
        val atlas = parseAtlas(pack(charArrayOf('C', '1'), arrayOf(f0, f1)))
        assertEquals(2, atlas.count)
        assertEquals('C', atlas.labels[0]); assertEquals('1', atlas.labels[1])
        assertEquals(false, atlas.isDigit[0]); assertEquals(true, atlas.isDigit[1])
        assertEquals(FEAT_LEN * 2, atlas.feats.size)
        assertEquals(1f, atlas.feats[0]); assertEquals(1f, atlas.feats[FEAT_LEN + 1])
    }

    @Test fun real_baked_atlas_loads_when_present() {
        // The pre-baked asset from scripts/export-atlas.mjs. Unit tests run with the app module
        // as the working dir, so the asset is at src/main/assets/. Best-effort: skip if absent.
        val file = File("src/main/assets/glyph_atlas.bin")
        if (!file.exists()) return
        val atlas = loadAtlas(file.inputStream())
        assertTrue(atlas.count > 100, "expected a populated atlas, got ${atlas.count}")
        assertEquals(atlas.count * FEAT_LEN, atlas.feats.size)
        // Every label is one of the 36 classes (A–Z, 0–9).
        assertTrue(atlas.labels.all { it in 'A'..'Z' || it in '0'..'9' }, "unexpected label class")
        // buildAtlas L2-normalizes each template; spot-check template 0.
        var sumSq = 0.0
        for (i in 0 until FEAT_LEN) { val v = atlas.feats[i]; sumSq += (v * v).toDouble() }
        assertTrue(abs(sumSq - 1.0) < 1e-2, "template 0 not L2-normalized: $sumSq")
        // isDigit must agree with the label.
        for (t in 0 until atlas.count) assertEquals(atlas.labels[t] in '0'..'9', atlas.isDigit[t])
    }
}
