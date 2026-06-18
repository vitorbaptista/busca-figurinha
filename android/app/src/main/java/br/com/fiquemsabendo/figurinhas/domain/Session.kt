package br.com.fiquemsabendo.figurinhas.domain

import java.text.Collator
import java.util.Locale

// A scanning session is read-only over the collection: it just records what the camera saw.
// The report dedupes records into keepers/repeats/unknowns. Ports session.ts.

/** Classify a scan: unknown when unmatched, else owned/needed by the collection. */
fun outcomeFor(match: MatchResult, owned: Boolean): ScanOutcome {
    if (match.entry == null || match.status == MatchStatus.UNKNOWN) return ScanOutcome.UNKNOWN
    return if (owned) ScanOutcome.OWNED else ScanOutcome.NEEDED
}

class Session(
    initial: List<ScanRecord> = emptyList(),
    private val now: () -> Long = { System.currentTimeMillis() },
) {
    private val records = ArrayList(initial)
    private val collator = Collator.getInstance(Locale("pt", "BR"))

    fun add(match: MatchResult, owned: Boolean): ScanRecord {
        val record = ScanRecord(
            raw = match.raw,
            code = match.entry?.code,
            outcome = outcomeFor(match, owned),
            ts = now(),
        )
        records.add(record)
        return record
    }

    fun records(): List<ScanRecord> = records.toList()
    fun isEmpty(): Boolean = records.isEmpty()
    fun clear() { records.clear() }
    fun toJSON(): List<ScanRecord> = records.toList()

    fun finish(checklist: Checklist): SessionReport {
        val result = report(checklist)
        clear()
        return result
    }

    fun report(checklist: Checklist): SessionReport {
        val keeperCodes = LinkedHashSet<String>()
        val repeatCodes = LinkedHashSet<String>()
        val unknownRaws = LinkedHashSet<String>()
        for (r in records) {
            when {
                r.outcome == ScanOutcome.NEEDED && r.code != null -> keeperCodes.add(r.code)
                r.outcome == ScanOutcome.OWNED && r.code != null -> repeatCodes.add(r.code)
                r.outcome == ScanOutcome.UNKNOWN -> unknownRaws.add(r.raw)
            }
        }
        val byTeamThenNumber = Comparator<ChecklistEntry> { a, b ->
            val c = collator.compare(a.teamName, b.teamName)
            if (c != 0) c else a.number - b.number
        }
        fun toEntries(codes: Set<String>): List<ChecklistEntry> =
            codes.mapNotNull { checklist.byCode[it] }.sortedWith(byTeamThenNumber)

        return SessionReport(
            scannedCount = records.size,
            keepers = toEntries(keeperCodes),
            repeats = toEntries(repeatCodes),
            unknowns = unknownRaws.toList(),
        )
    }
}
