package br.com.fiquemsabendo.figurinhas.camera

import android.annotation.SuppressLint
import android.content.Context
import android.hardware.camera2.CameraCharacteristics
import android.hardware.camera2.CaptureRequest
import androidx.annotation.OptIn
import androidx.camera.camera2.interop.Camera2CameraInfo
import androidx.camera.camera2.interop.Camera2Interop
import androidx.camera.camera2.interop.ExperimentalCamera2Interop
import androidx.camera.core.Camera
import androidx.camera.core.CameraInfo
import androidx.camera.core.CameraSelector
import androidx.camera.core.ImageAnalysis
import androidx.camera.core.ImageProxy
import androidx.camera.core.Preview
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.core.content.ContextCompat
import androidx.lifecycle.LifecycleOwner
import br.com.fiquemsabendo.figurinhas.Config
import br.com.fiquemsabendo.figurinhas.data.CameraFacing
import br.com.fiquemsabendo.figurinhas.ocr.GrayImage
import br.com.fiquemsabendo.figurinhas.ocr.rotateRightAngle
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors

// The Android camera→luma seam (ports src/ocr/frameSource.ts). CameraX gives us a Preview for the
// on-screen feed and an ImageAnalysis stream of YUV_420_888 frames; we hand the analyzer's Y (luma)
// plane straight to the recognizer as a GrayImage — exactly the plane the whole OCR pipeline already
// works on, so there is NO per-frame RGBA readback (the PWA paid that via canvas getImageData).
//
// This class owns ONLY the camera plumbing (bind/unbind, the YUV→GrayImage conversion, near-focus
// lock). All decision logic — frame-diff, the capture trigger, the burst, recognition — lives in
// ScanViewModel, which receives each frame via the onLuma callback. Mirrors the PWA split where
// frameSource.ts is dumb plumbing and ScanScreen.tsx orchestrates.

/**
 * Best-effort manual focus distance, in diopters (1/metres), pushed to the lens via Camera2Interop.
 * Stickers are always shown CLOSE, so — like the PWA's lockNearFocus — we pin focus near the lens's
 * near limit instead of letting continuous autofocus hunt (the main cause of soft, variable frames).
 *
 * We REQUEST the device's reported near limit (LENS_INFO_MINIMUM_FOCUS_DISTANCE) at bind time. The
 * exact value is DEVICE-DEPENDENT and MUST be tuned on the Pixel: if close stickers come out blurry
 * the lens may need a smaller diopter (focus farther). If CameraX cannot expose the selected
 * camera's characteristics we fall back to this conservative value; if the camera reports fixed-focus
 * / no manual support, the Camera2Interop block is skipped and ordinary autofocus stays. */
private const val FALLBACK_NEAR_FOCUS_DIOPTERS = 10.0f

class CameraFrameSource(context: Context) {
    private val appContext = context.applicationContext

    // CameraX delivers analysis frames on this single background thread. One thread keeps frames
    // strictly ordered and means the (cheap) YUV→GrayImage copy never runs on the main thread.
    private val analysisExecutor: ExecutorService = Executors.newSingleThreadExecutor()

    private var cameraProvider: ProcessCameraProvider? = null

    /**
     * Bind (or re-bind) the Preview + ImageAnalysis use cases for [facing]. [onLuma] is invoked on
     * the analysis executor with each frame's full-resolution Y plane as a [GrayImage]; the frame's
     * ImageProxy is closed immediately after, so [onLuma] must not retain the proxy (the GrayImage
     * is a private copy and is safe to keep).
     *
     * Idempotent on facing changes: a re-bind unbinds the previous use cases first, so flipping the
     * camera restarts only the stream (mirrors ScanScreen's facing effect).
     */
    fun bind(
        lifecycleOwner: LifecycleOwner,
        surfaceProvider: Preview.SurfaceProvider,
        facing: CameraFacing,
        onLuma: (GrayImage) -> Unit,
    ) {
        val future = ProcessCameraProvider.getInstance(appContext)
        future.addListener({
            val provider = future.get()
            cameraProvider = provider

            val selector = when (facing) {
                CameraFacing.FRONT -> CameraSelector.DEFAULT_FRONT_CAMERA
                CameraFacing.BACK -> CameraSelector.DEFAULT_BACK_CAMERA
            }
            val focusDiopters = nearFocusDiopters(provider, selector)

            val preview = buildPreview(surfaceProvider, focusDiopters)
            val analysis = buildAnalysis(onLuma, focusDiopters)

            // Re-bind cleanly: drop any previous use cases before binding the new ones so a facing
            // flip swaps the stream without stacking bindings.
            provider.unbindAll()
            val camera = provider.bindToLifecycle(lifecycleOwner, selector, preview, analysis)
            applyLiveZoom(camera, facing)
        }, ContextCompat.getMainExecutor(appContext))
    }

