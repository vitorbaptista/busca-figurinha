package br.com.fiquemsabendo.figurinhas.ocr

import kotlin.math.max
import kotlin.math.min
import kotlin.math.round
import kotlin.math.sqrt

// Feature extraction for the pure-JS glyph classifier (ports glyphFeatures.ts).
//
// The OCR engine receives a PREPARED crop (here a GrayImage): pure black/white, ink (the
// light knockout text) = 0/black, background = 255/white, with the card margin already
// flood-cleared. So all this module ever sees is a clean binary bitmap of a few glyphs on
// white. We segment it into glyph components and turn each into a compact,
// translation/scale-NORMALIZED feature vector that a nearest-neighbour classifier can match
// against the rendered atlas. The vector mixes a coarse downsampled grid (overall shape)
// with zoning density + projection profiles (robust to the blur/aliasing of soft video
// frames). All feature math is in Float (Float32) so the vectors stay byte-compatible with
// the pre-baked atlas added later.

/** Side of the square downsampled grid the glyph bitmap is normalized to. 16x16 keeps enough
 *  shape to separate B/8/E while staying blur-tolerant. */
const val GRID = 16

/** Side of the zoning grid (ZONE x ZONE density blocks). 3x3 quadrant mass, blur-robust. */
private const val ZONE = 3

/** Weight on the aspect-ratio feature. The grid + profiles are translation/scale normalized
 *  and so are blind to overall proportion (a stretched "I" fills the grid like a "B"); this
 *  explicit, strongly-weighted AR channel restores the thin/wide distinction. */
private const val AR_WEIGHT = 1.2f

/** Length of one feature vector. Layout (all in [0,1] before the L2-normalize):
 *   - GRID*GRID    letterboxed (aspect-preserving) downsampled coverage cells
 *   - GRID         column ink profile (vertical projection)
 *   - GRID         row ink profile (horizontal projection)
 *   - ZONE*ZONE    zoning density
 *   - 1            aspect-ratio channel (AR_WEIGHT * normalized width/height)
 *  Concatenated then L2-normalized so cosine == dot product. */
const val FEAT_LEN = GRID * GRID + GRID + GRID + ZONE * ZONE + 1

/** Width (as a multiple of glyph HEIGHT) above which a box is assumed to hold >=2 touching
 *  glyphs. A condensed glyph is taller than wide (the widest, M/W, reach ~1.0x the height);
 *  1.25 catches a 2-glyph merge while leaving real single glyphs whole. */
private const val MERGE_W_RATIO = 1.25f

/** In weak Pixel crops the first two letters of a 3-letter code can bridge into a component that
 *  is wider than one condensed glyph, but still below the normal "definitely merged" threshold.
 *  We only use this lower threshold in the narrow 4-component code-shape rescue below. */
private const val SHORT_CODE_FIRST_MERGE_W_RATIO = 1.10f
/** Same conservative borderline-split threshold, but for a 3-component crop whose middle
 *  component is likely two glued letters (e.g. `AUT4` reading as `AE4`). */
private const val SHORT_CODE_MIDDLE_MERGE_W_RATIO = 1.10f

/** Estimated single-glyph width as a fraction of the band height — the ideal seam between two
 *  merged glyphs sits ~one of these in from the left. */
private const val GLYPH_W_FRAC = 0.62f

/** A segmented glyph: its tight ink bounding box in the source crop plus its feature vector.
 *  x/w are kept so the caller can order glyphs left-to-right and judge spacing. */
data class GlyphBox(
    val x: Int,
    val y: Int,
    val w: Int,
    val h: Int,
    /** Ink pixel count — used to drop specks and to weight ambiguous reads. */
    val area: Int,
    val feat: FloatArray,
    /** Aspect ratio h/w of the tight box — a strong prior (I/1 are tall-thin, M/W wide). */
    val ar: Float,
    /** Enclosed white holes inside the ink box. Digit 8 has two; 6/9/0 have one; 3/5 have none. */
    val holes: Int,
)

/** Internal tight bounding box, matching the TS plain objects (mutable for merge/split). */
private class Box(
    var x0: Int,
    var y0: Int,
    var x1: Int,
    var y1: Int,
    var area: Int,
)

