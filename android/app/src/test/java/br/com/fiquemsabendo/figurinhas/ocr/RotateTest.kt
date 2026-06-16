package br.com.fiquemsabendo.figurinhas.ocr

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class RotateTest {
    private fun assertSamePixels(expected: GrayImage, actual: GrayImage) {
        assertEquals(expected.width, actual.width, "width")
        assertEquals(expected.height, actual.height, "height")
        assertTrue(expected.pixels.contentEquals(actual.pixels), "pixels")
    }

    /** A 2x3 image with distinct values, row-major [0,1, 2,3, 4,5]. */
    private fun sample2x3() = GrayImage(2, 3, intArrayOf(0, 1, 2, 3, 4, 5))

    @Test
    fun rightAngleZeroReturnsSource() {
        val img = sample2x3()
        assertSamePixels(img, rotateRightAngle(img, 0))
    }

    @Test
    fun rightAngle90SwapsDimsAndPlacesPixels() {
        val rot = rotateRightAngle(sample2x3(), 90)
        // 2x3 -> 3x2; clockwise sends the bottom-left source pixel to the top-left.
        assertEquals(3, rot.width)
        assertEquals(2, rot.height)
        assertEquals(4, rot.at(0, 0))
        assertEquals(0, rot.at(2, 0))
        assertEquals(5, rot.at(0, 1))
        assertEquals(1, rot.at(2, 1))
    }

    @Test
    fun fourNinetiesReturnOriginal() {
        val img = sample2x3()
        var rot = img
        repeat(4) { rot = rotateRightAngle(rot, 90) }
        assertSamePixels(img, rot)
    }

    @Test
    fun twoOneEightiesReturnOriginal() {
        val img = sample2x3()
        val rot = rotateRightAngle(rotateRightAngle(img, 180), 180)
        assertSamePixels(img, rot)
    }

    @Test
    fun degZeroReturnsSource() {
        val img = sample2x3()
        assertSamePixels(img, rotateDeg(img, 0))
    }

    @Test
    fun degRightAnglesDelegate() {
        val img = sample2x3()
        assertSamePixels(rotateRightAngle(img, 90), rotateDeg(img, 90))
        assertSamePixels(rotateRightAngle(img, 180), rotateDeg(img, 180))
        assertSamePixels(rotateRightAngle(img, 270), rotateDeg(img, 270))
    }

    @Test
    fun deg45GrowsAndFillsCornersGrey() {
        // An 8x8 image (any fill); 45 degrees must grow both dims and leave grey corners.
        val img = GrayImage.filled(8, 8, 200)
        val rot = rotateDeg(img, 45)
        assertTrue(rot.width > 8, "width grew")
        assertTrue(rot.height > 8, "height grew")
        assertEquals(122, rot.at(0, 0)) // freed corner = neutral grey fill
    }
}
