package br.com.fiquemsabendo.figurinhas.domain

import br.com.fiquemsabendo.figurinhas.data.checklist
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull
import kotlin.test.assertTrue

class MatchingTest {
    /** Tiny synthetic checklist from canonical codes for focused tests. */
    private fun makeChecklist(codes: List<String>): Checklist {
        val re = Regex("^([A-Z]*)(\\d+)$")
        val entries = codes.map { code ->
            val m = re.matchEntire(code)!!
            ChecklistEntry(
                code = code,
                display = if (m.groupValues[1].isNotEmpty()) "${m.groupValues[1]} ${m.groupValues[2]}" else code,
                teamCode = m.groupValues[1].ifEmpty { "FWC" },
                teamName = m.groupValues[1].ifEmpty { "Especiais" },
                number = m.groupValues[2].toInt(),
                type = StickerType.PLAYER,
            )
        }
        return Checklist(entries, entries.associateBy { it.code }, emptyList(), entries.size)
    }

    // ---- extractCodes ----
    @Test fun extract_pulls_code_from_noisy_text() {
        assertTrue("CIV12" in extractCodes("FIFA WORLD CUP 2026 CIV 12"))
    }
    @Test fun extract_no_space() { assertTrue("EGY4" in extractCodes("panini EGY4 ©2026")) }
    @Test fun extract_case_insensitive() { assertEquals(listOf("CIV12"), extractCodes("civ 12")) }
    @Test fun extract_dedupes_first_seen() {
        assertEquals(listOf("CIV12", "EGY4"), extractCodes("CIV 12 noise CIV12 more EGY4"))
    }
    @Test fun extract_logo_but_not_stray_zero() {
        assertTrue("00" in extractCodes("panini 00 logo"))
        assertEquals(emptyList(), extractCodes("only a 0 here"))
    }
    @Test fun extract_no_decoy_from_adjacent_words() {
        assertTrue("CUP202" !in extractCodes("FIFA WORLD CUP 2026"))
        assertTrue("NINI00" !in extractCodes("panini 00 logo"))
    }
    @Test fun extract_empty_when_none() { assertEquals(emptyList(), extractCodes("just some words")) }
    @Test fun extract_multiline_noise_allowed() {
        val codes = extractCodes("FIFA WORLD CUP 2026\nCIV 12\nMade in Italy\nFWC 1")
        assertTrue("CIV12" in codes); assertTrue("FWC1" in codes)
    }
    @Test fun extract_clean_no_decoys() {
        assertEquals(listOf("CIV12", "FWC1"), extractCodes("back of sticker\nCIV 12\nFWC 1"))
    }

    // ---- matchCode ----
    private val list = makeChecklist(listOf("CIV12", "EGY4", "FWC1", "00"))

    @Test fun match_exact() {
        val r = matchCode("CIV12", list)
        assertEquals(MatchStatus.EXACT, r.status); assertEquals(0, r.distance)
        assertEquals("CIV12", r.entry?.code); assertEquals("CIV12", r.raw)
    }
    @Test fun match_one_edit() {
        val r = matchCode("C1V12", list)
        assertEquals(MatchStatus.CORRECTED, r.status); assertEquals(1, r.distance)
        assertEquals("CIV12", r.entry?.code)
    }
    @Test fun match_letter_for_digit() {
        val r = matchCode("EGYA", list) // 'A' read instead of '4'
        assertEquals(MatchStatus.CORRECTED, r.status); assertEquals("EGY4", r.entry?.code); assertEquals(1, r.distance)
    }
    @Test fun match_unknown_when_far() {
        val r = matchCode("ZZZ99", list)
        assertEquals(MatchStatus.UNKNOWN, r.status); assertNull(r.entry); assertEquals(-1, r.distance); assertEquals("ZZZ99", r.raw)
    }
    @Test fun match_respects_maxDistance() {
        assertEquals(MatchStatus.UNKNOWN, matchCode("CXX12", list, 1).status)
        assertEquals(MatchStatus.CORRECTED, matchCode("CXX12", list, 2).status)
    }
    @Test fun match_prefers_equal_length_on_tie() {
        val tie = makeChecklist(listOf("FWC1", "FWC11"))
        assertEquals("FWC11", matchCode("FWC12", tie, 1).entry?.code)
    }
    @Test fun match_unique_or_reject() {
        assertEquals("CIV12", matchCode("GIV12", checklist).entry?.code)
        assertEquals(MatchStatus.UNKNOWN, matchCode("EGYA", checklist).status)
        assertEquals(MatchStatus.UNKNOWN, matchCode("SE3", checklist).status)
    }
    @Test fun match_restores_thin_letter_only_when_unambiguous() {
        assertEquals("CIV12", matchCode("CV12", checklist).entry?.code)
        assertEquals(MatchStatus.UNKNOWN, matchCode("C1V12", checklist).status)
        val onlyBold = makeChecklist(listOf("CPV12"))
        assertEquals(MatchStatus.UNKNOWN, matchCode("CV12", onlyBold).status)
    }
    @Test fun match_real_checklist() {
        assertEquals(MatchStatus.EXACT, matchCode("CIV12", checklist).status)
        assertEquals(MatchStatus.EXACT, matchCode("00", checklist).status)
        assertEquals("CIV12", matchCode("GIV12", checklist).entry?.code)
        assertEquals(MatchStatus.UNKNOWN, matchCode("C1V12", checklist).status)
    }

