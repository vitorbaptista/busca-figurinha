package br.com.fiquemsabendo.figurinhas.ocr

// Locate the printed code box on a Panini sticker back so OCR runs on a tiny crop
// instead of the whole frame (≈10–40× faster and far more accurate). The box is a
// dark rounded pill with light knockout text. We find it by SHAPE — a solid-ish,
// elongated blob with text holes — using a LOCAL adaptive threshold, because the
// box and the card have nearly equal brightness (a global threshold can't separate
// them, but "darker than the local neighbourhood" can). Handles several backs in
// one frame (each box is found independently) and right-angle rotations.
//
// Pure typed-array work — no OpenCV, no android.graphics. The PWA did the downscale,
// crop, rotate and pixel reads through HTML canvas; here the frame is already a
// grayscale GrayImage (the camera's luma plane), so wherever the TS did the
// (r*77+g*150+b*29)>>8 RGBA→gray reduction we read GrayImage.pixels directly, and
// canvas resize/crop/rotate become GrayImage array operations. Detection runs on a
// downscaled copy.

import br.com.fiquemsabendo.figurinhas.Config
import kotlin.math.abs
import kotlin.math.atan2
import kotlin.math.ceil
import kotlin.math.floor
import kotlin.math.max
import kotlin.math.min
import kotlin.math.round
import kotlin.math.sqrt

/** A detected code box.
 *
 *  All of x/y/w/h/pillW are fractional full-frame pixels (the TS used `number` and divides the
 *  integer detection-space extents by a fractional `scale`), so they are kept as Double.
 *  `orient` is the TS 'h'/'v' char kept as a Char. */
data class CodeBox(
    /** Axis-aligned bounding box in full-frame pixels. For a rotated pill this is the
     *  square-ish box that wraps the tilted blob; the crop is de-rotated by `tilt` to
     *  bring the pill horizontal before OCR. */
    val x: Double,
    val y: Double,
    val w: Double,
    val h: Double,
    /** 'h' = text runs horizontally (upright or 180°), 'v' = rotated 90°/270°. Kept for
     *  the bench debug line; with moment-based detection the de-rotation angle (`tilt`)
     *  carries the real orientation, so this is only a coarse landscape/portrait hint. */
    val orient: Char,
    val score: Double,
    /** In-plane angle (degrees, canvas clockwise-positive) the crop must be rotated by to
     *  bring the pill's long axis horizontal, from the dark component's pixel moments.
     *  Rotation-invariant: works for a steeply-tilted pill (30–75°) whose axis-aligned
     *  box is nearly square. null when the component is too round to give a trustworthy
     *  axis, or the box is too weak to safely de-rotate (false-positive guard). */
    val tilt: Double?,
    /** Moment-derived pill short side (px, full-frame). After de-rotating the square bbox
     *  about its centre the pill is a horizontal strip ~this tall through the middle, so we
     *  crop a centred strip of this height (+margin) — far more reliable than searching the
     *  de-rotated square for a dark band (which can grab the card's legal-text block). */
    val pillW: Double,
    /** Moment fill = area / (L·W): how solidly the blob fills its equivalent rectangle. A
     *  real pill is solid (~0.7); a hollow stray "0" blob or sparse legal text is lower. */
    val fill: Double,
    /** Whether this box may use the taller small-source OCR target. Set in findCodeBoxes:
     *  the boost rescues a genuinely small/far PILL's thin strokes, but it also sharpens a
     *  hollow stray blob (a "0" ring) into a phantom "00", so it's gated on score AND fill. */
    val boost: Boolean,
)

/** Rotation-invariant shape descriptors of a connected component, from its pixel
 *  moments. Unlike the axis-aligned w×h, these hold at ANY in-plane rotation: a code
 *  pill tilted 45° has a near-square bounding box (AR≈1) but its moment AR is still
 *  ~3–4. `angle` is the long-axis angle in degrees, in (-90, 90], measured from the
 *  +x axis; de-rotating a crop by -angle brings the pill horizontal. */
private class MomentShape(
    /** Rotation-invariant aspect ratio L/W (equivalent-rectangle side lengths). */
    val ar: Double,
    /** Fill = area / (L·W): how fully the blob fills its equivalent rectangle. */
    val fill: Double,
    /** Equivalent-rectangle long side L (px, detection space). */
    val size: Double,
    /** Equivalent-rectangle short side W (px, detection space). */
    val short: Double,
    /** Larger eigenvalue of the central second-moment matrix. */
    val l1: Double,
    /** Smaller eigenvalue. l1/l2 ≫ 1 ⇒ clearly elongated (a trustworthy axis). */
    val l2: Double,
    /** Long-axis angle in degrees, (-90, 90], from +x. */
    val angle: Double,
)

/** Compute the rotation-invariant shape from a component's accumulated pixel moments.
 *  Shared by the geometry gate (scoreBox) and the de-rotation angle — they must agree.
 *  Returns null when the component is too small to be meaningful. */
private fun momentShape(
    area: Double,
    sx: Double,
    sy: Double,
    sxx: Double,
    syy: Double,
    sxy: Double,
): MomentShape? {
    if (area < 12) return null
    val cx = sx / area
    val cy = sy / area
    val uxx = sxx / area - cx * cx
    val uyy = syy / area - cy * cy
    val uxy = sxy / area - cx * cy

    // Eigenvalues of the 2×2 central second-moment matrix [[uxx,uxy],[uxy,uyy]].
    val tr = uxx + uyy
    val det = uxx * uyy - uxy * uxy
    val disc = sqrt(max(0.0, (tr * tr) / 4 - det))
    val l1 = tr / 2 + disc
    val l2 = tr / 2 - disc

    // Side lengths of the uniform rectangle with the same second moments (var = s²/12).
    val L = sqrt(max(0.0, 12 * l1))
    val W = sqrt(max(0.0, 12 * l2))
    if (W <= 0 || L <= 0) return null

    // Long-axis angle (degrees), in (-90, 90].
    var angle = 0.5 * atan2(2 * uxy, uxx - uyy) * 180 / Math.PI
    while (angle > 90) angle -= 180
    while (angle <= -90) angle += 180

    return MomentShape(ar = L / W, fill = area / (L * W), size = L, short = W, l1 = l1, l2 = l2, angle = angle)
}

