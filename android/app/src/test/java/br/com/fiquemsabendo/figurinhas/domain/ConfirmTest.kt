package br.com.fiquemsabendo.figurinhas.domain

import kotlin.test.Test
import kotlin.test.assertEquals

class ConfirmTest {
    @Test fun commits_after_threshold_sightings() {
        val c = Confirmer(2)
        assertEquals(emptyList(), c.add(listOf("CIV12")))
        assertEquals(listOf("CIV12"), c.add(listOf("CIV12")))
    }
    @Test fun confirms_each_code_once() {
        val c = Confirmer(2)
        c.add(listOf("EGY4"))
        assertEquals(listOf("EGY4"), c.add(listOf("EGY4")))
        assertEquals(emptyList(), c.add(listOf("EGY4")))
    }
    @Test fun counts_once_per_frame() {
        val c = Confirmer(2)
        assertEquals(emptyList(), c.add(listOf("CIV12", "CIV12")))
        assertEquals(listOf("CIV12"), c.add(listOf("CIV12")))
    }
    @Test fun drops_one_off_slip() {
        val c = Confirmer(2)
        c.add(listOf("EGY4"))
        assertEquals(listOf("EGY4"), c.add(listOf("EGY4", "EGY6")))
    }
    @Test fun confirms_several_held_together() {
        val c = Confirmer(2)
        c.add(listOf("CIV12", "EGY4"))
        assertEquals(listOf("CIV12", "EGY4"), c.add(listOf("CIV12", "EGY4")).sorted())
    }
    @Test fun threshold_one_confirms_immediately() {
        val c = Confirmer(1)
        assertEquals(listOf("AUT4"), c.add(listOf("AUT4")))
    }
    @Test fun tracks_committed_count() {
        val c = Confirmer(2)
        assertEquals(0, c.committedCount())
        c.add(listOf("CIV12", "EGY4"))
        assertEquals(0, c.committedCount())
        c.add(listOf("CIV12")); assertEquals(1, c.committedCount())
        c.add(listOf("EGY4")); assertEquals(2, c.committedCount())
    }
    @Test fun reset_forgets_evidence() {
        val c = Confirmer(2)
        c.add(listOf("CIV12"))
        c.reset()
        assertEquals(emptyList(), c.add(listOf("CIV12")))
        assertEquals(listOf("CIV12"), c.add(listOf("CIV12")))
    }
}