    // ---- bestMatchFromText ----
    @Test fun best_null_when_no_codes() { assertNull(bestMatchFromText("no codes here", checklist)) }
    @Test fun best_prefers_exact() {
        val r = bestMatchFromText("garbage CIV12 EGY4", checklist)
        assertEquals(MatchStatus.EXACT, r?.status); assertEquals("CIV12", r?.entry?.code)
    }
    @Test fun best_falls_back_to_correction() {
        val l = makeChecklist(listOf("CIV12"))
        val r = bestMatchFromText("noise CIW12 more", l)
        assertEquals(MatchStatus.CORRECTED, r?.status); assertEquals("CIV12", r?.entry?.code)
    }
    @Test fun best_unknown_first_token() {
        val l = makeChecklist(listOf("CIV12"))
        val r = bestMatchFromText("ZZZ99 then WWW88", l)
        assertEquals(MatchStatus.UNKNOWN, r?.status); assertEquals("ZZZ99", r?.raw)
    }
    @Test fun best_reads_multiline_back() {
        val r = bestMatchFromText("FIFA WORLD CUP 2026\nCIV 12\n© Panini", checklist)
        assertEquals("CIV12", r?.entry?.code)
    }

    // ---- matchAllFromText ----
    @Test fun all_resolves_each_distinct() {
        val results = matchAllFromText("FIFA WORLD CUP 2026 CIV 12\nEGY 4\nBRA 5\nFWC 1", checklist)
        assertEquals(listOf("CIV12", "EGY4", "BRA5", "FWC1"), results.map { it.entry?.code })
        assertTrue(results.all { it.entry != null })
    }
    @Test fun all_dedupes_and_drops_noise() {
        assertEquals(listOf("CIV12", "EGY4"), matchAllFromText("CIV12 CIV 12 ZZZ99 EGY4", checklist).map { it.entry?.code })
    }
    @Test fun all_empty_when_none() { assertEquals(emptyList(), matchAllFromText("just some words", checklist)) }

    // ---- matchLines ----
    @Test fun lines_one_per_line() {
        assertEquals(listOf("CIV12", "EGY4", "BRA5"), matchLines("CIV 12\nEGY 4\nBRA 5", checklist).map { it.entry?.code })
    }
    @Test fun lines_skips_long_legal_text() {
        val text = "CIV 12\nESTE CROMO E PARTE NID 9 INTEGRANTE DO ALBUM OFICIAL"
        assertEquals(listOf("CIV12"), matchLines(text, checklist).map { it.entry?.code })
    }
    @Test fun lines_dedupes_and_ignores_blank_unknown() {
        assertEquals(listOf("EGY4"), matchLines("EGY 4\n\nEGY 4\nZZZ 99", checklist).map { it.entry?.code })
    }
    @Test fun lines_tolerates_noise_on_short_line() {
        assertEquals(listOf("EGY4"), matchLines("EGY 4 7", checklist).map { it.entry?.code })
    }
}
