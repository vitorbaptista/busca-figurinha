package br.com.fiquemsabendo.figurinhas.domain

import kotlin.test.Test
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class CommitGateTest {
    private val min = 500L

    @Test fun allows_first_commit_after_cooldown() {
        assertTrue(allowCommit(CommitGateState(lastCommitAt = 0, committedThisBurst = false), 600, min))
    }
    @Test fun rejects_fresh_hold_too_soon() {
        assertFalse(allowCommit(CommitGateState(lastCommitAt = 1000, committedThisBurst = false), 1120, min))
    }
    @Test fun allows_co_present_in_same_burst() {
        assertTrue(allowCommit(CommitGateState(lastCommitAt = 1000, committedThisBurst = true), 1120, min))
    }
}
