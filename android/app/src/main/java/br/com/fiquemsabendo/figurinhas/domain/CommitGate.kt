package br.com.fiquemsabendo.figurinhas.domain

// The commit cooldown gates only a burst's FIRST commit (rejecting a same-sticker re-arm between
// separate holds); co-present stickers in the SAME hold commit freely. Ports commitGate.ts.

data class CommitGateState(
    val lastCommitAt: Long,          // when the last capture committed (epoch ms)
    val committedThisBurst: Boolean, // has the current burst already committed? reset per burst
)

/** Decide whether a freshly-confirmed commit batch may post given the cooldown. */
fun allowCommit(state: CommitGateState, now: Long, minRecaptureMs: Long): Boolean {
    if (state.committedThisBurst) return true // co-present sticker in the same hold — never gated
    return now - state.lastCommitAt >= minRecaptureMs
}