/** Read a prepared crop into a flat ink mask (1 = ink/black, 0 = white). Replaces the TS
 *  cropToMask: the prepared crop is black ink on white, so ink = the dark pixels (value < 128),
 *  exactly as TS d[i] < 128 ? 1 : 0. */
fun grayToInkMask(img: GrayImage): ByteArray {
    val n = img.width * img.height
    val mask = ByteArray(n)
    for (p in 0 until n) mask[p] = if (img.pixels[p] < 128) 1 else 0
    return mask
}

/** Segment a binary ink mask into glyph components (8-connected), returning their tight
 *  bounding boxes. Tiny specks and the rare too-large blob are filtered in segmentBoxes. */
private fun components(mask: ByteArray, w: Int, h: Int): List<Box> {
    val labels = IntArray(w * h) { -1 }
    val stack = IntArray(w * h)
    val out = ArrayList<Box>()
    for (s in mask.indices) {
        if (mask[s].toInt() == 0 || labels[s] != -1) continue
        var sp = 0
        stack[sp++] = s
        labels[s] = s
        var x0 = w
        var y0 = h
        var x1 = 0
        var y1 = 0
        var area = 0
        while (sp > 0) {
            val i = stack[--sp]
            val x = i % w
            val y = i / w
            if (x < x0) x0 = x
            if (x > x1) x1 = x
            if (y < y0) y0 = y
            if (y > y1) y1 = y
            area++
            // 8-connectivity so an aliased stroke (the thin "I") stays one component.
            for (dy in -1..1) {
                val ny = y + dy
                if (ny < 0 || ny >= h) continue
                for (dx in -1..1) {
                    if (dx == 0 && dy == 0) continue
                    val nx = x + dx
                    if (nx < 0 || nx >= w) continue
                    val ni = ny * w + nx
                    if (mask[ni].toInt() == 1 && labels[ni] == -1) {
                        labels[ni] = s
                        stack[sp++] = ni
                    }
                }
            }
        }
        out.add(Box(x0, y0, x1, y1, area))
    }
    return out
}

/**
 * Segment the prepared crop into ordered glyph boxes. Strategy:
 *  1. find connected ink components;
 *  2. estimate the text band (median glyph height) and drop specks far below it and blobs far
 *     above it (card noise, merged smears);
 *  3. order left-to-right; merge components that overlap heavily in x (a broken stroke) so each
 *     real glyph is one box;
 *  4. split boxes much wider than the band height (touching glyphs).
 * Returns boxes WITHOUT features (compute those per kept box, after the band filter).
 */
private fun segmentBoxes(mask: ByteArray, w: Int, h: Int): List<Box> {
    val comps = components(mask, w, h)
    if (comps.isEmpty()) return emptyList()

    // Robust text-band height = median component height (the digits/letters dominate).
    val heights = comps.map { it.y1 - it.y0 + 1 }.sorted()
    val medH = heights[heights.size shr 1].let { if (it != 0) it else 1 }
    // Keep components whose height is a plausible glyph: not a speck, not a giant smear.
    val kept = comps.filter { c ->
        val ch = c.y1 - c.y0 + 1
        val cw = c.x1 - c.x0 + 1
        when {
            ch < medH * 0.32 -> false // speck / stray dot
            ch > medH * 1.9 -> false // merged blob / border remnant
            cw > w * 0.7 -> false // a smear spanning the crop
            c.area < 6 -> false
            else -> true
        }
    }.toMutableList()
    if (kept.isEmpty()) return emptyList()

    kept.sortBy { it.x0 }

    // Merge boxes that overlap heavily in x — a single glyph that segmentation split (a soft
    // stroke breaking into two stacked pieces). Side-by-side glyphs barely overlap in x.
    val merged = ArrayList<Box>()
    for (c in kept) {
        val last = merged.lastOrNull()
        if (last != null) {
            val ox0 = max(last.x0, c.x0)
            val ox1 = min(last.x1, c.x1)
            val overlap = ox1 - ox0 + 1
            val minW = min(last.x1 - last.x0 + 1, c.x1 - c.x0 + 1)
            if (overlap > minW * 0.6) {
                last.x0 = min(last.x0, c.x0)
                last.y0 = min(last.y0, c.y0)
                last.x1 = max(last.x1, c.x1)
                last.y1 = max(last.y1, c.y1)
                last.area += c.area
                continue
            }
        }
        merged.add(Box(c.x0, c.y0, c.x1, c.y1, c.area))
    }

    val wholeGlyphs = mergeTouchingFragments(merged, medH)

    // SPLIT wide components. A condensed glyph is taller than wide, so a box much WIDER than the
    // band height holds >=2 touching glyphs (the soft-video case: "GY" binarizes into one
    // bridged blob, mis-reading as a wide "W"/"M"). Cut at the deepest interior column-ink
    // valley, recursively, until each piece is a plausible single-glyph width.
    val out = ArrayList<Box>()
    for (c in wholeGlyphs) splitWide(mask, w, c, medH, out)
    out.sortBy { it.x0 }
    val firstRescued = splitFirstMergedGlyphInShortCode(mask, w, medH, out)
    return splitMiddleMergedGlyphInShortCode(mask, w, medH, firstRescued)
}

