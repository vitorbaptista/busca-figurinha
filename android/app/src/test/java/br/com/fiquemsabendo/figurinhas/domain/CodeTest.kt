package br.com.fiquemsabendo.figurinhas.domain

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull

class CodeTest {
    @Test fun normalize_uppercases_and_strips() {
        assertEquals("CIV12", normalizeCode("civ 12"))
        assertEquals("C1V12", normalizeCode("c1v-12"))
        assertEquals("FWC1", normalizeCode("  fwc_1  "))
        assertEquals("00", normalizeCode("00"))
    }

    @Test fun normalize_empty_for_junk() {
        assertEquals("", normalizeCode("--- ."))
    }

    @Test fun toDisplay_inserts_space() {
        assertEquals("CIV 12", toDisplay("CIV12"))
        assertEquals("FWC 1", toDisplay("FWC1"))
    }

    @Test fun toDisplay_leaves_pure_and_irregular() {
        assertEquals("00", toDisplay("00"))
        assertEquals("FWC", toDisplay("FWC"))
        assertEquals("C1V12", toDisplay("C1V12"))
    }

    @Test fun parse_splits_prefix_and_number() {
        assertEquals(ParsedCode("CIV", 12, "CIV12"), parseCode("CIV12"))
        assertEquals(ParsedCode("CIV", 12, "CIV12"), parseCode("civ 12"))
        assertEquals(ParsedCode("FWC", 1, "FWC1"), parseCode("FWC1"))
    }

    @Test fun parse_pure_number_logo() {
        assertEquals(ParsedCode("", 0, "00"), parseCode("00"))
    }

    @Test fun parse_null_without_trailing_digits() {
        assertNull(parseCode("CIV"))
        assertNull(parseCode(""))
        assertNull(parseCode("AB12C"))
    }

    @Test fun levenshtein_basics() {
        assertEquals(0, levenshtein("CIV12", "CIV12"))
        assertEquals(1, levenshtein("C1V12", "CIV12"))   // substitution
        assertEquals(1, levenshtein("CIV2", "CIV12"))    // insertion
        assertEquals(1, levenshtein("CIV123", "CIV12"))  // deletion
        assertEquals(0, levenshtein("", ""))
        assertEquals(3, levenshtein("", "ABC"))
        assertEquals(3, levenshtein("ABC", ""))
        assertEquals(levenshtein("EGY4", "EGYA"), levenshtein("EGYA", "EGY4"))
        assertEquals(5, levenshtein("ZZZ99", "CIV12"))
    }
}