    /** Tear down all use cases (e.g. screen left, or before a facing re-bind). Safe to call when
     *  nothing is bound. */
    fun unbind() {
        cameraProvider?.unbindAll()
    }

    /** Release the analysis executor. Call from the owner's onCleared/onDestroy. After this the
     *  source can't be re-bound. */
    fun shutdown() {
        unbind()
        analysisExecutor.shutdown()
    }

    @OptIn(ExperimentalCamera2Interop::class)
    private fun buildPreview(
        surfaceProvider: Preview.SurfaceProvider,
        focusDiopters: Float?,
    ): Preview {
        val builder = Preview.Builder()
        // Apply the same near-focus lock to the preview so the on-screen feed matches what the
        // analyzer reads (and so a device that honours focus on the preview stream is consistent).
        applyNearFocus(Camera2Interop.Extender(builder), focusDiopters)
        return builder.build().also { it.surfaceProvider = surfaceProvider }
    }

    @OptIn(ExperimentalCamera2Interop::class)
    private fun buildAnalysis(
        onLuma: (GrayImage) -> Unit,
        focusDiopters: Float?,
    ): ImageAnalysis {
        val builder = ImageAnalysis.Builder()
            // Always analyze the freshest frame, dropping any that pile up while a recognition is in
            // flight — the camera-level half of the "drop frames during a recognize" guard (the
            // ViewModel's mutex is the other half). Output is YUV_420_888 (the default), whose Y
            // plane IS the luma the recognizer wants.
            .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
        applyNearFocus(Camera2Interop.Extender(builder), focusDiopters)
        val analysis = builder.build()
        analysis.setAnalyzer(analysisExecutor) { imageProxy ->
            try {
                // Rotate the sensor (landscape) frame to DISPLAY orientation so the recognizer's frame
                // matches what the user sees in the portrait preview — this is what lets a target-box
                // ROI + reticle line up. rotationDegrees is 0/90/180/270 (rotateRightAngle handles all).
                // Cost is ~1ms on a 640x480 plane; the recognize budget is ~30ms, so it's negligible.
                val gray = imageProxy.toGrayImage()
                val rot = imageProxy.imageInfo.rotationDegrees
                onLuma(if (rot != 0) rotateRightAngle(gray, rot) else gray)
            } finally {
                // ALWAYS close, even if conversion/onLuma throws — an unclosed ImageProxy starves
                // the analysis pipeline (no further frames arrive).
                imageProxy.close()
            }
        }
        return analysis
    }

    /**
     * Best-effort near-focus lock via Camera2Interop, mirroring frameSource.ts's lockNearFocus.
     * We force AF off and drive the lens to its near limit when [focusDiopters] is known. If the
     * selected camera reports fixed-focus/no manual support, [focusDiopters] is null and we skip the
     * whole block so autofocus/fixed-focus behavior stays untouched.
     */
    @OptIn(ExperimentalCamera2Interop::class)
    private fun applyNearFocus(extender: Camera2Interop.Extender<*>, focusDiopters: Float?) {
        if (focusDiopters == null) return
        try {
            extender.setCaptureRequestOption(
                CaptureRequest.CONTROL_AF_MODE,
                CaptureRequest.CONTROL_AF_MODE_OFF,
            )
            extender.setCaptureRequestOption(
                CaptureRequest.LENS_FOCUS_DISTANCE,
                focusDiopters,
            )
        } catch (_: Throwable) {
            // Manual focus unsupported on this device — leave autofocus alone.
        }
    }

    /**
     * Read the selected camera's reported near-focus limit before building the use cases, so the
     * Camera2Interop request matches the lens instead of always using the static fallback.
     */
    private fun nearFocusDiopters(provider: ProcessCameraProvider, selector: CameraSelector): Float? {
        val selected = try {
            selector.filter(provider.availableCameraInfos).firstOrNull()
        } catch (_: Throwable) {
            null
        }
        if (selected == null) return FALLBACK_NEAR_FOCUS_DIOPTERS
        return reportedNearFocusDiopters(selected)
    }