/** Long side (px) of the downscaled image used for detection. Detection runs on EVERY frame
 *  and is a guaranteed per-frame cost, with the connected-component work ~O(area) — so this
 *  scales with its square. Held at 720 (not the cheaper 600): the finer raster keeps a far
 *  multi-up pill (~30px) crisp enough for the second DET_BG_RADII pass and the size gate to
 *  catch — which is exactly the recall the real-life video frames depend on (0→4 of 6). The
 *  extra raster cost is affordable: detection still measures ~28ms median, well inside the
 *  100ms per-frame budget, since detection isn't the bottleneck (OCR of the located crops
 *  is). */
private const val DET_LONG = 720

/** Local-background radii (as a fraction of DET_LONG) the pill detector runs at — detection
 *  runs once PER radius and unions the results. The long-proven 0.045 radius segments
 *  close-up and held-at-distance pills across the readable set on its own; the finer 0.025
 *  radius rescues a far/multi-up pill hollowed-out next to the big FIFA logo. The second pass
 *  is what recovers the real-life video pills (CIV12/EGY5/RSA17/RSA19 — 0→4 of 6), and its
 *  added detection cost is small (~28ms median total, inside the 100ms budget), so we keep
 *  both rather than lean on the live burst's cross-frame confirmer to catch them later. */
private val DET_BG_RADII = doubleArrayOf(0.045, 0.025)

/** How much darker than its local background a pixel must be to count as pill foreground. */
private const val FG_DELTA = 12

enum class ForegroundMode {
    DARK,
    LIGHT,
}

/** Run the connected-component pill search at one background radius, appending every
 *  box that passes the geometry gate to `out`. Split out so findCodeBoxes can run it at
 *  several radii (small + large pills need different local-threshold scales). */
private fun collectBoxes(
    gray: IntArray,
    dw: Int,
    dh: Int,
    scale: Double,
    radius: Int,
    mode: ForegroundMode,
    out: MutableList<CodeBox>,
) {
    val n = dw * dh
    val bg = boxBlur(gray, dw, dh, radius)
    val fg = ByteArray(n)
    for (i in 0 until n) {
        fg[i] = when (mode) {
            ForegroundMode.DARK -> if (gray[i] < bg[i] - FG_DELTA) 1 else 0
            ForegroundMode.LIGHT -> if (gray[i] > bg[i] + FG_DELTA) 1 else 0
        }
    }

    val labels = IntArray(n) { -1 }
    val stack = IntArray(n)
    for (start in 0 until n) {
        if (fg[start].toInt() == 0 || labels[start] != -1) continue
        var sp = 0
        stack[sp++] = start
        labels[start] = start
        var minX = dw
        var minY = dh
        var maxX = 0
        var maxY = 0
        var area = 0
        var sx = 0.0
        var sy = 0.0
        var sxx = 0.0
        var syy = 0.0
        var sxy = 0.0
        while (sp > 0) {
            val idx = stack[--sp]
            val x = idx % dw
            val y = idx / dw
            if (x < minX) minX = x
            if (x > maxX) maxX = x
            if (y < minY) minY = y
            if (y > maxY) maxY = y
            area++
            sx += x
            sy += y
            sxx += (x * x).toDouble()
            syy += (y * y).toDouble()
            sxy += (x * y).toDouble()
            if (x > 0 && fg[idx - 1].toInt() == 1 && labels[idx - 1] == -1) { labels[idx - 1] = start; stack[sp++] = idx - 1 }
            if (x < dw - 1 && fg[idx + 1].toInt() == 1 && labels[idx + 1] == -1) { labels[idx + 1] = start; stack[sp++] = idx + 1 }
            if (y > 0 && fg[idx - dw].toInt() == 1 && labels[idx - dw] == -1) { labels[idx - dw] = start; stack[sp++] = idx - dw }
            if (y < dh - 1 && fg[idx + dw].toInt() == 1 && labels[idx + dw] == -1) { labels[idx + dw] = start; stack[sp++] = idx + dw }
        }

        val w = maxX - minX + 1
        val h = maxY - minY + 1
        val shape = momentShape(area.toDouble(), sx, sy, sxx, syy, sxy)
        // TS: `const scored = shape && scoreBox(shape); if (scored && shape)`. In Kotlin the
        // null-shape and null-score guards collapse into this single nested null check (a
        // non-null score can only come from a non-null shape), which also smart-casts `shape`.
        val scored = if (shape != null) scoreBox(shape) else null
        if (shape != null && scored != null) {
            out.add(
                CodeBox(
                    x = minX / scale,
                    y = minY / scale,
                    w = w / scale,
                    h = h / scale,
                    orient = if (w >= h) 'h' else 'v',
                    score = scored,
                    tilt = deRotationAngle(shape),
                    pillW = shape.short / scale,
                    fill = shape.fill,
                    boost = false, // set in findCodeBoxes (needs score + fill)
                ),
            )
        }
    }
}

/** The OCR target rectangle, as fractions (0..1) of the frame. Detection runs only inside it; the
 *  on-screen reticle draws the same rectangle so the user aligns the sticker's code there. */
data class Roi(val left: Double, val top: Double, val right: Double, val bottom: Double) {
    companion object {
        /** The whole frame — the benches/golden tests aren't framed to a box. */
        val FULL = Roi(0.0, 0.0, 1.0, 1.0)

        /** The live target box from Config.Detect. */
        val CONFIG: Roi
            get() = Roi(
                Config.Detect.ROI_LEFT, Config.Detect.ROI_TOP,
                Config.Detect.ROI_RIGHT, Config.Detect.ROI_BOTTOM,
            )
    }
}

/** Public detection entry. Detection runs ONLY inside the [roi] sub-rectangle: it's sliced into its
 *  own sub-image, the FULL detection pipeline runs on it, and the rect's offset is added back to
 *  every box's x/y so the result is in FULL-FRAME coordinates — cropRegion / codeCropSource then
 *  extract the right pixels unchanged. A small target box cuts detection cost (~O(area)), keeps the
 *  FIFA logo / header / legal text out of the crops, AND lines up with the on-screen reticle so the
 *  user can place the code precisely where it's read. Roi.FULL (default for benches) detects the
 *  whole frame, byte-identical to the previous behaviour (no sub-image, no offset). */
