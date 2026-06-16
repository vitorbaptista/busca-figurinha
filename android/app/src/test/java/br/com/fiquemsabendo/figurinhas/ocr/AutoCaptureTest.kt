package br.com.fiquemsabendo.figurinhas.ocr

import br.com.fiquemsabendo.figurinhas.Config
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

// Deterministic, clock-injected tests for the capture-trigger decision logic (AutoCapture.kt).
// All timing is passed in via nowMs; no real clock, no IO. Mirrors src/ocr/autoCapture.ts.

class AutoCaptureTest {

    // --- frameDiff -----------------------------------------------------------------------------

    private fun gray(vararg values: Int): GrayImage =
        GrayImage(values.size, 1, values.copyOf())

    @Test
    fun `frameDiff of identical images is zero`() {
        val img = gray(0, 64, 128, 200, 255, 10, 90, 180)
        assertEquals(0.0, frameDiff(img, img))
    }

    @Test
    fun `frameDiff with half the pixels changed by more than LUMA_DELTA is about one half`() {
        // 8 pixels: even indices change by 100 (> 24), odd indices unchanged.
        val prev = gray(0, 50, 0, 50, 0, 50, 0, 50)
        val next = gray(100, 50, 100, 50, 100, 50, 100, 50)
        assertEquals(0.5, frameDiff(prev, next))
    }

    @Test
    fun `frameDiff returns zero on size mismatch`() {
        val a = gray(0, 0, 0, 0)
        val b = gray(255, 255, 255)
        assertEquals(0.0, frameDiff(a, b))
    }

    @Test
    fun `frameDiff returns zero for empty images`() {
        val empty = GrayImage(0, 0, IntArray(0))
        assertEquals(0.0, frameDiff(empty, empty))
    }

    @Test
    fun `frameDiff ignores sub-LUMA_DELTA changes`() {
        // Every pixel changes by exactly 24 — NOT strictly greater than LUMA_DELTA (24), so 0.
        val prev = gray(0, 10, 20, 30, 40, 50)
        val next = gray(24, 34, 44, 54, 64, 74)
        assertEquals(0.0, frameDiff(prev, next))
    }

    // --- CaptureTrigger ------------------------------------------------------------------------

    // Convenience diffs around the configured thresholds.
    private val STILL = 0.0 // < STILL_THRESHOLD (0.02)
    private val MOVING = 0.04 // >= STILL_THRESHOLD, < REARM_THRESHOLD (0.06)
    private val REARM = 0.10 // >= REARM_THRESHOLD

    @Test
    fun `does not fire on the empty mat sitting still`() {
        val t = CaptureTrigger()
        var now = 0L
        // Many still frames with no motion ever seen -> never FIRE; always WAITING.
        repeat(50) {
            now += 16
            assertEquals(CapturePhase.WAITING, t.onFrame(STILL, now))
        }
    }

    @Test
    fun `fires once after motion then stillness held past stability with cooldown elapsed`() {
        val t = CaptureTrigger()
        var now = 1000L // start well past lastCaptureAt=0 so the cooldown is already satisfied

        // Sticker lands: motion seen.
        assertEquals(CapturePhase.MOVING, t.onFrame(REARM, now))

        // First still frame starts the stability timer.
        now += 16
        assertEquals(CapturePhase.HOLDING, t.onFrame(STILL, now))

        // Still counting toward STABILITY_MS -> HOLDING (no fire yet).
        now += 50
        assertEquals(CapturePhase.HOLDING, t.onFrame(STILL, now))

        // Cross STABILITY_MS since the first still frame -> FIRE exactly once.
        now += Config.Capture.STABILITY_MS
        assertEquals(CapturePhase.FIRE, t.onFrame(STILL, now))

        // WITHOUT fired(): subsequent still frames keep re-FIRING (state is still WAITING, the hold
        // is still satisfied). This documents that the orchestrator MUST call fired() to lock.
        now += 16
        assertEquals(CapturePhase.FIRE, t.onFrame(STILL, now))

        // Orchestrator finishes the burst -> lock + cooldown stamp.
        t.fired(now)

        // Now still frames do NOT re-FIRE; we're LOCKED until a re-arm.
        now += 16
        assertEquals(CapturePhase.LOCKED, t.onFrame(STILL, now))
        now += 16
        assertEquals(CapturePhase.LOCKED, t.onFrame(STILL, now))
    }

    @Test
    fun `cooldown blocks a refire sooner than MIN_RECAPTURE_MS then allows it after`() {
        val t = CaptureTrigger()
        var now = 1000L

        // First capture cycle, then lock + cooldown at t = firstFire.
        t.onFrame(REARM, now)
        now += 16
        t.onFrame(STILL, now) // stillSince set
        now += Config.Capture.STABILITY_MS
        assertEquals(CapturePhase.FIRE, t.onFrame(STILL, now))
        val firedAt = now
        t.fired(firedAt)

        // Re-arm and hold again, but reach the stability crossing BEFORE MIN_RECAPTURE_MS elapses.
        now += 16
        assertEquals(CapturePhase.MOVING, t.onFrame(REARM, now)) // leaves LOCKED -> waiting
        now += 16
        assertEquals(CapturePhase.HOLDING, t.onFrame(STILL, now)) // stillSince set
        // Advance just enough to pass STABILITY_MS but stay within MIN_RECAPTURE_MS of firedAt.
        now += Config.Capture.STABILITY_MS
        assertTrue(now - firedAt < Config.Capture.MIN_RECAPTURE_MS) // guard precondition
        assertEquals(CapturePhase.HOLDING, t.onFrame(STILL, now)) // cooldown still active -> no FIRE

        // Hold further until MIN_RECAPTURE_MS since firedAt has elapsed -> now it fires.
        now = firedAt + Config.Capture.MIN_RECAPTURE_MS
        assertTrue(now - firedAt >= Config.Capture.MIN_RECAPTURE_MS)
        assertEquals(CapturePhase.FIRE, t.onFrame(STILL, now))
    }

