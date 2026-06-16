package br.com.fiquemsabendo.figurinhas.domain

import br.com.fiquemsabendo.figurinhas.data.checklist
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNull
import kotlin.test.assertTrue

class SessionTest {
    private fun entry(code: String) = checklist.byCode[code] ?: error("test setup: unknown $code")
    private fun exact(code: String) = MatchResult(code, MatchStatus.EXACT, entry(code), 0)
    private fun unknown(raw: String) = MatchResult(raw, MatchStatus.UNKNOWN, null, -1)

    @Test fun outcome_unknown_without_entry() {
        assertEquals(ScanOutcome.UNKNOWN, outcomeFor(unknown("ZZZ99"), false))
        assertEquals(ScanOutcome.UNKNOWN, outcomeFor(unknown("ZZZ99"), true))
    }
    @Test fun outcome_owned_and_needed() {
        assertEquals(ScanOutcome.OWNED, outcomeFor(exact("CIV12"), true))
        assertEquals(ScanOutcome.NEEDED, outcomeFor(exact("CIV12"), false))
    }

    @Test fun starts_empty() {
        val s = Session()
        assertTrue(s.isEmpty()); assertEquals(emptyList(), s.records())
    }
    @Test fun records_each_add() {
        val s = Session(now = { 42L })
        val rec = s.add(exact("CIV12"), false)
        assertEquals("CIV12", rec.raw); assertEquals("CIV12", rec.code)
        assertEquals(ScanOutcome.NEEDED, rec.outcome); assertEquals(42L, rec.ts)
        assertFalse(s.isEmpty()); assertEquals(1, s.records().size)
    }
    @Test fun stores_null_code_for_unknown() {
        val rec = Session().add(unknown("ZZZ99"), false)
        assertNull(rec.code); assertEquals(ScanOutcome.UNKNOWN, rec.outcome)
    }
    @Test fun records_returns_copy() {
        val s = Session()
        s.add(exact("CIV12"), false)
        val copy = s.records().toMutableList()
        copy.add(copy[0])
        assertEquals(1, s.records().size)
    }
    @Test fun clear_empties() {
        val s = Session(); s.add(exact("CIV12"), false); s.clear()
        assertTrue(s.isEmpty())
    }
    @Test fun seeds_from_initial() {
        val s = Session(initial = listOf(ScanRecord("CIV12", "CIV12", ScanOutcome.NEEDED, 1)))
        assertEquals(1, s.records().size)
    }
    @Test fun toJSON_mirrors_records() {
        val s = Session(); s.add(exact("CIV12"), false)
        assertEquals(s.records(), s.toJSON())
    }

    @Test fun report_dedupes_keepers_and_repeats() {
        val s = Session()
        s.add(exact("CIV12"), false); s.add(exact("CIV12"), false)
        s.add(exact("EGY4"), true); s.add(exact("EGY4"), true)
        val r = s.report(checklist)
        assertEquals(4, r.scannedCount)
        assertEquals(listOf("CIV12"), r.keepers.map { it.code })
        assertEquals(listOf("EGY4"), r.repeats.map { it.code })
    }
    @Test fun report_dedupes_unknowns() {
        val s = Session()
        s.add(unknown("ZZZ99"), false); s.add(unknown("ZZZ99"), false); s.add(unknown("WWW88"), false)
        assertEquals(listOf("ZZZ99", "WWW88"), s.report(checklist).unknowns)
    }
    @Test fun report_sorts_by_pt_team_then_number() {
        val s = Session()
        s.add(exact("BRA1"), false); s.add(exact("CIV1"), false)
        s.add(exact("ARG2"), false); s.add(exact("ARG1"), false)
        assertEquals(listOf("ARG1", "ARG2", "BRA1", "CIV1"), s.report(checklist).keepers.map { it.code })
    }
    @Test fun report_routes_buckets() {
        val s = Session()
        s.add(exact("CIV12"), false); s.add(exact("EGY4"), true); s.add(unknown("ZZZ99"), false)
        val r = s.report(checklist)
        assertEquals(listOf("CIV12"), r.keepers.map { it.code })
        assertEquals(listOf("EGY4"), r.repeats.map { it.code })
        assertEquals(listOf("ZZZ99"), r.unknowns)
    }
}