private fun mergeTouchingFragments(boxes: List<Box>, medH: Int): List<Box> {
    if (boxes.size < 2) return boxes
    val out = ArrayList<Box>()
    for (c in boxes) {
        val last = out.lastOrNull()
        if (last != null) {
            val gap = c.x0 - last.x1 - 1
            val overlapY = min(last.y1, c.y1) - max(last.y0, c.y0) + 1
            val minH = min(last.y1 - last.y0 + 1, c.y1 - c.y0 + 1)
            val combinedW = max(last.x1, c.x1) - min(last.x0, c.x0) + 1
            if (gap <= 1 && overlapY > minH * 0.50 && combinedW <= medH * 1.08) {
                last.x0 = min(last.x0, c.x0)
                last.y0 = min(last.y0, c.y0)
                last.x1 = max(last.x1, c.x1)
                last.y1 = max(last.y1, c.y1)
                last.area += c.area
                continue
            }
        }
        out.add(Box(c.x0, c.y0, c.x1, c.y1, c.area))
    }
    return out
}

/** Recursively split a wide (merged) box into its constituent glyphs at the interior column-ink
 *  valley nearest the ideal one-glyph boundary, appending the single-glyph pieces to `out`.
 *  WIDTH-DRIVEN: only a box >=MERGE_W_RATIO x as wide as tall is split, and within it the seam
 *  is taken regardless of bridge thickness — touching glyphs in this tight font are joined by a
 *  solid bridge a depth gate would miss. */
private fun splitWide(mask: ByteArray, w: Int, box: Box, medH: Int, out: ArrayList<Box>) {
    val bw = box.x1 - box.x0 + 1
    val bh = box.y1 - box.y0 + 1
    val tallness = max(bh.toFloat(), medH * 0.85f) // band height, robust to a short merged blob
    if (bw < tallness * MERGE_W_RATIO || bw < 14) {
        out.add(box)
        return
    }
    // Column ink counts within the box.
    val col = IntArray(bw)
    for (y in box.y0..box.y1) {
        val row = y * w
        for (x in box.x0..box.x1) if (mask[row + x].toInt() == 1) col[x - box.x0]++
    }
    // Seam ~ one glyph-width in from the left; search the full plausible range. Close Pixel
    // captures can join "SW" into one blob, and the S is almost a full band-height wide; a narrow
    // window around the condensed-font average cuts the S itself instead of the S/W valley.
    val glyphW = max(8f, tallness * GLYPH_W_FRAC)
    val ideal = min(bw - 4, max(4, round(glyphW).toInt()))
    val lo = max(3, round(tallness * 0.35f).toInt())
    val hi = min(bw - 4, round(tallness * 1.15f).toInt())
    var cut = -1
    var cutVal = Int.MAX_VALUE
    var cutDist = Int.MAX_VALUE
    for (x in lo..hi) {
        val dist = kotlin.math.abs(x - ideal)
        if (col[x] < cutVal || (col[x] == cutVal && dist < cutDist)) {
            cutVal = col[x]
            cut = x
            cutDist = dist
        }
    }
    if (cut < lo) {
        out.add(box)
        return
    }
    val left = Box(box.x0, box.y0, box.x0 + cut - 1, box.y1, 0)
    val right = Box(box.x0 + cut, box.y0, box.x1, box.y1, 0)
    // Recompute tight y/area for each half so a half holding a shorter glyph keeps its box.
    for (half in listOf(left, right)) {
        var y0 = box.y1
        var y1 = box.y0
        var area = 0
        for (y in box.y0..box.y1) {
            val row = y * w
            for (x in half.x0..half.x1) {
                if (mask[row + x].toInt() == 1) {
                    area++
                    if (y < y0) y0 = y
                    if (y > y1) y1 = y
                }
            }
        }
        if (area < 6) continue // empty half — drop
        half.y0 = y0
        half.y1 = y1
        half.area = area
        splitWide(mask, w, half, medH, out)
    }
}

