package br.com.fiquemsabendo.figurinhas.data

import br.com.fiquemsabendo.figurinhas.domain.ScanOutcome
import br.com.fiquemsabendo.figurinhas.domain.ScanRecord
import kotlinx.serialization.Serializable
import kotlinx.serialization.builtins.ListSerializer
import kotlinx.serialization.json.Json

// Pure session (in-progress scan) serialization — ports src/app.tsx persistSession/loadSession,
// which store the session as JSON of ScanRecord[]. NO Android, so it unit-tests on the plain JVM.
// The DataStore wiring that calls these lives in SessionRepository.

// A serializable mirror of domain.ScanRecord (which is intentionally Android/serialization-free).
// ScanOutcome is an enum serialized BY NAME so the JSON stays stable and human-readable.
@Serializable
private data class ScanRecordDto(
    val raw: String,
    val code: String?,
    val outcome: String,
    val ts: Long,
)

private fun ScanRecord.toDto(): ScanRecordDto =
    ScanRecordDto(raw = raw, code = code, outcome = outcome.name, ts = ts)

private fun ScanRecordDto.toRecord(): ScanRecord =
    ScanRecord(
        raw = raw,
        code = code,
        // Unknown/garbled outcome names degrade to UNKNOWN rather than crash the whole load.
        outcome = runCatching { ScanOutcome.valueOf(outcome) }.getOrDefault(ScanOutcome.UNKNOWN),
        ts = ts,
    )

private val json = Json {
    ignoreUnknownKeys = true
    encodeDefaults = true
}

private val listSerializer = ListSerializer(ScanRecordDto.serializer())

/** Serialize the in-progress session (a list of ScanRecord) to JSON. */
fun encodeSession(records: List<ScanRecord>): String =
    json.encodeToString(listSerializer, records.map { it.toDto() })

/** Parse a stored session. Corrupt or absent JSON yields an EMPTY list (start fresh), never a crash —
 *  mirroring src/app.tsx loadSession's try/catch. */
fun decodeSession(jsonText: String): List<ScanRecord> =
    runCatching {
        json.decodeFromString(listSerializer, jsonText).map { it.toRecord() }
    }.getOrDefault(emptyList())
