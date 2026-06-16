package br.com.fiquemsabendo.figurinhas.ocr

import br.com.fiquemsabendo.figurinhas.data.checklist
import java.io.File
import java.util.zip.GZIPInputStream
import kotlin.test.Test
import kotlin.test.assertTrue

// END-TO-END recognizer validation on REAL sticker backs. The whole recognizer is pure Kotlin (no
// android.*), so we run it on the host JVM: a real frame → GrayImage → loadAtlas (the shipped binary)
// → recognizeFrameInOrder, exactly as the device would. This is the on-device correctness check the
// design called "device-gated" — it turns out the recognizer is host-runnable, so the port's accuracy
// + the 0-FP rule are validated here, not only on the Pixel.
//
// The fixtures are the SAME real photos the PWA used (data/raw/stickers/*.jpg), pre-converted to
// grayscale PGM and gzipped into test resources (Android unit tests have no JPEG decoder — android.jar
// shadows javax.imageio). They are close-up photos, NOT bottom-framed, so we detect FULL-FRAME
// (roiTopFraction = 0.0) like the PWA benches; the live app uses the 0.67 bottom-band ROI. We run the
// glyph path at a LOW accept gate (fastConf = 0) so a read the conservative 0.70 live gate would defer
// to the (not-yet-wired) Tesseract fallback still proves the locate→prep→glyph→match chain reads the
// real font. matchCode stays conservative, so a low gate still cannot invent a non-checklist code.

class RecognizerGoldenTest {

    /** Load a gzipped P5 (binary) PGM from the test classpath into a luma GrayImage. */
    private fun loadFrame(resource: String): GrayImage? {
        val raw = javaClass.getResourceAsStream(resource)?.use { GZIPInputStream(it).readBytes() } ?: return null
        var pos = 0
        fun skipWs() {
            while (pos < raw.size) {
                val c = raw[pos].toInt().toChar()
                when {
                    c == '#' -> while (pos < raw.size && raw[pos].toInt() != '\n'.code) pos++
                    c.isWhitespace() -> pos++
                    else -> return
                }
            }
        }
        fun token(): String {
            skipWs()
            val sb = StringBuilder()
            while (pos < raw.size && !raw[pos].toInt().toChar().isWhitespace()) {
                sb.append(raw[pos].toInt().toChar()); pos++
            }
            return sb.toString()
        }
        if (token() != "P5") return null
        val w = token().toInt()
        val h = token().toInt()
        token() // maxval (255)
        pos++ // the single whitespace byte after maxval, then binary pixels
        if (pos + w * h > raw.size) return null
        val px = IntArray(w * h) { raw[pos + it].toInt() and 0xFF }
        return GrayImage(w, h, px)
    }

    private fun atlas(): FlatAtlas? {
        val f = File("src/main/assets/glyph_atlas.bin")
        if (!f.exists()) return null
        return loadAtlas(f.inputStream())
    }

    /** Recognizer with a low accept gate so the full glyph chain is exercised (see header). */
    private fun recognizer(gate: Double = 0.0): FrameRecognizer? =
        atlas()?.let { GlyphOnlyRecognizer(GlyphRecognizer(it), fastConf = gate) }

    private fun run(resource: String, stopOnFirst: Boolean): Pair<List<String>, List<String>>? {
        val frame = loadFrame(resource) ?: return null
        val eng = recognizer() ?: return null
        val out = recognizeFrameInOrder(eng, frame, checklist, stopOnFirstCode = stopOnFirst, roi = Roi.FULL)
        return out.resolved.mapNotNull { it.entry?.code } to out.reads
    }

    @Test fun reads_CIV12_from_a_real_back() {
        val (codes, reads) = run("/stickers/CIV12.pgm.gz", stopOnFirst = true) ?: return
        assertTrue("CIV12" in codes, "expected CIV12; resolved=$codes reads=$reads")
    }

    @Test fun reads_EGY4_from_a_real_back() {
        val (codes, reads) = run("/stickers/EGY4.pgm.gz", stopOnFirst = true) ?: return
        assertTrue("EGY4" in codes, "expected EGY4; resolved=$codes reads=$reads")
    }

    @Test fun multi_sticker_frame_has_zero_false_positives() {
        // Ground truth = the six codes encoded in the filename.
        val truth = setOf("RSA17", "EGY5", "CIV12", "RSA19", "EGY4", "AUT4")
        val (codes, reads) = run("/stickers/RSA17_EGY5_CIV12_RSA19_EGY4_AUT4.pgm.gz", stopOnFirst = false) ?: return
        val codeSet = codes.toSet()
        // THE CARDINAL RULE: every resolved code must be one of the six really present — 0 false positives.
        val falsePositives = codeSet - truth
        assertTrue(falsePositives.isEmpty(), "FALSE POSITIVES $falsePositives — resolved=$codeSet reads=$reads")
        // And recover at least one (full recall is validated live; this is a floor that the chain works).
        assertTrue(codeSet.isNotEmpty(), "resolved nothing; reads=$reads")
    }
}
