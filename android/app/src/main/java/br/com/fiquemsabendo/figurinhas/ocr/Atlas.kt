package br.com.fiquemsabendo.figurinhas.ocr

import java.io.InputStream
import java.nio.ByteBuffer
import java.nio.ByteOrder

// Loads the pre-baked glyph atlas into the FlatAtlas the classifier consumes. The atlas is
// rendered ONCE in a real browser by scripts/export-atlas.mjs (node-canvas mis-renders, per
// CLAUDE.md) and shipped as a binary asset (android/app/src/main/assets/glyph_atlas.bin), so the
// native atlas is byte-faithful to the PWA's runtime atlas and startup pays no render cost.
//
// Format (little-endian): "ATL1" | count:i32 | featLen:i32 | count label bytes (ASCII) |
// count*featLen float32. See src/dev/atlasExport.ts for the writer.

private const val MAGIC = "ATL1"

/** Parse the packed atlas bytes into a FlatAtlas. Pure (JVM-testable). */
fun parseAtlas(bytes: ByteArray): FlatAtlas {
    val bb = ByteBuffer.wrap(bytes).order(ByteOrder.LITTLE_ENDIAN)
    val magic = ByteArray(4)
    bb.get(magic)
    val magicStr = String(magic, Charsets.US_ASCII)
    require(magicStr == MAGIC) { "bad atlas magic '$magicStr'" }
    val count = bb.int
    val featLen = bb.int
    require(count >= 0) { "bad atlas count $count" }
    require(featLen == FEAT_LEN) { "atlas featLen $featLen != FEAT_LEN $FEAT_LEN" }
    val expected = 12 + count + count * featLen * 4
    require(bytes.size == expected) { "atlas size ${bytes.size} != expected $expected" }

    val labels = CharArray(count)
    val isDigit = BooleanArray(count)
    for (t in 0 until count) {
        val ch = (bb.get().toInt() and 0xFF).toChar()
        labels[t] = ch
        isDigit[t] = ch in '0'..'9'
    }
    val feats = FloatArray(count * featLen)
    for (i in feats.indices) feats[i] = bb.float
    return FlatAtlas(feats, count, isDigit, labels)
}

/** Load + parse the atlas from a stream (closes it). At runtime the app passes
 *  context.assets.open("glyph_atlas.bin"); tests pass a file/byte stream. */
fun loadAtlas(input: InputStream): FlatAtlas = input.use { parseAtlas(it.readBytes()) }