    /**
     * Best-effort: returns the device's LENS_INFO_MINIMUM_FOCUS_DISTANCE, or null when the camera
     * advertises no manual focus (an UNCALIBRATED / fixed lens reports 0.0). Suppressed lint: the
     * characteristics are read-only.
     */
    @SuppressLint("UnsafeOptInUsageError")
    @OptIn(ExperimentalCamera2Interop::class)
    fun reportedNearFocusDiopters(cameraInfo: CameraInfo): Float? {
        return try {
            val chars = Camera2CameraInfo.from(cameraInfo)
            val min = chars.getCameraCharacteristic(
                CameraCharacteristics.LENS_INFO_MINIMUM_FOCUS_DISTANCE,
            )
            // 0.0 == fixed-focus / uncalibrated lens → no manual focus to lock.
            if (min != null && min > 0f) min else null
        } catch (_: Throwable) {
            null
        }
    }

    /**
     * Request a modest front-camera digital zoom after binding. This keeps preview and analysis in
     * sync because CameraX applies the zoom at the camera pipeline level. The Pixel live dumps showed
     * the recognizer was fast and conservative, but the printed code pill was too small; zoom makes
     * the reticle behave like a tighter scanner window without relaxing OCR confidence.
     */
    private fun applyLiveZoom(camera: Camera, facing: CameraFacing) {
        val target = if (facing == CameraFacing.FRONT) Config.Camera.FRONT_ZOOM_RATIO else 1.0f
        if (target <= 1.0f) return
        try {
            val zoomState = camera.cameraInfo.zoomState.value ?: return
            val clamped = target.coerceIn(zoomState.minZoomRatio, zoomState.maxZoomRatio)
            if (clamped > zoomState.minZoomRatio) camera.cameraControl.setZoomRatio(clamped)
        } catch (_: Throwable) {
            // Zoom unsupported or rejected by this camera; scanning still works without it.
        }
    }
}

/**
 * Convert an ImageProxy's Y (luma) plane to a full-resolution [GrayImage]. YUV_420_888's first
 * plane is the luma plane: one byte per pixel, but with two strides that MUST be respected —
 *
 *   • rowStride: bytes between the START of consecutive rows. It is usually >= width (the device
 *     pads each row to a hardware alignment), so we copy only the first `width` bytes of each row.
 *   • pixelStride: bytes between consecutive luma SAMPLES in a row. It's 1 for the Y plane on every
 *     device seen, but we honour it anyway (a hypothetical interleaved layout would set it >1).
 *
 * Each byte is unsigned luma (0=black..255=white); `& 0xFF` widens it without sign extension. The
 * fast path (pixelStride == 1) is a tight row copy; the general path strides per pixel. */
private fun ImageProxy.toGrayImage(): GrayImage {
    val width = this.width
    val height = this.height
    val plane = this.planes[0]
    val buffer = plane.buffer
    val rowStride = plane.rowStride
    val pixelStride = plane.pixelStride

    val out = IntArray(width * height)
    val row = ByteArray(rowStride)
    var dst = 0
    for (y in 0 until height) {
        // Position the buffer at this row's start and pull the whole (padded) row in one read.
        buffer.position(y * rowStride)
        val toRead = minOf(rowStride, buffer.remaining())
        buffer.get(row, 0, toRead)
        if (pixelStride == 1) {
            for (x in 0 until width) out[dst++] = row[x].toInt() and 0xFF
        } else {
            var src = 0
            for (x in 0 until width) {
                out[dst++] = row[src].toInt() and 0xFF
                src += pixelStride
            }
        }
    }
    return GrayImage(width, height, out)
}

/**
 * Nearest-neighbour downscale so the long side is at most [maxW] (never upscales). Used by the
 * ViewModel to build the tiny ~160px frame-diff image; the diff only needs coarse motion, so NN is
 * both adequate and cheap (the recognizer itself uses the FULL-resolution frame, never this). */
fun GrayImage.downscaleTo(maxW: Int): GrayImage {
    val longSide = maxOf(width, height)
    if (longSide <= maxW || longSide == 0) return this
    val scale = maxW.toDouble() / longSide
    val dw = maxOf(1, (width * scale).toInt())
    val dh = maxOf(1, (height * scale).toInt())
    val out = IntArray(dw * dh)
    var d = 0
    for (y in 0 until dh) {
        val sy = (y * height) / dh
        val srcRow = sy * width
        for (x in 0 until dw) {
            val sx = (x * width) / dw
            out[d++] = pixels[srcRow + sx]
        }
    }
    return GrayImage(dw, dh, out)
}
