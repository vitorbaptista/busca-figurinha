package br.com.fiquemsabendo.figurinhas.ocr

import kotlin.math.abs
import kotlin.math.ceil
import kotlin.math.cos
import kotlin.math.floor
import kotlin.math.sin

// Pure-array image rotation. The PWA rotated via HTML canvas; on Android the frames are plain
// luma arrays, so we do the pixel math directly (no android.graphics) to stay JVM-unit-testable.
// Angles are clockwise, matching the canvas convention (+y down => ctx.rotate is clockwise).

// Corners freed by an off-axis rotation are filled neutral grey, not black: prepForOcr's
// border-flood removes them, and grey never binarizes to ink the way black corners would.
private const val GREY_FILL = 122

/** Rotate by a right-angle multiple (0/90/180/270, clockwise). angle 0 returns src unchanged;
 *  90/270 swap width/height. Exact pixel remap, no interpolation. Ports rotateCanvas. */
fun rotateRightAngle(src: GrayImage, angle: Int): GrayImage {
    require(angle == 0 || angle == 90 || angle == 180 || angle == 270) {
        "angle must be 0/90/180/270, got $angle"
    }
    if (angle == 0) return src

    val w = src.width
    val h = src.height
    val swap = angle == 90 || angle == 270
    val nw = if (swap) h else w
    val nh = if (swap) w else h
    val out = IntArray(nw * nh)

    // For each source pixel, write it to its rotated destination (clockwise).
    for (y in 0 until h) {
        for (x in 0 until w) {
            val v = src.pixels[y * w + x]
            val dx: Int
            val dy: Int
            when (angle) {
                90 -> { dx = h - 1 - y; dy = x }
                180 -> { dx = w - 1 - x; dy = h - 1 - y }
                else -> { dx = y; dy = w - 1 - x } // 270
            }
            out[dy * nw + dx] = v
        }
    }
    return GrayImage(nw, nh, out)
}

/** Rotate by an arbitrary clockwise angle (degrees) about the centre, growing the output so
 *  nothing clips. Right-angle multiples delegate to rotateRightAngle; other angles inverse-map
 *  each output pixel to the source and bilinear-sample, with the grey fill showing through the
 *  freed corners (out-of-bounds samples are left as fill). Ports rotateCanvasDeg. */
fun rotateDeg(src: GrayImage, deg: Int): GrayImage = rotateDeg(src, deg.toDouble())

/** Float-angle overload (ports rotateCanvasDeg). locate.ts de-rotates by the exact fractional
 *  moment angle, so the steep-pill resample must NOT quantize to whole degrees. */
fun rotateDeg(src: GrayImage, deg: Double): GrayImage {
    var norm = deg % 360.0
    if (norm < 0) norm += 360.0
    if (norm == 0.0) return src
    if (norm == 90.0) return rotateRightAngle(src, 90)
    if (norm == 180.0) return rotateRightAngle(src, 180)
    if (norm == 270.0) return rotateRightAngle(src, 270)

    val rad = norm * Math.PI / 180.0
    val c = cos(rad)
    val s = sin(rad)
    val w = src.width
    val h = src.height
    val nw = maxOf(1, ceil(w * abs(c) + h * abs(s)).toInt())
    val nh = maxOf(1, ceil(w * abs(s) + h * abs(c)).toInt())

    val out = IntArray(nw * nh) { GREY_FILL }
    if (w == 0 || h == 0) return GrayImage(nw, nh, out)

    val srcCx = w / 2.0
    val srcCy = h / 2.0
    val dstCx = nw / 2.0
    val dstCy = nh / 2.0

    // Inverse of the canvas clockwise rotation: a dest offset (dx,dy) came from source offset
    // (dx*cos + dy*sin, -dx*sin + dy*cos), measured from each image's centre.
    for (oy in 0 until nh) {
        val dy = oy + 0.5 - dstCy
        for (ox in 0 until nw) {
            val dx = ox + 0.5 - dstCx
            val sx = dx * c + dy * s + srcCx - 0.5
            val sy = -dx * s + dy * c + srcCy - 0.5
            val sample = bilinear(src, sx, sy)
            if (sample >= 0) out[oy * nw + ox] = sample
        }
    }
    return GrayImage(nw, nh, out)
}

/** Bilinear sample at fractional (x,y); returns -1 when fully out of bounds so the caller keeps
 *  the grey fill there. Pixels off the edge but with an in-bounds neighbour are clamped. */
private fun bilinear(src: GrayImage, x: Double, y: Double): Int {
    val w = src.width
    val h = src.height
    val x0 = floor(x).toInt()
    val y0 = floor(y).toInt()
    val x1 = x0 + 1
    val y1 = y0 + 1
    if (x1 < 0 || y1 < 0 || x0 > w - 1 || y0 > h - 1) return -1

    val fx = x - x0
    val fy = y - y0
    val cx0 = x0.coerceIn(0, w - 1)
    val cx1 = x1.coerceIn(0, w - 1)
    val cy0 = y0.coerceIn(0, h - 1)
    val cy1 = y1.coerceIn(0, h - 1)

    val p00 = src.pixels[cy0 * w + cx0]
    val p10 = src.pixels[cy0 * w + cx1]
    val p01 = src.pixels[cy1 * w + cx0]
    val p11 = src.pixels[cy1 * w + cx1]

    val top = p00 + (p10 - p00) * fx
    val bottom = p01 + (p11 - p01) * fx
    return (top + (bottom - top) * fy).toInt().coerceIn(0, 255)
}
