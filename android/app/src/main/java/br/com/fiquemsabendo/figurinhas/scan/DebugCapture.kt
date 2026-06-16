package br.com.fiquemsabendo.figurinhas.scan

import android.content.Context
import android.graphics.Bitmap
import br.com.fiquemsabendo.figurinhas.ocr.GrayImage
import java.io.File
import java.io.FileOutputStream

// Frame/crop dumper for the live debug readout (mirrors ScanScreen.tsx's postDebugImg, which POSTs
// the camera frame to the dev server's ./captures). Here there is no dev server, so we write PNGs to
// the app's external files dir, which `adb pull` can fetch. This is runtime code: it touches
// android.graphics, never runs under the JVM unit tests, and is only reached behind the Ajustes
// debug toggle.

/**
 * Writes a GrayImage frame plus its prepared crops to disk for offline inspection ("adb pull").
 * Failures are swallowed (debug-only, best-effort) — a dump must never crash the scan loop.
 */
class DebugCapture(private val context: Context) {

    /**
     * Dump [frame] (as frame.png) and [crops] (crop0.png, crop1.png, …) into
     * <externalFilesDir>/debug/<label>/, returning that directory's absolute path. On any failure
     * the attempted path is returned anyway so the UI still shows where it tried to write.
     */
    fun dump(label: String, frame: GrayImage, crops: List<GrayImage>): String {
        val dir = File(context.getExternalFilesDir("debug"), label)
        return try {
            dir.mkdirs()
            writePng(File(dir, "frame.png"), frame)
            crops.forEachIndexed { i, crop -> writePng(File(dir, "crop$i.png"), crop) }
            dir.absolutePath
        } catch (_: Throwable) {
            dir.absolutePath
        }
    }

    /** Encode a GrayImage as an opaque grayscale PNG (each luma v → ARGB 0xFFvvvvvv). */
    private fun writePng(file: File, img: GrayImage) {
        val w = img.width
        val h = img.height
        if (w <= 0 || h <= 0) return
        val argb = IntArray(w * h)
        val src = img.pixels
        for (i in argb.indices) {
            val v = src[i].coerceIn(0, 255)
            argb[i] = (0xFF shl 24) or (v shl 16) or (v shl 8) or v
        }
        val bitmap = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888)
        bitmap.setPixels(argb, 0, w, 0, 0, w, h)
        FileOutputStream(file).use { out -> bitmap.compress(Bitmap.CompressFormat.PNG, 100, out) }
        bitmap.recycle()
    }
}
