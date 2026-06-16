package br.com.fiquemsabendo.figurinhas.data

import br.com.fiquemsabendo.figurinhas.domain.ScanOutcome
import br.com.fiquemsabendo.figurinhas.domain.ScanRecord
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

// Pure-JVM tests for the session serialization (no DataStore). Round-trip must preserve a list of
// ScanRecord including a null code and each ScanOutcome (serialized by enum name), and corrupt JSON
// must yield an empty list (start fresh) rather than crash — mirroring app.tsx loadSession.

class SessionStoreTest {
    @Test fun roundTrip_preserves_records_with_null_code_and_each_outcome() {
        val records = listOf(
            ScanRecord(raw = "CIV 12", code = "CIV12", outcome = ScanOutcome.NEEDED, ts = 1_000L),
            ScanRecord(raw = "BRA 1", code = "BRA1", outcome = ScanOutcome.OWNED, ts = 2_000L),
            ScanRecord(raw = "???", code = null, outcome = ScanOutcome.UNKNOWN, ts = 3_000L),
        )

        val decoded = decodeSession(encodeSession(records))
        assertEquals(records, decoded)
        // The null code survived intact.
        assertEquals(null, decoded[2].code)
        // Every outcome enum round-tripped.
        assertEquals(setOf(ScanOutcome.NEEDED, ScanOutcome.OWNED, ScanOutcome.UNKNOWN), decoded.map { it.outcome }.toSet())
    }

    @Test fun roundTrip_empty_list() {
        assertEquals(emptyList(), decodeSession(encodeSession(emptyList())))
    }

    @Test fun outcome_is_serialized_by_name() {
        val json = encodeSession(listOf(ScanRecord("x", "X1", ScanOutcome.NEEDED, 5L)))
        assertTrue(json.contains("NEEDED"), "outcome should serialize as its enum name, got: $json")
    }

    @Test fun corrupt_json_returns_empty_list() {
        assertEquals(emptyList(), decodeSession("{ this is not valid json"))
        assertEquals(emptyList(), decodeSession(""))
        // Right JSON shape (object, not the expected array) is still tolerated → empty.
        assertEquals(emptyList(), decodeSession("""{"raw":"x"}"""))
    }

    @Test fun unknown_outcome_name_degrades_to_unknown() {
        // A record whose outcome name isn't a known enum must not abort the whole load.
        val json = """[{"raw":"x","code":"X1","outcome":"BOGUS","ts":7}]"""
        val decoded = decodeSession(json)
        assertEquals(1, decoded.size)
        assertEquals(ScanOutcome.UNKNOWN, decoded[0].outcome)
        assertEquals("X1", decoded[0].code)
    }
}
