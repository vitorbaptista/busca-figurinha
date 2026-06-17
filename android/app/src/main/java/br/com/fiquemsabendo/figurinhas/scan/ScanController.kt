package br.com.fiquemsabendo.figurinhas.scan

import br.com.fiquemsabendo.figurinhas.Config
import br.com.fiquemsabendo.figurinhas.domain.Checklist
import br.com.fiquemsabendo.figurinhas.domain.CommitGateState
import br.com.fiquemsabendo.figurinhas.domain.Confirmer
import br.com.fiquemsabendo.figurinhas.domain.MatchResult
import br.com.fiquemsabendo.figurinhas.domain.Session
import br.com.fiquemsabendo.figurinhas.domain.allowCommit

// Pure, JVM-testable port of the scan-orchestration LOGIC from src/ui/screens/ScanScreen.tsx:
// (a) the per-frame COMMIT decision inside recognizeCanvas (confirmer + commit cooldown) and
// (b) handleMatches (dedupe per session, counters, session recording, build UI feedback).
//
// Everything here is the ViewModel-facing decision core: NO Android, NO Compose, NO camera, NO
// coroutines, NO audio/haptic/DOM. The flash/beep/haptic/timer side effects stay in the UI layer,
// which reads ScanFeedback and drives them. The conservative 0-FP semantics are kept EXACT.

/** The collection lookup the controller asks "do I already own this code?" (DataStore impl later). */
fun interface OwnedCodes {
    fun has(code: String): Boolean
}

/** One resolved sticker for the UI (mirrors ScanResultItem in MultiResult). `owned` true == REPETIDA. */
data class ScanItem(
    val code: String,
    val display: String,
    val teamName: String,
    val owned: Boolean,
)

/** What the UI renders for one handled batch: the rows, the per-batch new counts (added to the
 *  running counters), whether anything needed (drives the KEEP beep/haptic vs the REPEAT one), and
 *  isMiss = nothing resolved (the "tente de novo" empty-frame case). */
data class ScanFeedback(
    val items: List<ScanItem>,
    val newNeeded: Int,
    val newOwned: Int,
    val anyNeeded: Boolean,
    val isMiss: Boolean,
)

/** The outcome of one live frame's commit decision: the codes that may post this frame and the
 *  burst stop signal (mirrors recognizeCanvas's `toCommit` + `stopBurst`). */
data class CommitResult(
    val toCommit: List<MatchResult>,
    val stopBurst: Boolean,
)