fun findCodeBoxes(
    frame: GrayImage,
    roi: Roi = Roi.CONFIG,
    modes: Array<ForegroundMode> = ForegroundMode.values(),
): List<CodeBox> {
    val fw = frame.width
    val fh = frame.height
    if (fw == 0 || fh == 0) return emptyList()

    // Full-frame fast path — byte-identical to detecting the whole frame.
    if (roi.left <= 0.0 && roi.top <= 0.0 && roi.right >= 1.0 && roi.bottom >= 1.0) return detectBoxes(frame)

    // The target sub-rectangle in full-frame pixels (clamped, always ≥1px each side).
    val x0 = (roi.left * fw).toInt().coerceIn(0, fw - 1)
    val y0 = (roi.top * fh).toInt().coerceIn(0, fh - 1)
    val x1 = Math.round(roi.right * fw).toInt().coerceIn(x0 + 1, fw)
    val y1 = Math.round(roi.bottom * fh).toInt().coerceIn(y0 + 1, fh)
    val sub = frame.crop(x0, y0, x1 - x0, y1 - y0)

    // CRITICAL: scale the sub-rect's detection raster against the FULL frame's long side, not the
    // sub-rect's own. DET_LONG, the local-background radii and every DET_LONG-relative gate (pill
    // size, score) are calibrated to a 720px-long full frame; deriving scale from the smaller sub-rect
    // would upscale it to a mis-calibrated, larger raster that fails the size gates. Passing the
    // full-frame long side makes the sub-rect's raster exactly that slice of the full-frame raster:
    // same pixel density, same gates, just fewer rows/cols → genuinely cheaper detection.
    val boxes = detectBoxes(sub, max(fw, fh), modes)
    // Boxes come back in SUB-RECT coordinates; offset BOTH x and y back into full-frame space (the
    // moment-derived tilt and pillW are translation-invariant, so they carry over unchanged).
    return boxes.map { it.copy(x = it.x + x0, y = it.y + y0) }
}

/** Run the full pill-detection pipeline on an image, returning boxes in THAT image's
 *  coordinates. findCodeBoxes calls this on either the whole frame or a bottom-band
 *  sub-image (then offsets y). `scaleLong` is the long side (px) the DET_LONG downscale is
 *  computed against — the band passes the FULL frame's long side so its detection raster,
 *  radii and size gates stay identical to a full-frame pass (only the row count shrinks).
 *  Defaults to the image's own max dimension (the full-frame call). */
private fun detectBoxes(frame: GrayImage, scaleLong: Int? = null, modes: Array<ForegroundMode> = ForegroundMode.values()): List<CodeBox> {
    val fw = frame.width
    val fh = frame.height
    if (fw == 0 || fh == 0) return emptyList()

    val scale = DET_LONG.toDouble() / (scaleLong ?: max(fw, fh))
    val dw = max(1, Math.round(fw * scale).toInt())
    val dh = max(1, Math.round(fh * scale).toInt())

    // The PWA drew the frame into a dw×dh canvas (bilinear smoothing) and read RGBA back. The
    // frame is already grayscale here, so a bilinear resize to dw×dh gives the same gray plane
    // directly (no (r*77+g*150+b*29)>>8 step needed — those channels are already equal).
    val det = resizeBilinear(frame, dw, dh)
    val gray = det.pixels

    // Foreground = pixels darker than their local background (the dark pill stands out
    // from the card; the light text inside does not). The background radius is the catch:
    //  - a LARGE radius (≈ pill size or more) makes a small/far pill pop solid, but on a
    //    close-up pill the radius sits INSIDE the pill, so its dark interior raises the
    //    local mean and only the rim survives — the body goes hollow;
    //  - a SMALL radius makes a close-up pill solid, but a far pill next to a big dark
    //    neighbour (the FIFA "2026" logo) gets a contaminated, too-dark local mean and the
    //    body fails the threshold.
    // No single radius fits both a close-up and a held-at-arm's-length video pill, so we
    // run the component pass at EACH radius and merge by PRIORITY: the first (large,
    // long-proven for close-ups) radius wins, and a later radius only ADDS a pill in a
    // region the earlier one left empty. That way the finer radius can never replace a
    // close-up pill's clean segmentation with a worse, taller merge of itself — it only
    // rescues far/multi-up pills the coarse radius missed. The passes are linear and the
    // detection image is tiny, so the cost is negligible.
    var kept = ArrayList<CodeBox>()
    for (rFrac in DET_BG_RADII) {
        val radius = max(5, Math.round(DET_LONG * rFrac).toInt())
        for (mode in modes) {
            val pass = ArrayList<CodeBox>()
            collectBoxes(gray, dw, dh, scale, radius, mode, pass)
            pass.sortByDescending { it.score }
            for (b in nonMaxSuppress(pass, 0.3)) {
                if (kept.all { k -> iou(b, k) <= 0.3 }) kept.add(b)
            }
        }
    }
    kept.sortByDescending { it.score }
    kept = ArrayList(kept.take(10))

    // Decide which boxes keep their de-rotation `tilt`. A box that isn't the real code pill,
    // de-rotated, tends to manufacture a clean-looking but spurious read (a stray blob → the
    // "00" logo; a digit cluster → a wrong code) — a false positive a trading app must never
    // produce. Two regimes, by how steep the correction is:
    //
    //  • NEAR-AXIS tilt (snaps to the 0°/90° turn, no resample): the long-proven, low-risk
    //    path. Keep it for every box that scores within TILT_SCORE_MARGIN of the best — flat
    //    multi-sticker frames have several real pills, all near-axis.
    //
    //  • STEEP diagonal tilt (a true resample): the risky one. In a tilted frame several
    //    non-pill regions (legal-text blocks, digit clusters) score as high as the pill, and
    //    a tiny fragment de-rotates into "7 00" → the "00" logo. A single hold has ONE real
    //    pill, and it's the LARGEST elongated blob — so we de-rotate only the single biggest
    //    candidate (max pillW), and only if it scores near the best large box. Tiny fragments
    //    and the smaller, contaminated re-segmentations of the same pill keep tilt=null and
    //    read through the safe axis path instead.
    val best = if (kept.isNotEmpty()) kept[0].score else 0.0
    val maxPillW = kept.fold(0.0) { m, b -> max(m, b.pillW) }
    val bestLarge = kept
        .filter { it.pillW >= maxPillW * PILL_SIZE_RATIO }
        .fold(0.0) { s, b -> max(s, b.score) }
    val out = ArrayList<CodeBox>()
    for (b0 in kept) {
        var b = b0
        // The user-facing scan flow assumes the code pill is roughly horizontal. Keep the best
        // candidate even if its axis box is square-ish (a real tilted pill can wrap square), but
        // drop later near-square candidates: they are usually logo/text fragments that clutter the
        // debug overlay and occasionally reach OCR, while a real secondary horizontal pill is still
        // visibly elongated.
        val axisAr = if (b.w >= b.h) b.w / b.h else b.h / b.w
        if (out.isNotEmpty() && axisAr < MIN_AXIS_PILL_AR) continue
        if (b.tilt != null && isSteepTilt(b.tilt!!)) {
            // A box with a STEEP moment angle is only detectable BECAUSE the detector is rotation-
            // invariant — a flat frame would never surface it (its axis-aligned box is square). In a
            // tilted frame these are the real pill PLUS a litter of contaminants the same tilt makes
            // visible: the card's legal-text block, digit clusters, pill-fragment re-segmentations.
            // Only the single biggest, pill-scored blob is the real code; we de-rotate just that one
            // and DROP the other steep boxes entirely — left in, their tilted dense text OCRs into
            // stray codes ("STN 8" → SEN8) the matcher can't tell from a real read (a false positive).
            if (b.pillW < maxPillW - 1e-6 || b.score < bestLarge - TILT_SCORE_MARGIN) continue
        } else if (b.tilt != null && b.score < best - TILT_SCORE_MARGIN) {
            // Near-axis box too weak to be the pill: keep it (the safe axis path reads it) but don't
            // de-rotate — de-rotating a weak box invents false positives.
            b = b.copy(tilt = null)
        }
        // The taller small-source target rescues a far PILL's thin strokes, but on a HOLLOW
        // stray "0" blob it sharpens the ring's two sides into a phantom "00". A real pill is
        // solid (fill ≥ ~0.6); the "0" blob is sparse (~0.54), so gate the boost on fill too.
        b = b.copy(boost = b.score >= SMALL_BOOST_MIN_SCORE && b.fill >= BOOST_MIN_FILL)
        out.add(b)
    }
    return out
}