    @Test
    fun `rearmAfterEmptyBurst keeps retrying a held sticker and never locks`() {
        val t = CaptureTrigger()
        var now = 1000L

        // Sticker lands and is held still past stability -> FIRE.
        t.onFrame(REARM, now)
        now += 16
        t.onFrame(STILL, now)
        now += Config.Capture.STABILITY_MS
        assertEquals(CapturePhase.FIRE, t.onFrame(STILL, now))

        // The burst read NOTHING -> re-arm (the new path), NOT fired()/lock.
        val emptyAt = now
        t.rearmAfterEmptyBurst(emptyAt)

        // The sticker is STILL held. We must NOT be LOCKED (locking would falsely show
        // "lido ✓ — troque a figurinha"); instead the stability count re-accrues.
        now += 16
        assertEquals(CapturePhase.HOLDING, t.onFrame(STILL, now))

        // Within MIN_RECAPTURE_MS of the empty burst the cooldown blocks a re-FIRE (still HOLDING).
        now += Config.Capture.STABILITY_MS
        assertTrue(now - emptyAt < Config.Capture.MIN_RECAPTURE_MS) // guard precondition
        assertEquals(CapturePhase.HOLDING, t.onFrame(STILL, now))

        // Once the recapture cooldown elapses, the SAME held sticker is retried (FIRE again) — no
        // wave-away needed. This is the auto-retry that locking-after-an-empty-burst used to prevent.
        now = emptyAt + Config.Capture.MIN_RECAPTURE_MS
        assertEquals(CapturePhase.FIRE, t.onFrame(STILL, now))
    }

    @Test
    fun `locked re-arms on a high-diff frame so the next sticker can fire`() {
        val t = CaptureTrigger()
        var now = 1000L

        // Fire + lock the first sticker.
        t.onFrame(REARM, now)
        now += 16
        t.onFrame(STILL, now)
        now += Config.Capture.STABILITY_MS
        assertEquals(CapturePhase.FIRE, t.onFrame(STILL, now))
        t.fired(now)

        // Still frames stay LOCKED.
        now += 16
        assertEquals(CapturePhase.LOCKED, t.onFrame(STILL, now))

        // A high-diff frame (sticker removed/replaced) re-arms back to waiting (MOVING).
        now += 16
        assertEquals(CapturePhase.MOVING, t.onFrame(REARM, now))

        // The next sticker can now hold + fire. Use a time past the cooldown.
        now += Config.Capture.MIN_RECAPTURE_MS
        assertEquals(CapturePhase.HOLDING, t.onFrame(STILL, now)) // stillSince set
        now += Config.Capture.STABILITY_MS
        assertEquals(CapturePhase.FIRE, t.onFrame(STILL, now))
    }

    @Test
    fun `moving frame between stills restarts the stability timer`() {
        val t = CaptureTrigger()
        var now = 1000L

        assertEquals(CapturePhase.MOVING, t.onFrame(REARM, now)) // motion seen
        now += 16
        assertEquals(CapturePhase.HOLDING, t.onFrame(STILL, now)) // stillSince set

        // A mid-band moving frame (>= STILL, < REARM) clears stillSince -> MOVING.
        now += 16
        assertEquals(CapturePhase.MOVING, t.onFrame(MOVING, now))

        // The stability timer restarts: even though > STABILITY_MS has passed since the FIRST still
        // frame, the next still frame only re-seeds stillSince -> HOLDING, not FIRE.
        now += Config.Capture.STABILITY_MS + 100
        assertEquals(CapturePhase.HOLDING, t.onFrame(STILL, now))
    }

    @Test
    fun `reset clears motion and stillness`() {
        val t = CaptureTrigger()
        var now = 1000L

        // Build up motion + a partial hold.
        t.onFrame(REARM, now)
        now += 16
        assertEquals(CapturePhase.HOLDING, t.onFrame(STILL, now))

        t.reset()

        // After reset, no motion is remembered: a still frame returns WAITING (won't fire).
        now += 16
        assertEquals(CapturePhase.WAITING, t.onFrame(STILL, now))
        // Hold long after — still WAITING, because motion must be seen again first.
        now += Config.Capture.STABILITY_MS + 100
        assertEquals(CapturePhase.WAITING, t.onFrame(STILL, now))
    }

    @Test
    fun `heldMs reports the current still hold duration`() {
        val t = CaptureTrigger()
        var now = 1000L

        t.onFrame(REARM, now)
        assertEquals(0L, t.heldMs(now)) // not holding yet

        now += 16
        t.onFrame(STILL, now) // stillSince = now
        val holdStart = now
        now += 80
        assertEquals(80L, t.heldMs(now))
        assertEquals(now - holdStart, t.heldMs(now))
    }
}