private fun splitFirstMergedGlyphInShortCode(mask: ByteArray, w: Int, medH: Int, boxes: List<Box>): List<Box> {
    if (boxes.size != 4) return boxes
    val first = boxes[0]
    val firstW = first.x1 - first.x0 + 1
    val firstH = first.y1 - first.y0 + 1
    val tallness = max(firstH.toFloat(), medH * 0.85f)
    if (firstW < tallness * SHORT_CODE_FIRST_MERGE_W_RATIO || firstW >= tallness * MERGE_W_RATIO) {
        return boxes
    }

    val split = ArrayList<Box>()
    splitWideForced(mask, w, first, medH, split)
    if (split.size != 2) return boxes

    val rescued = ArrayList<Box>(5)
    rescued.addAll(split)
    for (i in 1 until boxes.size) rescued.add(boxes[i])
    rescued.sortBy { it.x0 }
    return rescued
}

private fun splitWideForced(mask: ByteArray, w: Int, box: Box, medH: Int, out: ArrayList<Box>) {
    val bw = box.x1 - box.x0 + 1
    if (bw < 14) {
        out.add(box)
        return
    }
    val bh = box.y1 - box.y0 + 1
    val tallness = max(bh.toFloat(), medH * 0.85f)
    val col = IntArray(bw)
    for (y in box.y0..box.y1) {
        val row = y * w
        for (x in box.x0..box.x1) if (mask[row + x].toInt() == 1) col[x - box.x0]++
    }
    val glyphW = max(8f, tallness * GLYPH_W_FRAC)
    val ideal = min(bw - 4, max(4, round(glyphW).toInt()))
    val minPart = max(8, round(tallness * 0.32f).toInt())
    val lo = max(minPart, round(tallness * 0.35f).toInt())
    val hi = min(bw - minPart, round(tallness * 1.15f).toInt())
    var cut = -1
    var cutVal = Int.MAX_VALUE
    var cutDist = Int.MAX_VALUE
    for (x in lo..hi) {
        val dist = kotlin.math.abs(x - ideal)
        if (col[x] < cutVal || (col[x] == cutVal && dist < cutDist)) {
            cutVal = col[x]
            cut = x
            cutDist = dist
        }
    }
    if (cut < lo) {
        out.add(box)
        return
    }

    val left = Box(box.x0, box.y0, box.x0 + cut - 1, box.y1, 0)
    val right = Box(box.x0 + cut, box.y0, box.x1, box.y1, 0)
    for (half in listOf(left, right)) {
        var y0 = box.y1
        var y1 = box.y0
        var area = 0
        for (y in box.y0..box.y1) {
            val row = y * w
            for (x in half.x0..half.x1) {
                if (mask[row + x].toInt() == 1) {
                    area++
                    if (y < y0) y0 = y
                    if (y > y1) y1 = y
                }
            }
        }
        if (area < 6) continue
        half.y0 = y0
        half.y1 = y1
        half.area = area
        out.add(half)
    }
}

