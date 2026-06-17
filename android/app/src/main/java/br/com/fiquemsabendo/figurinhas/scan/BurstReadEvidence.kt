package br.com.fiquemsabendo.figurinhas.scan

import br.com.fiquemsabendo.figurinhas.domain.Checklist
import br.com.fiquemsabendo.figurinhas.domain.MatchResult
import br.com.fiquemsabendo.figurinhas.domain.MatchStatus
import br.com.fiquemsabendo.figurinhas.domain.extractCodes

/**
 * Conservative burst evidence from raw OCR reads. A low-confidence read is not enough to commit on
 * its own, but if the same exact checklist code appears in multiple frames, the existing confirmer
 * can treat those frames as agreement. No corrections or aliases are applied here.
 */
fun burstReadEvidenceMatches(reads: List<String>, checklist: Checklist): List<MatchResult> {
    val seen = LinkedHashSet<String>()
    val out = ArrayList<MatchResult>()
    for (read in reads) {
        for (code in extractCodes(read)) {
            if (code == "00" || !seen.add(code)) continue
            val entry = checklist.byCode[code] ?: continue
            out.add(MatchResult(code, MatchStatus.EXACT, entry, 0))
        }
    }
    return out
}