/** A box is only de-rotated when its long axis is clearly elongated: l1/l2 must exceed
 *  this. A round mass has no trustworthy axis, and de-rotating it manufactures a clean
 *  but spurious read — the false positive a trading app must never produce. */
private const val TILT_MIN_ELONGATION = 2.2

/** A box is only de-rotated if its score is within this margin of the frame's best box.
 *  Weaker boxes are rarely the real pill, and de-rotating them invents false positives. */
private const val TILT_SCORE_MARGIN = 0.08

/** A box is only de-rotated if its pill body (short side) is at least this fraction of the
 *  largest detected candidate's. The real pill is the big elongated blob; the spurious
 *  near-top boxes a steep tilt creates are small fragments that de-rotate into stray-digit
 *  reads ("7 00" → the "00" logo false positive). */
private const val PILL_SIZE_RATIO = 0.5
private const val MIN_AXIS_PILL_AR = 1.8

/** A tilt is "steep" (a true diagonal de-rotation that resamples) when it isn't within
 *  UPRIGHT_DEG of an axis (0° or ±90°). Near-axis crops snap to the cheap right-angle
 *  turn (low risk); steep ones are restricted to the single biggest pill. */
private fun isSteepTilt(tilt: Double): Boolean {
    return abs(tilt) >= UPRIGHT_DEG && abs(abs(tilt) - 90) >= UPRIGHT_DEG
}

/** Canvas-clockwise rotation (degrees) that brings the pill's long axis horizontal, from
 *  the rotation-invariant moment shape. The moment angle is measured from +x; rotating
 *  the crop by -angle lays the text flat. Returns null when the component isn't clearly
 *  elongated (a round mass has no meaningful axis — de-rotating it invents a false
 *  read). The 180° ambiguity (text upright vs upside-down) is resolved at OCR time by
 *  also feeding the flip. The angle is scale-invariant, so the detection-space estimate
 *  applies directly to the full-frame crop. */
private fun deRotationAngle(shape: MomentShape): Double? {
    if (shape.l2 <= 0 || shape.l1 / shape.l2 < TILT_MIN_ELONGATION) return null
    // Bring the long axis to horizontal: rotate the crop by the negated long-axis angle.
    var deg = -shape.angle
    while (deg > 90) deg -= 180
    while (deg <= -90) deg += 180
    return deg
}

/** Geometry gate + score for "is this the code pill?", from the ROTATION-INVARIANT
 *  moment shape (not the axis-aligned w×h, which goes square at a steep tilt and used to
 *  reject every steeply-rotated pill before OCR). Returns null if not a plausible pill.
 *  The real code pill ranks highest by score; we keep the top candidates and let the OCR
 *  + per-line matching reject any false positives. */
/** The card's legal-text block measures a longer, sparser rectangle than a real pill.
 *  A box that is BOTH this elongated AND this hollow is rejected as the legal block (the
 *  one contaminant rotation-invariant detection surfaces in a tilted frame). Real pills sit
 *  at AR ≤ ~3.2 / fill ≥ ~0.56, so they clear at least one side of this AND. */
private const val LEGAL_BLOCK_AR = 3.4
private const val LEGAL_BLOCK_FILL = 0.6

