package br.com.fiquemsabendo.figurinhas.ocr

import br.com.fiquemsabendo.figurinhas.Config
import kotlin.math.abs

// Capture-trigger decision logic, ported from src/ocr/autoCapture.ts.
//
// PUSH model (not the web's setTimeout poll): CameraX delivers one frame per analysis callback
// (~30fps), so this module is FED each frame's motion measure as it arrives. We port the DECISION
// LOGIC inside the web's tick() (motion -> hold-still -> FIRE -> locked -> re-arm) plus frameDiff.
//
// Intentionally OMITTED vs the PWA (orchestrator's job, not this state machine):
//   - schedule()/setTimeout, sampleIntervalMs   -> frames arrive at camera rate; no polling here.
//   - capture()/onCapture/burstFrames/burstIntervalMs -> the burst read + OCR live in the
//     orchestrator. onFrame() only RETURNS FIRE; the orchestrator runs the (async) burst and calls
//     fired() when it finishes, which sets the lock + cooldown (mirrors capture()'s finally block).
//   - canvas/drawTo/getImageData                -> the orchestrator supplies the small downscaled
//     diff frames (already luma) to frameDiff and the resulting fraction to onFrame.
// So this module is free of IO, threads, and timers: time is passed IN via nowMs.

/** Luminance change above this (0..255) counts a sampled pixel as "changed". (TS: LUMA_DELTA) */
private const val LUMA_DELTA = 24

/**
 * Fraction (0..1) of pixels whose luma differs by more than [LUMA_DELTA] between two equal-size
 * frames. The PWA computed luma from RGBA; here both images ARE luma (GrayImage 0..255), so we
 * compare the stored values directly. Returns 0.0 if the sizes differ or the images are empty.
 * Pure — both inputs are the small downscaled diff image the orchestrator supplies (same size).
 */
fun frameDiff(prev: GrayImage, next: GrayImage): Double {
    val n = prev.pixels.size
    if (n != next.pixels.size || n == 0) return 0.0

    var changed = 0
    for (i in 0 until n) {
        if (abs(prev.pixels[i] - next.pixels[i]) > LUMA_DELTA) changed++
    }
    return changed.toDouble() / n
}

/**
 * Loop phase reported each frame.
 * - [WAITING]  armed, no motion seen yet (won't fire on the empty mat sitting still).
 * - [MOVING]   in motion (above the still threshold, below re-arm, or actively moving).
 * - [HOLDING]  still and counting toward stability.
 * - [FIRE]     fire a capture/burst THIS frame (returned exactly once at the crossing frame).
 * - [LOCKED]   already captured; waiting for the sticker to leave before re-arming.
 */
enum class CapturePhase { WAITING, MOVING, HOLDING, FIRE, LOCKED }

private enum class State { WAITING, LOCKED }

/**
 * Push-driven capture trigger. The orchestrator feeds each frame's motion measure (the [frameDiff]
 * fraction) via [onFrame], which returns the phase for that frame. When [onFrame] returns
 * [CapturePhase.FIRE], the orchestrator runs the burst read and calls [fired] once it finishes.
 *
 * Mirrors the web createAutoCapture state machine, minus the timer/IO (see file header).
 */
class CaptureTrigger {
    private var state = State.WAITING
    private var sawMotion = false
    private var stillSince: Long? = null
    private var lastCaptureAt = 0L

    /**
     * Feed one frame's motion [diff] (0..1) at time [nowMs]; returns this frame's phase.
     * Ports the web tick()'s waiting/locked branches and their ordering EXACTLY. Note: unlike the
     * web's tick(), this never mutates lock/cooldown state on FIRE — that is [fired]'s job, so the
     * orchestrator owns when the async burst completes.
     */
    @Synchronized
    fun onFrame(diff: Double, nowMs: Long): CapturePhase {
        val still = Config.Capture.STILL_THRESHOLD
        val rearm = Config.Capture.REARM_THRESHOLD

        if (state == State.WAITING) {
            // Require motion first so we don't fire on the empty mat sitting still.
            if (diff >= rearm) {
                sawMotion = true
                stillSince = null
            }
            if (!sawMotion) return CapturePhase.WAITING

            return if (diff < still) {
                val since = stillSince
                if (since == null) {
                    stillSince = nowMs
                    CapturePhase.HOLDING
                } else if (
                    nowMs - since >= Config.Capture.STABILITY_MS &&
                    // Cooldown: a "new" sticker sooner than this since the last read can't be a real
                    // swap — it's the same one re-triggering, so ignore it until enough time passes.
                    nowMs - lastCaptureAt >= Config.Capture.MIN_RECAPTURE_MS
                ) {
                    CapturePhase.FIRE
                } else {
                    // Still counting toward stability (or in cooldown): keep holding.
                    CapturePhase.HOLDING
                }
            } else {
                stillSince = null // moved again — restart the stability timer
                CapturePhase.MOVING
            }
        } else {
            // LOCKED: wait for the sticker to be removed/replaced before re-arming.
            return if (diff >= rearm) {
                state = State.WAITING
                sawMotion = true
                stillSince = null
                // The re-arm frame itself is the new motion (diff >= rearm > still), so it's MOVING.
                CapturePhase.MOVING
            } else {
                CapturePhase.LOCKED
            }
        }
    }

    /**
     * Call AFTER the orchestrator finishes the burst that a [CapturePhase.FIRE] triggered: lock,
     * clear motion/stillness, and stamp the cooldown. Mirrors the web capture()'s finally block,
     * keeping the lock/cooldown semantics out of [onFrame] so the orchestrator controls when the
     * (async) burst completes.
     */
    @Synchronized
    fun fired(nowMs: Long) {
        state = State.LOCKED
        sawMotion = false
        stillSince = null
        lastCaptureAt = nowMs
    }

    /**
     * Call AFTER a burst that committed NOTHING. Unlike [fired] this does NOT lock — locking would
     * (a) falsely report a read (the LOCKED phase reads "lido ✓ — troque a figurinha") and (b)
     * strand the user on a sticker that just needs another, sharper frame, since LOCKED only releases
     * once the sticker is physically waved away. Instead we stay armed on the still-present sticker
     * and restart the stability count, so a sticker held over the box is RETRIED automatically. The
     * cooldown stamp spaces those retries at [Config.Capture.MIN_RECAPTURE_MS] rather than every frame.
     */
    @Synchronized
    fun rearmAfterEmptyBurst(nowMs: Long) {
        state = State.WAITING
        sawMotion = true   // the sticker is still there — keep the loop armed (don't wait for new motion)
        stillSince = null  // re-accrue stability before the next FIRE
        lastCaptureAt = nowMs // space retries by the recapture cooldown
    }

    /** Back to armed/waiting; clear motion + stillness. Mirrors the web reset(). */
    @Synchronized
    fun reset() {
        state = State.WAITING
        sawMotion = false
        stillSince = null
    }

    /** Debug readout: how long the current still hold has lasted at [nowMs] (0 if not holding). */
    @Synchronized
    fun heldMs(nowMs: Long): Long {
        val since = stillSince ?: return 0L
        return nowMs - since
    }
}
