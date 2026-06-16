package br.com.fiquemsabendo.figurinhas.ocr

// The one image type the whole recognizer works on. Camera frames arrive as the YUV Y (luma)
// plane — already exactly this — so there is no per-frame RGBA readback (the PWA paid that via
// canvas getImageData). Prepared/binary crops reuse this with values pinned to 0 (ink/black)
// and 255 (white), matching the PWA's prepForOcr output convention.

/** A grayscale image: row-major luma values 0 (black) .. 255 (white). */
class GrayImage(val width: Int, val height: Int, val pixels: IntArray) {
    init {
        require(width >= 0 && height >= 0) { "negative dimensions $width x $height" }
        require(pixels.size == width * height) { "pixels ${pixels.size} != $width*$height" }
    }

    fun at(x: Int, y: Int): Int = pixels[y * width + x]

    /** Extract an axis-aligned sub-region, clamped to image bounds (never empty for a
     *  non-empty source). Mirrors the PWA's cropRegion drawImage with clamping. */
    fun crop(x0: Int, y0: Int, w: Int, h: Int): GrayImage {
        if (width == 0 || height == 0) return GrayImage(0, 0, IntArray(0))
        val sx = x0.coerceIn(0, width - 1)
        val sy = y0.coerceIn(0, height - 1)
        val ww = w.coerceIn(1, width - sx)
        val hh = h.coerceIn(1, height - sy)
        val out = IntArray(ww * hh)
        for (yy in 0 until hh) {
            val srcRow = (sy + yy) * width + sx
            val dstRow = yy * ww
            System.arraycopy(pixels, srcRow, out, dstRow, ww)
        }
        return GrayImage(ww, hh, out)
    }

    companion object {
        /** A solid image filled with [value] (default white = 255). */
        fun filled(w: Int, h: Int, value: Int = 255): GrayImage =
            GrayImage(w, h, IntArray(w * h) { value })
    }
}