private fun scoreBox(shape: MomentShape): Double? {
    val ar = shape.ar
    val fill = shape.fill
    val size = shape.size
    val l2 = shape.l2

    // Loose sanity gates. A real code pill measures AR≈2.4–3.2 and fill≈0.56–0.74 from
    // moments at ANY rotation (verified across the dataset; fill varies with framing).
    if (ar < 2.0 || ar > 6.0) return null // pill is ~2.4–3.2:1
    if (fill < 0.35 || fill > 0.95) return null // solid-ish blob with text holes
    if (size < DET_LONG * 0.03 || size > DET_LONG * 0.5) return null // size sanity
    if (l2 < 2) return null // short side too thin to be a pill body

    // The card's printed legal-text block is the one contaminant that mimics a pill's AR but
    // not its solidity: it measures a LONGER, SPARSER rectangle (AR ≳ 3.5, fill ≲ 0.6) than a
    // real pill (AR ≤ ~3.2, fill ≥ ~0.56). Rotation-invariant detection surfaces it in a tilted
    // frame (its axis box is square when flat, so a flat capture never saw it), where its tilted
    // dense text OCRs into stray codes ("STN 8" → SEN8) — a false positive. Reject that
    // long-and-sparse signature; a genuine pill clears either the AR or the fill side.
    if (ar > LEGAL_BLOCK_AR && fill < LEGAL_BLOCK_FILL) return null

    // Score peaks at the real pill's measured shape: AR≈3.0 and fill≈0.72 (dataset). The fill
    // ideal matters — at the old 0.6 ideal a HOLLOW stray "0" blob (fill≈0.54) outscored the
    // solid pill (fill≈0.74) and stole the top spot, de-rotating into a phantom "00". Centring
    // on the real fill makes the solid pill the clear winner and drops the sparse blob below the
    // de-rotation margin.
    val arScore = 1 - min(1.0, abs(ar - 3.0) / 3)
    val fillScore = 1 - min(1.0, abs(fill - 0.72) / 0.4)
    return arScore * 0.5 + fillScore * 0.5
}

/** Below this absolute de-rotation angle the crop is treated as already upright: no
 *  rotation resample is applied, so the crop can be SHARPENED (rescuing thin strokes the
 *  same way the long-proven axis path did) and read full-width without a band-tighten
 *  that can grab the wrong rows on a nearly-flat pill. A handheld lean this small reads
 *  fine upright, so correcting it only adds resample softening for no gain. Above it a
 *  real resample happens, a second sharpening would fragment the digits, and the
 *  axis-aligned bbox is now tall enough that we must tighten to the pill band. */
private const val UPRIGHT_DEG = 8

/** Build the two raw upright crops plus the flag telling prepForOcr whether to sharpen.
 *  A de-rotated crop (real resample) is NOT sharpened — the resample already softens it
 *  and a second sharpening fragments the digits (e.g. a tilted "CIV 12" breaks into
 *  "CIV" + "12"). An already-upright crop (no resample) IS sharpened to rescue thin
 *  strokes a soft capture washed out (the "I" in CIV, the "1" in 12). */
private class RawCropGroups(val crops: List<GrayImage>, val sharpen: Boolean, val despeckle: Boolean)

private fun rawCropGroups(frame: GrayImage, box: CodeBox): RawCropGroups {
    // A little padding so the pill has a margin of card around it — the prep step
    // flood-clears that margin, which cleanly isolates the text.
    val region = cropRegion(frame, box, 0.18)

    // No trustworthy moment axis: fall back to the axis-aligned crop. 'h' is already
    // horizontal, 'v' needs a 90° turn. Sharpened, like the long-proven axis path.
    if (box.tilt == null) {
        val base = rotateRightAngle(region, if (box.orient == 'h') 0 else 90)
        return RawCropGroups(listOf(base, rotateRightAngle(base, 180)), sharpen = true, despeckle = false)
    }

    // Snap a near-right-angle moment angle to the exact 0/90 turn: that rotation does NOT
    // resample (so the crop can be sharpened to rescue thin strokes, exactly like the old
    // axis path) and the pill already fills its bbox, so no band-tighten is needed. A handheld
    // lean below UPRIGHT_DEG reads fine upright, so we don't correct it.
    val deg = box.tilt
    val nearUpright = abs(deg) < UPRIGHT_DEG
    val nearQuarter = abs(abs(deg) - 90) < UPRIGHT_DEG
    if (nearUpright || nearQuarter) {
        val base = rotateRightAngle(region, if (nearQuarter) 90 else 0)
        return RawCropGroups(listOf(base, rotateRightAngle(base, 180)), sharpen = true, despeckle = false)
    }

    // Genuinely diagonal pill: de-rotate the WHOLE padded region by the moment angle so the
    // pill lands horizontal. Its axis-aligned bbox is square and full of empty card, so after
    // rotation the (now horizontal) text sits in an image with big margins; prepForOcr scales
    // by the FULL crop height, which would shrink the text band too far. Since the rotation is
    // about the CENTRE, the pill is a horizontal strip ~pillW tall through the middle — so we
    // crop that centred strip directly. This is far more reliable than searching the de-rotated
    // square for a dark band, which can grab the card's off-centre legal-text block (a false
    // read). resample already softens the crop, so the band would otherwise need its own care.
    // Despeckle the binarized crop: the de-rotation leaves a stray pill-end speck that derails
    // the segmentation into a wrong-code false positive.
    val rotated = cropCenterStrip(rotateDeg(region, deg), box.pillW)
    return RawCropGroups(listOf(rotated, rotateRightAngle(rotated, 180)), sharpen = true, despeckle = true)
}

/** Crop a de-rotated image to a CENTRED horizontal strip tall enough to hold the pill
 *  (`pillH` px) plus a glyph margin. The crop was rotated about its centre, so the pill
 *  sits across the middle; a centred strip isolates it without picking up the card's
 *  off-centre text. Full width is kept so the whole code stays in view. */
private fun cropCenterStrip(src: GrayImage, pillH: Double): GrayImage {
    val w = src.width
    val h = src.height
    if (w < 8 || h < 8 || pillH <= 0) return src
    // Keep the strip close to the pill height (just a small quiet margin each side for the
    // border-flood) so the text BAND dominates the crop. prepForOcr upscales by the FULL crop
    // height, so an over-tall strip would shrink the text — at which the thin "1" in "CIV 12"
    // washes out and the read drops to "CIV2" (a real but WRONG code). ~1.4× brackets the
    // glyphs with a thin margin while keeping them large.
    val strip = min(h, Math.round(pillH * 1.4).toInt())
    if (strip >= h) return src
    val y0 = max(0, Math.round((h - strip) / 2.0).toInt())
    val bh = min(h - y0, strip)
    return src.crop(0, y0, w, bh)
}

