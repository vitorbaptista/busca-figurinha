package br.com.fiquemsabendo.figurinhas.scan

import br.com.fiquemsabendo.figurinhas.Config
import br.com.fiquemsabendo.figurinhas.data.checklist
import br.com.fiquemsabendo.figurinhas.domain.MatchResult
import br.com.fiquemsabendo.figurinhas.domain.MatchStatus
import br.com.fiquemsabendo.figurinhas.domain.Session
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

// Pure-JVM tests for the scan-orchestration logic ported from ScanScreen.tsx. Real checklist, a
// fixed-clock Session, and a MutableSet-backed OwnedCodes. EXACT matches only (the live commit
// path only ever feeds resolved checklist entries).

class ScanControllerTest {
    // An EXACT resolved match for a known code (the shape recognizeFrameInOrder emits live).
    private fun exact(code: String): MatchResult =
        MatchResult(code, MatchStatus.EXACT, checklist.byCode[code]!!, 0)

    private fun controller(owned: MutableSet<String> = mutableSetOf()): Pair<ScanController, Session> {
        val session = Session(now = { 1_000L })
        val ctrl = ScanController(
            checklist = checklist,
            owned = OwnedCodes { it in owned },
            session = session,
        )
        return ctrl to session
    }

    // ---------- commitFromFrame: multi-frame confirmation ----------

    @Test fun commitFromFrame_commits_only_after_CONFIRMATIONS_frames() {
        // Sanity: the default threshold is 2.
        assertEquals(2, Config.Match.CONFIRMATIONS)
        val (ctrl, _) = controller()
        ctrl.onBurstStart()

        val frame1 = ctrl.commitFromFrame(listOf(exact("CIV12")), nowMs = 10_000L)
        assertTrue(frame1.toCommit.isEmpty(), "first frame must not commit (needs 2)")
        assertFalse(frame1.stopBurst, "nothing committed yet, so burst keeps going")

        val frame2 = ctrl.commitFromFrame(listOf(exact("CIV12")), nowMs = 10_010L)
        assertEquals(listOf("CIV12"), frame2.toCommit.map { it.entry!!.code })
        // stopBurst stops ONE frame AFTER the last confirmation: this frame just confirmed a NEW
        // code (newly non-empty), so the burst keeps going to catch any co-present sticker.
        assertFalse(frame2.stopBurst, "just confirmed a new code → keep bursting one more frame")

        // Frame 3: same code (already committed) → nothing new confirms → NOW stop the burst.
        val frame3 = ctrl.commitFromFrame(listOf(exact("CIV12")), nowMs = 10_020L)
        assertTrue(frame3.toCommit.isEmpty(), "already committed; nothing new to post")
        assertTrue(frame3.stopBurst, "committed and nothing new this frame → stop")
    }

    @Test fun commitFromFrame_commits_repeated_exact_raw_reads_across_burst_frames() {
        val (ctrl, _) = controller()
        ctrl.onBurstStart()

        val frame1 = ctrl.commitFromFrame(emptyList(), nowMs = 10_000L, reads = listOf("MEX 15 (62%)"))
        assertTrue(frame1.toCommit.isEmpty(), "one low-confidence exact read still needs agreement")

        val frame2 = ctrl.commitFromFrame(emptyList(), nowMs = 10_030L, reads = listOf("MEX15 (58%)"))
        assertEquals(listOf("MEX15"), frame2.toCommit.map { it.entry!!.code })
    }

    @Test fun commitFromFrame_ignores_single_exact_raw_read() {
        val (ctrl, _) = controller()
        ctrl.onBurstStart()

        ctrl.commitFromFrame(emptyList(), nowMs = 10_000L, reads = listOf("TUN10 (55%)"))
        val emptyFrame = ctrl.commitFromFrame(emptyList(), nowMs = 10_030L, reads = emptyList())

        assertTrue(emptyFrame.toCommit.isEmpty(), "raw evidence must repeat in another frame")
        assertFalse(ctrl.burstCommitted)
    }