private fun splitMiddleMergedGlyphInShortCode(mask: ByteArray, w: Int, medH: Int, boxes: List<Box>): List<Box> {
    if (boxes.size != 3) return boxes
    val middle = boxes[1]
    val middleW = middle.x1 - middle.x0 + 1
    val middleH = middle.y1 - middle.y0 + 1
    val tallness = max(middleH.toFloat(), medH * 0.85f)
    if (middleW < tallness * SHORT_CODE_MIDDLE_MERGE_W_RATIO || middleW >= tallness * MERGE_W_RATIO) {
        return boxes
    }

    val split = ArrayList<Box>()
    splitWideForced(mask, w, middle, medH, split)
    if (split.size != 2) return boxes

    val rescued = ArrayList<Box>(4)
    rescued.add(boxes[0])
    rescued.addAll(split)
    rescued.add(boxes[2])
    rescued.sortBy { it.x0 }
    return rescued
}

/**
 * Compute the normalized feature vector for one glyph box in the ink mask.
 * The glyph is resampled into a GRID x GRID grayscale coverage grid by AREA AVERAGING (each
 * output cell = fraction of source ink pixels mapping into it), which is far more blur-robust
 * than nearest-pixel sampling. We PRESERVE ASPECT RATIO: the glyph is scaled by its LONGER side
 * and letterboxed (centred with empty margins) into the square grid, so a thin "I" lands in the
 * centre columns with blank sides — visibly different from a wide "B" that fills the grid.
 */
private fun glyphFeature(mask: ByteArray, w: Int, box: Box): FloatArray {
    val bx = box.x0
    val by = box.y0
    val bw = box.x1 - box.x0 + 1
    val bh = box.y1 - box.y0 + 1

    // Aspect-preserving fit: scale by the longer side so the glyph fills one grid dimension and
    // is centred (letterboxed) in the other.
    val longer = max(bw, bh).toFloat()
    val sx = GRID * bw / longer // glyph width in grid cells
    val sy = GRID * bh / longer // glyph height in grid cells
    val offx = (GRID - sx) / 2f
    val offy = (GRID - sy) / 2f

    val grid = FloatArray(GRID * GRID)
    val counts = FloatArray(GRID * GRID)
    for (y in 0 until bh) {
        val gy = min(GRID - 1, (offy + y * sy / bh).toInt())
        val row = (by + y) * w + bx
        for (x in 0 until bw) {
            val gx = min(GRID - 1, (offx + x * sx / bw).toInt())
            val gi = gy * GRID + gx
            counts[gi]++
            if (mask[row + x].toInt() == 1) grid[gi]++
        }
    }
    for (i in grid.indices) grid[i] = if (counts[i] > 0f) grid[i] / counts[i] else 0f

    // Column (vertical) + row (horizontal) ink projection profiles, each GRID long, in [0,1].
    val colp = FloatArray(GRID)
    val rowp = FloatArray(GRID)
    for (i in 0 until GRID * GRID) {
        val gx = i % GRID
        val gy = i / GRID
        colp[gx] += grid[i]
        rowp[gy] += grid[i]
    }
    for (i in 0 until GRID) {
        colp[i] /= GRID
        rowp[i] /= GRID
    }

    // ZONE x ZONE zoning density.
    val zone = FloatArray(ZONE * ZONE)
    for (i in 0 until GRID * GRID) {
        val gx = i % GRID
        val gy = i / GRID
        val zx = min(ZONE - 1, gx * ZONE / GRID)
        val zy = min(ZONE - 1, gy * ZONE / GRID)
        zone[zy * ZONE + zx] += grid[i]
    }
    val per = (GRID * GRID).toFloat() / (ZONE * ZONE)
    for (i in 0 until ZONE * ZONE) zone[i] /= per

    // Aspect-ratio channel: normalized width/height in [0,1] (1 = as-wide-as-tall, ->0 for a
    // thin tall glyph). Weighted up so it meaningfully steers the cosine.
    val arFeat = AR_WEIGHT * min(bw, bh) / max(bw, bh)

    // Concatenate and L2-normalize (cosine NN == dot product).
    val feat = FloatArray(FEAT_LEN)
    var o = 0
    for (i in grid.indices) feat[o++] = grid[i]
    for (i in 0 until GRID) feat[o++] = colp[i]
    for (i in 0 until GRID) feat[o++] = rowp[i]
    for (i in 0 until ZONE * ZONE) feat[o++] = zone[i]
    feat[o++] = arFeat

    var norm = 0f
    for (v in feat) norm += v * v
    norm = sqrt(norm).let { if (it != 0f) it else 1f }
    for (i in feat.indices) feat[i] /= norm
    return feat
}