class ScanController(
    private val checklist: Checklist,
    private val owned: OwnedCodes,
    private val session: Session,
    confirmations: Int = Config.Match.CONFIRMATIONS,
    private val minRecaptureMs: Long = Config.Capture.MIN_RECAPTURE_MS,
) {
    // Per-sticker agreement across the burst of frames; reset when a new sticker settles.
    private val confirmer = Confirmer(confirmations)
    // When the last live code committed — a guard so a "new" code sooner than minRecaptureMs
    // (faster than a person can swap stickers) is dropped as bogus.
    private var lastCommitAt: Long = 0
    // Whether the current burst (one sticker hold) has already committed a code. The commit cooldown
    // gates only a burst's FIRST commit, so co-present stickers that confirm a frame later in the
    // SAME hold aren't dropped as a same-sticker re-trigger. Reset on burst start.
    private var committedThisBurst: Boolean = false

    /** Mirrors ScanScreen onBurstStart: a fresh sticker hold starts — clear cross-frame agreement
     *  and arm the commit cooldown for this burst. */
    fun onBurstStart() {
        confirmer.reset()
        committedThisBurst = false
    }

    /** Whether the current burst has committed at least one code. The orchestrator reads this at
     *  burst end to decide whether to LOCK the capture trigger (a real read happened → wait for the
     *  sticker to leave) or RE-ARM it (read nothing → keep retrying the held sticker, and never show
     *  a false "lido ✓ — troque a figurinha"). */
    val burstCommitted: Boolean get() = committedThisBurst

    /**
     * Port of the recognizeCanvas confirm block (the `if (opts.confirm)` path). Given the frame's
     * resolved checklist matches and the current time, decide which may commit this frame and whether
     * the burst should stop.
     *
     *   - Feed every resolved code to the confirmer; only codes that crossed the threshold THIS frame
     *     ("newly") are candidates.
     *   - stopBurst = we've committed at least one code AND nothing new confirmed this frame (so the
     *     burst keeps going while co-present stickers are still confirming, then stops one frame after
     *     the last confirmation).
     *   - Commit cooldown: if there is anything to commit, apply allowCommit. A fresh hold committing
     *     sooner than minRecaptureMs after the last commit is almost certainly the SAME sticker
     *     re-triggering → drop it. A second code confirmed LATER IN THE SAME burst is genuinely
     *     co-present (committedThisBurst short-circuits the gate), so it posts.
     */
    fun commitFromFrame(
        resolved: List<MatchResult>,
        nowMs: Long,
        reads: List<String> = emptyList(),
    ): CommitResult {
        val frameMatches = mergeFrameMatches(resolved, burstReadEvidenceMatches(reads, checklist))
        val newly = confirmer.add(frameMatches.map { it.entry!!.code }).toHashSet()
        var toCommit = frameMatches.filter { it.entry!!.code in newly }
        val stopBurst = confirmer.committedCount() > 0 && newly.isEmpty()

        if (toCommit.isNotEmpty()) {
            val state = CommitGateState(lastCommitAt, committedThisBurst)
            if (allowCommit(state, nowMs, minRecaptureMs)) {
                lastCommitAt = nowMs
                committedThisBurst = true
            } else {
                toCommit = emptyList()
            }
        }
        return CommitResult(toCommit, stopBurst)
    }

    private fun mergeFrameMatches(
        resolved: List<MatchResult>,
        streamEvidence: List<MatchResult>,
    ): List<MatchResult> {
        if (streamEvidence.isEmpty()) return resolved
        val out = ArrayList<MatchResult>(resolved.size + streamEvidence.size)
        val seen = HashSet<String>()
        for (match in resolved) {
            val code = match.entry?.code ?: continue
            if (seen.add(code)) out.add(match)
        }
        for (match in streamEvidence) {
            val code = match.entry?.code ?: continue
            if (seen.add(code)) out.add(match)
        }
        return out
    }

    /**
     * Port of handleMatches. Resolve a batch to unique album entries, record/count each sticker only
     * ONCE per session (re-capturing the same back — a jiggle, a glare re-arm, or a second copy —
     * still re-flashes for feedback via `items` but doesn't double-count or re-record), and build the
     * ScanFeedback the UI renders.
     *
     * The Session is the read-only accumulator; the UI adds newNeeded/newOwned to its running counters.
     */
    fun handleMatches(matches: List<MatchResult>): ScanFeedback {
        // Codes already recorded in this session — re-handling one re-flashes but doesn't re-add.
        val alreadyInSession = session.records().mapNotNull { it.code }.toHashSet()
        val items = ArrayList<ScanItem>()
        val seen = HashSet<String>()
        var newNeeded = 0
        var newOwned = 0
        for (match in matches) {
            val entry = match.entry ?: continue
            if (!seen.add(entry.code)) continue
            val isOwned = owned.has(entry.code)
            items.add(ScanItem(entry.code, entry.display, entry.teamName, isOwned))
            if (entry.code !in alreadyInSession) {
                session.add(match, isOwned)
                if (isOwned) newOwned++ else newNeeded++
            }
        }

        if (items.isEmpty()) {
            // Nothing resolved → the "tente de novo" miss case. No counters, no session change.
            return ScanFeedback(emptyList(), 0, 0, anyNeeded = false, isMiss = true)
        }

        val anyNeeded = items.any { !it.owned }
        return ScanFeedback(items, newNeeded, newOwned, anyNeeded, isMiss = false)
    }
}