    @Test fun commitFromFrame_does_not_commit_low_confidence_logo_reads() {
        val (ctrl, _) = controller()
        ctrl.onBurstStart()

        ctrl.commitFromFrame(emptyList(), nowMs = 10_000L, reads = listOf("00 (68%)"))
        val second = ctrl.commitFromFrame(emptyList(), nowMs = 10_030L, reads = listOf("00 (69%)"))

        assertTrue(second.toCommit.isEmpty(), "the recurring logo-like 00 read is not a sticker commit")
    }

    @Test fun commitFromFrame_raw_read_evidence_resets_each_burst() {
        val (ctrl, _) = controller()
        ctrl.onBurstStart()
        ctrl.commitFromFrame(emptyList(), nowMs = 10_000L, reads = listOf("IRQ20 (62%)"))

        ctrl.onBurstStart()
        val afterReset = ctrl.commitFromFrame(emptyList(), nowMs = 10_300L, reads = listOf("IRQ20 (62%)"))

        assertTrue(afterReset.toCommit.isEmpty(), "a new burst must not inherit raw-read evidence")
    }

    // ---------- commitFromFrame: commit cooldown across bursts ----------

    @Test fun commitFromFrame_cooldown_gates_a_fresh_burst_too_soon() {
        val (ctrl, _) = controller()
        // Burst A: commit CIV12 at t = 10_000.
        ctrl.onBurstStart()
        ctrl.commitFromFrame(listOf(exact("CIV12")), nowMs = 10_000L)
        val a = ctrl.commitFromFrame(listOf(exact("CIV12")), nowMs = 10_000L)
        assertEquals(listOf("CIV12"), a.toCommit.map { it.entry!!.code })

        // Burst B: a DIFFERENT code, confirmed sooner than MIN_RECAPTURE_MS after burst A's commit.
        ctrl.onBurstStart()
        val tooSoon = 10_000L + Config.Capture.MIN_RECAPTURE_MS - 1
        ctrl.commitFromFrame(listOf(exact("EGY4")), nowMs = tooSoon)
        val gated = ctrl.commitFromFrame(listOf(exact("EGY4")), nowMs = tooSoon)
        assertTrue(gated.toCommit.isEmpty(), "fresh burst within cooldown is dropped as a re-trigger")

        // Burst C: same different code, now past the cooldown → commits.
        ctrl.onBurstStart()
        val later = 10_000L + Config.Capture.MIN_RECAPTURE_MS
        ctrl.commitFromFrame(listOf(exact("EGY4")), nowMs = later)
        val ok = ctrl.commitFromFrame(listOf(exact("EGY4")), nowMs = later)
        assertEquals(listOf("EGY4"), ok.toCommit.map { it.entry!!.code })
    }

    // ---------- commitFromFrame: co-present in the SAME burst bypasses the cooldown ----------

    @Test fun commitFromFrame_co_present_in_same_burst_commits_despite_cooldown() {
        val (ctrl, _) = controller()
        ctrl.onBurstStart()
        // First code commits at t (two frames to cross the threshold).
        ctrl.commitFromFrame(listOf(exact("CIV12")), nowMs = 20_000L)
        val first = ctrl.commitFromFrame(listOf(exact("CIV12")), nowMs = 20_000L)
        assertEquals(listOf("CIV12"), first.toCommit.map { it.entry!!.code })

        // A second, co-present code confirms later in the SAME burst, sooner than MIN_RECAPTURE_MS.
        // Because committedThisBurst is set, the cooldown does NOT gate it.
        val soon = 20_000L + Config.Capture.MIN_RECAPTURE_MS - 1
        ctrl.commitFromFrame(listOf(exact("EGY4")), nowMs = soon)
        val second = ctrl.commitFromFrame(listOf(exact("EGY4")), nowMs = soon)
        assertEquals(listOf("EGY4"), second.toCommit.map { it.entry!!.code },
            "co-present sticker in the same hold is not gated by the cooldown")
    }

    // ---------- burstCommitted: drives lock-vs-re-arm at burst end ----------

