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
    @Test fun match_rejects_unsafe_same_length_substitution() {
        val r = matchCode("C1V12", list)
        assertEquals(MatchStatus.UNKNOWN, r.status); assertNull(r.entry); assertEquals(-1, r.distance)
    }
    @Test fun match_rejects_unsafe_letter_for_digit() {
        val r = matchCode("EGYA", list) // 'A' read instead of '4'
        assertEquals(MatchStatus.UNKNOWN, r.status); assertNull(r.entry); assertEquals(-1, r.distance)
    }
    @Test fun match_unknown_when_far() {
        val r = matchCode("ZZZ99", list)
        assertEquals(MatchStatus.UNKNOWN, r.status); assertNull(r.entry); assertEquals(-1, r.distance); assertEquals("ZZZ99", r.raw)
    }
    @Test fun match_respects_maxDistance() {
        val safe = makeChecklist(listOf("OO12"))
        assertEquals(MatchStatus.UNKNOWN, matchCode("0O12", safe, 0).status)
        val r = matchCode("0O12", safe, 1)
        assertEquals(MatchStatus.CORRECTED, r.status); assertEquals("OO12", r.entry?.code); assertEquals(1, r.distance)
    }
    @Test fun match_does_not_use_unsafe_equal_length_tie() {
        val tie = makeChecklist(listOf("FWC1", "FWC11"))
        assertEquals(MatchStatus.UNKNOWN, matchCode("FWC12", tie, 1).status)
    }
    @Test fun match_unique_or_reject() {
        assertEquals(MatchStatus.UNKNOWN, matchCode("GIV12", checklist).status)
        assertEquals(MatchStatus.UNKNOWN, matchCode("EGYA", checklist).status)
        assertEquals(MatchStatus.UNKNOWN, matchCode("SE3", checklist).status)
    }
    @Test fun match_rejects_known_false_positive_patterns() {
        val unsafeCorrections = makeChecklist(listOf("HAI2", "RSA6", "EGY5"))
        assertEquals(MatchStatus.UNKNOWN, matchCode("WAI2", unsafeCorrections).status)
        assertEquals(MatchStatus.UNKNOWN, matchCode("RSA8", unsafeCorrections).status)
        assertEquals(MatchStatus.UNKNOWN, matchCode("EGY8", unsafeCorrections).status)
    }
    @Test fun match_restores_thin_letter_only_when_unambiguous() {
        assertEquals("CIV12", matchCode("CV12", checklist).entry?.code)
        assertEquals("CIV4", matchCode("CV4", checklist).entry?.code)
        assertEquals("BIH12", matchCode("BH12", checklist).entry?.code)
        assertEquals(MatchStatus.UNKNOWN, matchCode("C1V12", checklist).status)
        assertEquals(MatchStatus.UNKNOWN, matchCode("C1V4", checklist).status)
        val onlyBold = makeChecklist(listOf("CPV12"))
        assertEquals(MatchStatus.UNKNOWN, matchCode("CV12", onlyBold).status)
    }
    @Test fun match_rejects_edge_thin_letter_restoration() {
        assertEquals(MatchStatus.UNKNOWN, matchCode("RN10", checklist).status)
        assertEquals(MatchStatus.UNKNOWN, matchCode("AU4", checklist).status)
    }
    @Test fun match_real_checklist() {
        assertEquals(MatchStatus.EXACT, matchCode("CIV12", checklist).status)
        assertEquals(MatchStatus.EXACT, matchCode("00", checklist).status)
        assertEquals(MatchStatus.UNKNOWN, matchCode("GIV12", checklist).status)
        assertEquals(MatchStatus.UNKNOWN, matchCode("C1V12", checklist).status)
    }

    // ---- bestMatchFromText ----
    @Test fun best_null_when_no_codes() { assertNull(bestMatchFromText("no codes here", checklist)) }
    @Test fun best_prefers_exact() {
        val r = bestMatchFromText("garbage CIV12 EGY4", checklist)
        assertEquals(MatchStatus.EXACT, r?.status); assertEquals("CIV12", r?.entry?.code)
    }
    @Test fun best_falls_back_to_conservative_thin_correction() {
        val l = makeChecklist(listOf("CIV12"))
        val r = bestMatchFromText("noise CV12 more", l)
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
    @Test fun high_confidence_confusion_recovers_only_known_letter_confusions_with_exact_digits() {
        val r = bestHighConfidenceConfusionMatchFromText("NJT 4", checklist)
        assertEquals("AUT4", r?.entry?.code)
        assertEquals(2, r?.distance)
        assertNull(bestMatchFromText("NJT 4", checklist)?.entry)
    }
    @Test fun high_confidence_confusion_recovers_verified_merged_m_shape() {
        val nShape = bestHighConfidenceConfusionMatchFromText("NEX 15", checklist)
        assertEquals("MEX15", nShape?.entry?.code)
        assertEquals(1, nShape?.distance)
        val iShape = bestHighConfidenceConfusionMatchFromText("IEX 15", checklist)
        assertEquals("MEX15", iShape?.entry?.code)
        assertEquals(1, iShape?.distance)
        assertNull(bestHighConfidenceConfusionMatchFromText("NEX 16", makeChecklist(listOf("MEX15"))))
    }
    @Test fun high_confidence_confusion_recovers_verified_irq20_shape() {
        val r = bestHighConfidenceConfusionMatchFromText("IWJ 20", checklist)
        assertEquals("IRQ20", r?.entry?.code)
        assertEquals(2, r?.distance)
    }
    @Test fun high_confidence_confusion_recovers_verified_tun10_shape() {
        val r = bestHighConfidenceConfusionMatchFromText("TIN 10", checklist)
        assertEquals("TUN10", r?.entry?.code)
        assertEquals(1, r?.distance)
        val uShape = bestHighConfidenceConfusionMatchFromText("UIN 10", checklist)
        assertEquals("TUN10", uShape?.entry?.code)
        assertEquals(2, uShape?.distance)
    }
    @Test fun high_confidence_confusion_recovers_verified_egy4_shape() {
        val r = bestHighConfidenceConfusionMatchFromText("ECY 4", checklist)
        assertEquals("EGY4", r?.entry?.code)
        assertEquals(1, r?.distance)
        val fShape = bestHighConfidenceConfusionMatchFromText("FGY 4", checklist)
        assertEquals("EGY4", fShape?.entry?.code)
        assertEquals(1, fShape?.distance)
    }
    @Test fun high_confidence_confusion_recovers_verified_aut_shapes() {
        val mShape = bestHighConfidenceConfusionMatchFromText("MIT 4", checklist)
        assertEquals("AUT4", mShape?.entry?.code)
        assertEquals(2, mShape?.distance)
        val wShape = bestHighConfidenceConfusionMatchFromText("WJT 4", checklist)
        assertEquals("AUT4", wShape?.entry?.code)
        assertEquals(2, wShape?.distance)
    }
    @Test fun high_confidence_exact_alias_recovers_verified_cuw4_shapes() {
        assertEquals("CUW4", bestHighConfidenceExactAliasMatchFromText("DXW 4", checklist)?.entry?.code)
        assertEquals("CUW4", bestHighConfidenceExactAliasMatchFromText("DAV 4", checklist)?.entry?.code)
        assertNull(bestHighConfidenceExactAliasMatchFromText("DXW 5", checklist))
    }
    @Test fun high_confidence_confusion_recovers_verified_pixel_shapes() {
        val verifiedPixelShapes = linkedMapOf(
            "DUA 19" to "GHA19",
            "ER 4" to "GER4",
            "HSA 17" to "RSA17",
            "RSM 17" to "RSA17",
            "RGA 17" to "RSA17",
            "NEN 20" to "NOR20",
            "EN 20" to "NOR20",
            "MN 20" to "NOR20",
            "CWV 12" to "CIV12",
            "OV 4" to "CIV4",
            "SXV 4" to "CIV4",
            "CNV 4" to "CIV4",
            "NB 18" to "NZL18",
            "NO 2" to "AUS2",
            "WAI 2" to "AUS2",
            "WIU 8" to "AUT8",
            "NGA 6" to "RSA6",
            "NEA 6" to "RSA6",
            "FGA 19" to "RSA19",
            "GIE 8" to "SWE8",
            "SWT 8" to "SWE8",
            "EX 14" to "SUI14",
            "WX 14" to "SUI14",
            "UJMJ 10" to "TUN10",
            "IL 10" to "TUN10",
            "EG 1" to "ALG1",
            "MB 1" to "ALG1",
            "3AT 17" to "QAT17",
            "OAT 17" to "QAT17",
            "SOT 17" to "QAT17",
            "TOT 17" to "QAT17",
            "COT 17" to "QAT17",
            "SBT 17" to "QAT17",
            "SWJ 10" to "IRN10",
            "OWJ 10" to "IRN10",
            "MN 10" to "IRN10",
            "GN 10" to "IRN10",
            "ON 15" to "IRN15",
            "SVU 15" to "IRN15",
            "MN 15" to "IRN15",
            "DH 12" to "BIH12",
            "RH 12" to "BIH12",
            "SOU 12" to "BIH12",
            "OJW 4" to "CUW4",
            "DAY 4" to "CUW4",
            "OAV 4" to "CUW4",
            "DXW 4" to "CUW4",
            "DAV 4" to "CUW4",
            "BN 10" to "POR10",
            "TXN 10" to "POR10",
            "IWJ 20" to "IRQ20",
            "SE 20" to "IRQ20",
            "SXJ 20" to "IRQ20",
            "WO 20" to "IRQ20",
        )
        for ((read, expected) in verifiedPixelShapes) {
            assertEquals(expected, bestHighConfidenceConfusionMatchFromText(read, checklist)?.entry?.code, read)
        }
    }
    @Test fun high_confidence_confusion_rejects_digit_changes_and_unknown_letter_pairs() {
        val onlyAut4 = makeChecklist(listOf("AUT4"))
        assertNull(bestHighConfidenceConfusionMatchFromText("NJT 5", onlyAut4))
        assertNull(bestHighConfidenceConfusionMatchFromText("NRT 4", checklist))
        assertNull(bestHighConfidenceConfusionMatchFromText("RGA 8", checklist))
        assertNull(bestHighConfidenceConfusionMatchFromText("SXJ 18", makeChecklist(listOf("IRQ18"))))
        assertNull(bestHighConfidenceConfusionMatchFromText("SWJ 10", makeChecklist(listOf("IRQ10"))))
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
