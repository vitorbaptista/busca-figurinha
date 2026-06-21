// The live burst can commit SEVERAL co-present stickers across the frames of ONE hold:
// the confirmer reaches its threshold for each sticker on whatever frame it settles, so
// stickers that share a hold often commit a frame or two apart. The commit cooldown
// (CONFIG.capture.minRecaptureMs) paces consecutive scans: it rejects a SEPARATE hold that
// re-triggers the SAME physical sticker sooner than that interval — NOT to suppress additional
// stickers seen together in the same burst. So the cooldown gates only the FIRST commit of a
// burst; once a burst has committed, the codes it confirms afterwards are genuinely
// co-present and commit without the gate. The 2-frame confirmer (CONFIG.match.confirmations)
// stays the within-burst guard against a transient misread.

export interface CommitGateState {
  /** When the last capture committed (epoch ms), carried across bursts. */
  lastCommitAt: number;
  /** Whether the CURRENT burst has already committed at least one code. Reset on burst start. */
  committedThisBurst: boolean;
}

/** Decide whether a freshly-confirmed commit batch may post given the cooldown. */
export function allowCommit(state: CommitGateState, now: number, minRecaptureMs: number): boolean {
  if (state.committedThisBurst) return true; // co-present sticker in the same hold — never gated
  return now - state.lastCommitAt >= minRecaptureMs;
}