/** Build the upright + 180°-flipped OCR crops for a detected box, each prepared
 *  (rotated upright, upscaled, binarized to dark-text-on-white, padded). The two
 *  candidates resolve the 0°/180° (or 90°/270°) ambiguity at OCR time. */
fun codeCropCandidates(frame: GrayImage, box: CodeBox, smallTargetHeight: Int = TARGET_H_SMALL): List<GrayImage> {
    val g = rawCropGroups(frame, box)
    // box.boost (set in findCodeBoxes) gates the taller small-source target: it rescues a
    // far/tiny PILL's thin strokes but sharpens a stray blob's dots into a phantom "00", so
    // only a pill-sized, pill-scored box gets it.
    return g.crops.map { prepForOcr(it, g.sharpen, box.boost, g.despeckle, smallTargetHeight) }
}

/** Lazy form of codeCropCandidates: extracts the RAW crops once (cheap rotations) but DEFERS
 *  the expensive prepForOcr (upscale + binarize + border-flood) to build(i). The live read
 *  resolves on the upright crop (variant 0) the vast majority of the time, so the 180°-flip's
 *  prep — the dominant per-frame cost once OCR itself is cheap — is never spent on those
 *  frames. build(i) is byte-identical to codeCropCandidates()[i]; this only changes WHEN the
 *  work happens, never WHAT is produced, so recall and the 0-FP guarantee are unaffected. */
class CropSource(val count: Int, val build: (Int) -> GrayImage)

fun codeCropSource(frame: GrayImage, box: CodeBox, smallTargetHeight: Int = TARGET_H_SMALL): CropSource {
    val g = rawCropGroups(frame, box)
    return CropSource(
        count = g.crops.size,
        build = { i -> prepForOcr(g.crops[i], g.sharpen, box.boost, g.despeckle, smallTargetHeight) },
    )
}

/** Share of ink (black) pixels in a PREPARED crop below which it can't hold a code: after
 *  the border-flood and sparse-ink gate, a blanked dense crop (legal text/photo) has ~0 ink
 *  and an empty card crop near 0. A real 4–6 glyph code covers a small but non-trivial share.
 *  Crops below this carry no glyph and are skipped before OCR — pure saved dispatch on the
 *  majority of frames that hold no readable pill (the sparse-ink gate already blanked the
 *  too-DENSE crops to all-white, so this lower bound catches both empty and gated crops). */
private const val MIN_OCR_INK_FRACTION = 0.004

/** True when a prepared (binarized, ink=0 on white=255) crop carries enough ink to possibly
 *  be a code — i.e. it's worth an OCR call. A blank/near-blank crop (empty card, or a dense
 *  crop the sparse-ink gate already blanked) can only ever OCR to nothing, so the recognizer
 *  skips it and saves the dispatch. Never widens what's read: a crop with real glyphs always
 *  clears this. */
fun cropHasOcrInk(crop: GrayImage): Boolean {
    val w = crop.width
    val h = crop.height
    if (w < 4 || h < 4) return false
    val d = crop.pixels
    var ink = 0
    // Prepared crops are pure black/white; ink = the dark pixels (value < 128).
    for (p in d.indices) if (d[p] < 128) ink++
    return ink >= w * h * MIN_OCR_INK_FRACTION
}

/** A box must score at least this to receive the taller small-source OCR target. Real
 *  code pills score ≥0.85; a spurious logo-blob box scores ~0.58, and boosting it turns
 *  its round blobs into a false "00". */
private const val SMALL_BOOST_MIN_SCORE = 0.68
/** ...and its body must be at least this solid. A hollow stray "0"/ring blob boosted turns
 *  its two sides into a phantom "00"; a real code pill is solid (fill ≈ 0.72 from moments).
 *  Held at 0.6 (not the tighter 0.7): far/small pills caught only by the second, smaller
 *  DET_BG_RADII pass land a touch hollower after downscale, and 0.7 dropped them — which is
 *  exactly the recall the real-life video frames depend on (0→4 of 6). The phantom-"00" risk
 *  the tighter line guarded against never materialized: the benchmark holds 0 false positives
 *  at 0.6, and the conservative matcher only ever resolves to a real checklist code anyway. */
private const val BOOST_MIN_FILL = 0.6

/** Crop a padded region (in full-frame pixels) into its own image. Mirrors the PWA's
 *  cropRegion: floor the padded origin clamped into the frame, ceil the padded size clamped
 *  to the remaining extent. GrayImage.crop clamps to bounds the same way drawImage did. */
private fun cropRegion(frame: GrayImage, box: CodeBox, padFrac: Double): GrayImage {
    val padX = box.w * padFrac
    val padY = box.h * padFrac
    val x = min(frame.width - 1, max(0, floor(box.x - padX).toInt()))
    val y = min(frame.height - 1, max(0, floor(box.y - padY).toInt()))
    val w = min(frame.width - x, ceil(box.w + padX * 2).toInt())
    val h = min(frame.height - y, ceil(box.h + padY * 2).toInt())
    return frame.crop(x, y, max(1, w), max(1, h))
}

/** Target text-band height (px) the OCR reads best; we upscale the crop to it.
 *  Generous so thin strokes (the "I" in CIV) survive binarization. */
private const val TARGET_H = 96
/** Taller target for a SMALL source crop (a far/multi-sticker pill only tens of px
 *  tall). At 96px such a pill's "1"/"I" wash out — "CIV 12" reads "CV"; at 160px the
 *  same crop reads "CV12", which the matcher restores to CIV12. Applied ONLY when the
 *  source is short: a close-up pill is already ~100–130px tall, so it keeps the 96
 *  target and its noise behaviour (a bigger upscale of a noisy close-up manufactured a
 *  false positive). */
private const val TARGET_H_SMALL = 160
const val RETRY_TARGET_H_SMALL = 192
/** Source crops shorter than this (px) are "small" and get TARGET_H_SMALL. Chosen
 *  between the multi-photo pills (raw height ~27–44px) and the close-up pills (~100px+). */
private const val SMALL_SRC_H = 64
private const val BORDER = 16
/** Unsharp-mask strength (percent) applied before binarization to rescue thin strokes
 *  from a soft/blurry capture. Gentle — enough to recover the "I"/"1" without turning
 *  sensor noise into ink. */
