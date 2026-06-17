package br.com.fiquemsabendo.figurinhas.domain

import br.com.fiquemsabendo.figurinhas.Config

// Turns noisy OCR text into checklist matches. Conservative: never invents a code. Ports matching.ts.

private val CODE_RE = Regex("\\b[A-Z]{2,4}\\s?\\d{1,3}\\b", RegexOption.IGNORE_CASE)
private val LOGO_RE = Regex("\\b00\\b")

/** Pull candidate code tokens out of arbitrary OCR text (letter+number codes plus "00"). */
fun extractCodes(text: String): List<String> {
    val tokens = ArrayList<String>()
    for (m in CODE_RE.findAll(text)) tokens.add(m.value)
    for (m in LOGO_RE.findAll(text)) tokens.add(m.value)
    val seen = LinkedHashSet<String>()
    for (token in tokens) {
        val code = normalizeCode(token)
        if (code.isNotEmpty()) seen.add(code)
    }
    return seen.toList()
}

/** Tokens shorter than this are too ambiguous for general edit-distance auto-correction. */
private const val MIN_CORRECT_LEN = 4
private const val MIN_THIN_RESTORE_LEN = 3

/** Thin vertical-stroke letters the OCR reliably DROPS (never a bold letter). */
private val DROPPABLE_LETTERS = setOf('I', 'J', 'L', 'T')

/** If [longer] becomes [shorter] by removing exactly one char, return it; else null. */
private fun singleRemovedChar(longer: String, shorter: String): Char? {
    if (longer.length != shorter.length + 1) return null
    var i = 0
    while (i < shorter.length && longer[i] == shorter[i]) i++
    if (longer.substring(i + 1) != shorter.substring(i)) return null
    return longer[i]
}

/** Match a single raw token against the checklist (exact, else unique nearest). */
fun matchCode(raw: String, list: Checklist, maxDistance: Int = Config.Match.MAX_DISTANCE): MatchResult {
    val normalized = normalizeCode(raw)

    list.byCode[normalized]?.let {
        return MatchResult(normalized, MatchStatus.EXACT, it, 0)
    }
    if (normalized.length < MIN_THIN_RESTORE_LEN) {
        return MatchResult(normalized, MatchStatus.UNKNOWN, null, -1)
    }

    var bestEntry: ChecklistEntry? = null
    var bestDistance = Int.MAX_VALUE
    var tieAtBest = 0
    fun consider(entry: ChecklistEntry, distance: Int) {
        if (distance < bestDistance) {
            bestEntry = entry; bestDistance = distance; tieAtBest = 1
        } else if (distance == bestDistance) {
            tieAtBest++
        }
    }

    for (entry in list.entries) {
        val code = entry.code
        when {
            code.length == normalized.length -> {
                if (normalized.length >= MIN_CORRECT_LEN) {
                    val d = levenshtein(normalized, code)
                    if (d <= maxDistance) consider(entry, d)
                }
            }
            code.length == normalized.length + 1 -> {
                val dropped = singleRemovedChar(code, normalized)
                if (dropped != null && dropped in DROPPABLE_LETTERS) consider(entry, 1)
            }
            code.length + 1 == normalized.length -> {
                val added = singleRemovedChar(normalized, code)
                if (added != null && added in DROPPABLE_LETTERS) consider(entry, 1)
            }
        }
    }

    val be = bestEntry
    return if (be != null && tieAtBest == 1) {
        MatchResult(normalized, MatchStatus.CORRECTED, be, bestDistance)
    } else {
        MatchResult(normalized, MatchStatus.UNKNOWN, null, -1)
    }
}

/** Best match across every code found in a block of OCR text; null when none present. */
fun bestMatchFromText(text: String, list: Checklist, maxDistance: Int = Config.Match.MAX_DISTANCE): MatchResult? {
    val codes = extractCodes(text)
    if (codes.isEmpty()) return null
    var best: MatchResult? = null
    for (code in codes) {
        val result = matchCode(code, list, maxDistance)
        if (result.status == MatchStatus.EXACT) return result
        val b = best
        if (b == null) { best = result; continue }
        if (b.status == MatchStatus.UNKNOWN && result.status == MatchStatus.CORRECTED) best = result
        else if (result.status == MatchStatus.CORRECTED && result.distance < b.distance) best = result
    }
    return best
}

/** Match a block where each line is one located code-box crop (one result per unique entry). */
fun matchLines(text: String, list: Checklist, maxDistance: Int = Config.Match.MAX_DISTANCE): List<MatchResult> {
    val seen = LinkedHashSet<String>()
    val results = ArrayList<MatchResult>()
    for (line in text.split("\n")) {
        val norm = normalizeCode(line)
        if (norm.length < 2 || norm.length > 8) continue
        val m = bestMatchFromText(line, list, maxDistance)
        val e = m?.entry
        if (e != null && seen.add(e.code)) results.add(m)
    }
    return results
}

/** Match EVERY distinct code found (several backs in view); one result per unique entry. */
fun matchAllFromText(text: String, list: Checklist, maxDistance: Int = Config.Match.MAX_DISTANCE): List<MatchResult> {
    val seen = LinkedHashSet<String>()
    val results = ArrayList<MatchResult>()
    for (code in extractCodes(text)) {
        val result = matchCode(code, list, maxDistance)
        val e = result.entry ?: continue
        if (seen.add(e.code)) results.add(result)
    }
    return results
}