    @Test fun burstCommitted_false_until_a_code_commits_then_resets_each_burst() {
        val (ctrl, _) = controller()
        ctrl.onBurstStart()
        assertFalse(ctrl.burstCommitted, "a fresh burst has committed nothing")

        // One frame is below CONFIRMATIONS → nothing commits yet.
        ctrl.commitFromFrame(listOf(exact("CIV12")), nowMs = 10_000L)
        assertFalse(ctrl.burstCommitted, "one frame is below CONFIRMATIONS → no commit yet")

        // Second frame crosses the threshold → a code commits → burstCommitted flips true (→ LOCK).
        val frame2 = ctrl.commitFromFrame(listOf(exact("CIV12")), nowMs = 10_010L)
        assertEquals(listOf("CIV12"), frame2.toCommit.map { it.entry!!.code })
        assertTrue(ctrl.burstCommitted, "after a real commit the burst is marked committed")

        // A fresh burst clears it again (so an empty next burst RE-ARMs instead of locking).
        ctrl.onBurstStart()
        assertFalse(ctrl.burstCommitted, "onBurstStart resets the committed flag")
    }

    @Test fun burstCommitted_stays_false_for_a_burst_that_resolves_nothing() {
        val (ctrl, _) = controller()
        ctrl.onBurstStart()
        // Frames that resolve no code (empty list each) → nothing ever commits.
        repeat(Config.Capture.BURST_FRAMES) { i ->
            ctrl.commitFromFrame(emptyList(), nowMs = 30_000L + i * 10)
        }
        assertFalse(
            ctrl.burstCommitted,
            "a burst that resolved nothing reports not-committed → the orchestrator RE-ARMs, " +
                "never falsely showing 'lido ✓ — troque a figurinha'",
        )
    }

    // ---------- handleMatches: feedback + session recording ----------

    @Test fun handleMatches_needed_code_records_and_counts() {
        val (ctrl, session) = controller() // nothing owned
        val fb = ctrl.handleMatches(listOf(exact("CIV12")))

        assertEquals(1, fb.items.size)
        assertEquals("CIV12", fb.items[0].code)
        assertFalse(fb.items[0].owned)
        assertEquals(1, fb.newNeeded)
        assertEquals(0, fb.newOwned)
        assertTrue(fb.anyNeeded)
        assertFalse(fb.isMiss)
        assertEquals(1, session.records().size)
    }

    @Test fun handleMatches_owned_code_counts_as_repeat() {
        val (ctrl, session) = controller(owned = mutableSetOf("CIV12"))
        val fb = ctrl.handleMatches(listOf(exact("CIV12")))

        assertEquals(1, fb.items.size)
        assertTrue(fb.items[0].owned)
        assertEquals(0, fb.newNeeded)
        assertEquals(1, fb.newOwned)
        assertFalse(fb.anyNeeded)
        assertFalse(fb.isMiss)
        assertEquals(1, session.records().size)
    }

    @Test fun handleMatches_empty_batch_is_a_miss() {
        val (ctrl, session) = controller()
        val fb = ctrl.handleMatches(emptyList())

        assertTrue(fb.items.isEmpty())
        assertEquals(0, fb.newNeeded)
        assertEquals(0, fb.newOwned)
        assertFalse(fb.anyNeeded)
        assertTrue(fb.isMiss)
        assertTrue(session.records().isEmpty())
    }

    @Test fun handleMatches_dedupes_same_code_across_session() {
        val (ctrl, session) = controller()
        val first = ctrl.handleMatches(listOf(exact("CIV12")))
        assertEquals(1, first.newNeeded)
        assertEquals(1, session.records().size)

        // Re-capturing the same back: still in items (re-flash) but NOT re-counted or re-recorded.
        val again = ctrl.handleMatches(listOf(exact("CIV12")))
        assertEquals(1, again.items.size, "still surfaced for feedback")
        assertEquals(0, again.newNeeded, "not double-counted")
        assertEquals(0, again.newOwned)
        assertFalse(again.isMiss)
        assertEquals(1, session.records().size, "session not double-recorded")
    }
}