private const val UNSHARP_AMOUNT = 30
/** A real code pill is a few sparse glyphs — well under this share of ink after the
 *  card margin is cleared. A crop with more ink than this is a photo or a paragraph
 *  of legal text (a face-up sticker, the back's fine print); we blank it so OCR
 *  returns instantly instead of grinding through dozens of characters (which made a
 *  busy multi-sticker frame take >12s on a phone). */
private const val MAX_INK_FRACTION = 0.28

/** Upscale to a good OCR size and binarize to dark-text-on-white with a quiet
 *  border. The code is LIGHT text on a DARK pill, so ink (black) = the light pixels
 *  and the dark pill becomes white. Everything connected to the border (the card
 *  margin around the pill, and any inverted dark-on-light region) is then cleared,
 *  which both isolates the text and turns false-positive boxes (legal text, logos)
 *  into blanks that match nothing. */
private fun prepForOcr(
    src: GrayImage,
    sharpen: Boolean,
    boostSmall: Boolean = true,
    despeckle: Boolean = false,
    smallTargetHeight: Int = TARGET_H_SMALL,
): GrayImage {
    val sh = if (src.height != 0) src.height else 1
    val target = if (boostSmall && sh < SMALL_SRC_H) smallTargetHeight else TARGET_H
    val factor = max(1.0, target.toDouble() / sh)
    val cw = max(1, Math.round(src.width * factor).toInt())
    val ch = max(1, Math.round(src.height * factor).toInt())

    // The PWA drew the source onto a white BORDER-padded canvas with bilinear smoothing, then
    // read back the inner cw×ch region. Here we bilinear-upscale to cw×ch directly (the border
    // is pure white and never sampled, so it only matters for the flood-clear extent below).
    val upscaled = resizeBilinear(src, cw, ch)
    val count = cw * ch

    val gray = IntArray(count)
    for (p in 0 until count) gray[p] = upscaled.pixels[p]

    // Unsharp mask (axis-aligned crops only): restore local contrast on thin strokes that
    // a soft/blurry capture washed out (the "I" in CIV, the "1" in 12 fade into the pill
    // and otsu then drops them, mis-reading "CIV 12" as "CV2"). sharp = gray + amount·(gray
    // − localMean), clamped. Gentle radius/amount so it sharpens edges without amplifying
    // noise. Skipped on de-rotated crops: the rotation resample already softens them and a
    // second sharpening fragments the digits ("CIV 12" → "CIV" + "12").
    val hist = IntArray(256)
    if (sharpen) {
        val usRadius = max(1, Math.round(target * 0.04).toInt())
        val mean = boxBlur(gray, cw, ch, usRadius)
        for (p in 0 until count) {
            val s = gray[p] + ((gray[p] - mean[p]) * UNSHARP_AMOUNT) / 100.0
            val v = if (s < 0) 0 else if (s > 255) 255 else s.toInt()
            gray[p] = v
            hist[v]++
        }
    } else {
        for (p in 0 until count) hist[gray[p]]++
    }
    val threshold = otsu(hist, count)

    // Ink (0) = light pixels (the knockout text); dark pill → white (255).
    val bin = IntArray(count)
    for (p in 0 until count) bin[p] = if (gray[p] > threshold) 0 else 255

    floodClearFromBorder(bin, cw, ch)

    // Despeckle (de-rotated crops only): clear ink blobs far too small to be a glyph. A
    // de-rotated crop of a steep pill keeps a stray speck (a rounded pill-end remnant) beside
    // the code; left in, it throws the segmentation off so the leading "C" reads "G" and the
    // code snaps to a wrong real code ("CIV 12" → "GIV2" → CIV2, a false positive). Glyphs are
    // large after the upscale, so a generous min-area removes only specks. The axis path skips
    // this so its sharpened thin strokes are never touched.
    if (despeckle) removeSmallInkBlobs(bin, cw, ch, max(4, Math.round(ch * ch * 0.005).toInt()))

    // Sparse-ink gate: a code is a few glyphs; anything denser is a photo or fine
    // print. Blank it so the OCR call returns at once (the per-crop speed guard).
    var ink = 0
    for (p in 0 until count) if (bin[p] == 0) ink++
    if (ink > count * MAX_INK_FRACTION) bin.fill(255)

    // Compose the bordered output: a white field of (cw+2·BORDER)×(ch+2·BORDER) with the
    // binarized crop placed at (BORDER,BORDER). The PWA kept the border so downstream code
    // (and the flood-clear, already run above on the inner region) sees the same geometry.
    val outW = cw + BORDER * 2
    val outH = ch + BORDER * 2
    val outPx = IntArray(outW * outH) { 255 }
    for (y in 0 until ch) {
        val dstRow = (y + BORDER) * outW + BORDER
        val srcRow = y * cw
        for (x in 0 until cw) outPx[dstRow + x] = bin[srcRow + x]
    }
    return GrayImage(outW, outH, outPx)
}

/** Flip every ink (0) pixel reachable from the image border to white, removing the
 *  card frame/margin around the pill while leaving the interior text untouched. */
private fun floodClearFromBorder(bin: IntArray, w: Int, h: Int) {
    val stack = IntArray(w * h)
    var sp = 0
    fun visit(i: Int) {
        if (bin[i] == 0) {
            bin[i] = 255
            stack[sp++] = i
        }
    }
    for (x in 0 until w) {
        visit(x)
        visit((h - 1) * w + x)
    }
    for (y in 0 until h) {
        visit(y * w)
        visit(y * w + (w - 1))
    }
    while (sp > 0) {
        val i = stack[--sp]
        val x = i % w
        val y = i / w
        if (x > 0) visit(i - 1)
        if (x < w - 1) visit(i + 1)
        if (y > 0) visit(i - w)
        if (y < h - 1) visit(i + w)
    }
}

/** Clear every connected ink (0) component smaller than `minArea` pixels (4-connected),
 *  leaving the glyphs. A flood fill per unvisited ink pixel: collect the component, and if
 *  it's a speck, white it out. Glyphs survive (they're far larger after the upscale). */