private fun countEnclosedWhiteHoles(mask: ByteArray, w: Int, box: Box): Int {
    val bw = box.x1 - box.x0 + 1
    val bh = box.y1 - box.y0 + 1
    val seen = BooleanArray(bw * bh)
    val stack = IntArray(bw * bh)
    var holes = 0
    val minHoleArea = max(4, bw * bh / 180)
    for (sy in 0 until bh) {
        for (sx in 0 until bw) {
            val start = sy * bw + sx
            if (seen[start]) continue
            if (mask[(box.y0 + sy) * w + box.x0 + sx].toInt() == 1) {
                seen[start] = true
                continue
            }
            var sp = 0
            var area = 0
            var touchesBorder = false
            stack[sp++] = start
            seen[start] = true
            while (sp > 0) {
                val i = stack[--sp]
                val x = i % bw
                val y = i / bw
                area++
                if (x == 0 || y == 0 || x == bw - 1 || y == bh - 1) touchesBorder = true
                fun visit(nx: Int, ny: Int) {
                    if (nx < 0 || nx >= bw || ny < 0 || ny >= bh) return
                    val ni = ny * bw + nx
                    if (seen[ni]) return
                    if (mask[(box.y0 + ny) * w + box.x0 + nx].toInt() == 0) {
                        seen[ni] = true
                        stack[sp++] = ni
                    }
                }
                visit(x - 1, y)
                visit(x + 1, y)
                visit(x, y - 1)
                visit(x, y + 1)
            }
            if (!touchesBorder && area >= minHoleArea) holes++
        }
    }
    return holes
}

/** Segment + featurize a prepared crop into ordered GlyphBoxes (left-to-right). */
fun extractGlyphs(img: GrayImage): List<GlyphBox> {
    val w = img.width
    val h = img.height
    if (w == 0) return emptyList()
    val mask = grayToInkMask(img)
    val boxes = segmentBoxes(mask, w, h)
    return glyphBoxesFrom(mask, w, boxes)
}

internal fun extractGlyphsWithForcedSplit(img: GrayImage, splitIndex: Int): List<GlyphBox> {
    val w = img.width
    val h = img.height
    if (w == 0) return emptyList()
    val mask = grayToInkMask(img)
    val boxes = segmentBoxes(mask, w, h).toMutableList()
    if (splitIndex !in boxes.indices) return emptyList()

    val heights = boxes.map { it.y1 - it.y0 + 1 }.sorted()
    val medH = heights[heights.size shr 1].let { if (it != 0) it else 1 }
    val target = boxes[splitIndex]
    val targetW = target.x1 - target.x0 + 1
    val targetH = target.y1 - target.y0 + 1
    val tallness = max(targetH.toFloat(), medH * 0.85f)
    if (targetW < tallness * SHORT_CODE_MIDDLE_MERGE_W_RATIO || targetW >= tallness * MERGE_W_RATIO) {
        return emptyList()
    }

    val split = ArrayList<Box>()
    splitWideForced(mask, w, target, medH, split)
    if (split.size != 2) return emptyList()
    boxes.removeAt(splitIndex)
    boxes.addAll(splitIndex, split)
    boxes.sortBy { it.x0 }
    return glyphBoxesFrom(mask, w, boxes)
}

private fun glyphBoxesFrom(mask: ByteArray, w: Int, boxes: List<Box>): List<GlyphBox> {
    return boxes.map { b ->
        GlyphBox(
            x = b.x0,
            y = b.y0,
            w = b.x1 - b.x0 + 1,
            h = b.y1 - b.y0 + 1,
            area = b.area,
            feat = glyphFeature(mask, w, b),
            ar = (b.y1 - b.y0 + 1).toFloat() / (b.x1 - b.x0 + 1),
            holes = countEnclosedWhiteHoles(mask, w, b),
        )
    }
}

/** Cosine similarity of two L2-normalized vectors == dot product. */
fun cosine(a: FloatArray, b: FloatArray): Float {
    var s = 0f
    for (i in a.indices) s += a[i] * b[i]
    return s
}