private fun removeSmallInkBlobs(bin: IntArray, w: Int, h: Int, minArea: Int) {
    val n = w * h
    val seen = ByteArray(n)
    val stack = IntArray(n)
    val comp = IntArray(n)
    for (start in 0 until n) {
        if (bin[start] != 0 || seen[start].toInt() == 1) continue
        var sp = 0
        var c = 0
        stack[sp++] = start
        seen[start] = 1
        while (sp > 0) {
            val i = stack[--sp]
            comp[c++] = i
            val x = i % w
            val y = i / w
            if (x > 0 && bin[i - 1] == 0 && seen[i - 1].toInt() == 0) { seen[i - 1] = 1; stack[sp++] = i - 1 }
            if (x < w - 1 && bin[i + 1] == 0 && seen[i + 1].toInt() == 0) { seen[i + 1] = 1; stack[sp++] = i + 1 }
            if (y > 0 && bin[i - w] == 0 && seen[i - w].toInt() == 0) { seen[i - w] = 1; stack[sp++] = i - w }
            if (y < h - 1 && bin[i + w] == 0 && seen[i + w].toInt() == 0) { seen[i + w] = 1; stack[sp++] = i + w }
        }
        if (c < minArea) for (k in 0 until c) bin[comp[k]] = 255
    }
}

private fun otsu(hist: IntArray, total: Int): Int {
    var sum = 0.0
    for (t in 0 until 256) sum += t * hist[t]
    var sumB = 0.0
    var wB = 0
    var maxVar = 0.0
    var threshold = 127
    for (t in 0 until 256) {
        wB += hist[t]
        if (wB == 0) continue
        val wF = total - wB
        if (wF == 0) break
        sumB += (t * hist[t]).toDouble()
        val mB = sumB / wB
        val mF = (sum - sumB) / wF
        val between = wB.toDouble() * wF * (mB - mF) * (mB - mF)
        if (between > maxVar) {
            maxVar = between
            threshold = t
        }
    }
    return threshold
}

/** Integral-image box blur → local mean. LongArray integral to avoid overflow (a full
 *  DET_LONG raster summed in Float lost low bits; longs stay exact). */
private fun boxBlur(gray: IntArray, w: Int, h: Int, r: Int): IntArray {
    val iw = w + 1
    val integral = LongArray(iw * (h + 1))
    for (y in 1..h) {
        for (x in 1..w) {
            integral[y * iw + x] =
                gray[(y - 1) * w + (x - 1)].toLong() +
                integral[(y - 1) * iw + x] +
                integral[y * iw + (x - 1)] -
                integral[(y - 1) * iw + (x - 1)]
        }
    }
    val out = IntArray(w * h)
    for (y in 0 until h) {
        val y0 = max(0, y - r)
        val y1 = min(h - 1, y + r)
        for (x in 0 until w) {
            val x0 = max(0, x - r)
            val x1 = min(w - 1, x + r)
            val area = (x1 - x0 + 1) * (y1 - y0 + 1)
            val sum =
                integral[(y1 + 1) * iw + (x1 + 1)] -
                integral[y0 * iw + (x1 + 1)] -
                integral[(y1 + 1) * iw + x0] +
                integral[y0 * iw + x0]
            out[y * w + x] = (sum / area).toInt()
        }
    }
    return out
}

/** Bilinear resize of a grayscale image to dw×dh. Replaces the PWA's reliance on canvas
 *  imageSmoothing (bilinear) for both the DET_LONG detection downscale and the prepForOcr
 *  upscale — the only two places the TS resized through drawImage. Maps each destination
 *  pixel centre back to source coordinates and samples the four neighbours; edges clamp. */
private fun resizeBilinear(src: GrayImage, dw: Int, dh: Int): GrayImage {
    val sw = src.width
    val sh = src.height
    if (dw <= 0 || dh <= 0 || sw == 0 || sh == 0) return GrayImage(max(0, dw), max(0, dh), IntArray(max(0, dw) * max(0, dh)))
    if (dw == sw && dh == sh) return src
    val out = IntArray(dw * dh)
    val sp = src.pixels
    // Destination pixel centre (dx+0.5)/dw maps to source coordinate that centre - 0.5.
    val scaleX = sw.toDouble() / dw
    val scaleY = sh.toDouble() / dh
    for (oy in 0 until dh) {
        val syf = (oy + 0.5) * scaleY - 0.5
        var y0 = floor(syf).toInt()
        val fy = syf - y0
        var y1 = y0 + 1
        if (y0 < 0) y0 = 0
        if (y0 > sh - 1) y0 = sh - 1
        if (y1 < 0) y1 = 0
        if (y1 > sh - 1) y1 = sh - 1
        for (ox in 0 until dw) {
            val sxf = (ox + 0.5) * scaleX - 0.5
            var x0 = floor(sxf).toInt()
            val fx = sxf - x0
            var x1 = x0 + 1
            if (x0 < 0) x0 = 0
            if (x0 > sw - 1) x0 = sw - 1
            if (x1 < 0) x1 = 0
            if (x1 > sw - 1) x1 = sw - 1
            val p00 = sp[y0 * sw + x0]
            val p10 = sp[y0 * sw + x1]
            val p01 = sp[y1 * sw + x0]
            val p11 = sp[y1 * sw + x1]
            val top = p00 + (p10 - p00) * fx
            val bottom = p01 + (p11 - p01) * fx
            val v = (top + (bottom - top) * fy)
            out[oy * dw + ox] = v.toInt().coerceIn(0, 255)
        }
    }
    return GrayImage(dw, dh, out)
}

/** Greedy non-maximum suppression by intersection-over-union. */
private fun nonMaxSuppress(boxes: List<CodeBox>, iouThresh: Double): List<CodeBox> {
    val kept = ArrayList<CodeBox>()
    for (b in boxes) {
        var overlaps = false
        for (k in kept) {
            if (iou(b, k) > iouThresh) {
                overlaps = true
                break
            }
        }
        if (!overlaps) kept.add(b)
    }
    return kept
}

private fun iou(a: CodeBox, b: CodeBox): Double {
    val x1 = max(a.x, b.x)
    val y1 = max(a.y, b.y)
    val x2 = min(a.x + a.w, b.x + b.w)
    val y2 = min(a.y + a.h, b.y + b.h)
    val inter = max(0.0, x2 - x1) * max(0.0, y2 - y1)
    val union = a.w * a.h + b.w * b.h - inter
    return if (union > 0) inter / union else 0.0
}
