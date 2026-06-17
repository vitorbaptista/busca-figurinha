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
private val HIGH_CONF_LETTER_CONFUSIONS = setOf(
    'C' to 'G',
    'E' to 'O',
    'F' to 'E',
    'H' to 'R',
    'I' to 'M',
    'I' to 'U',
    'M' to 'A',
    'N' to 'A',
    'N' to 'I',
    'N' to 'M',
    'N' to 'R',
    'O' to 'C',
    'O' to 'Q',
    'U' to 'T',
    'W' to 'R',
    'W' to 'A',
    'W' to 'I',
    'T' to 'E',
    'J' to 'Q',
    'J' to 'U',
)
private val NUMERIC_SUFFIX_RE = Regex("(\\d{1,3})$")
private fun numericSuffix(code: String): String? = NUMERIC_SUFFIX_RE.find(code)?.value

// Exact raw reads observed in manually reviewed Pixel frames. Keep this number-preserving:
// changing the sticker number is too risky for live commits, even when the crop is high confidence.
private val HIGH_CONF_EXACT_ALIASES = mapOf(
    "ER4" to "GER4",
    "RGA17" to "RSA17",
    "ON15" to "IRN15",
    "NB18" to "NZL18",
    "SXV4" to "CIV4",
    "FGA19" to "RSA19",
    "MN10" to "IRN10",
    "MN15" to "IRN15",
    "GN10" to "IRN10",
    "OV4" to "CIV4",
    "NGA6" to "RSA6",
    "NEA6" to "RSA6",
    "EG1" to "ALG1",
    "DUA19" to "GHA19",
    "DH12" to "BIH12",
    "COT17" to "QAT17",
    "RH12" to "BIH12",
    "TOT17" to "QAT17",
    "GIE8" to "SWE8",
    "3AT17" to "QAT17",
    "SBT17" to "QAT17",
    "SOT17" to "QAT17",
    "SXJ20" to "IRQ20",
    "SE20" to "IRQ20",
    "WO20" to "IRQ20",
    "EN20" to "NOR20",
    "MN20" to "NOR20",
    "SWJ10" to "IRN10",
    "BN10" to "POR10",
    "SOU12" to "BIH12",
    "SVU15" to "IRN15",
    "TXN10" to "POR10",
    "OWJ10" to "IRN10",
    "EX14" to "SUI14",
    "MB1" to "ALG1",
    "WIU8" to "AUT8",
    "WX14" to "SUI14",
    "NO2" to "AUS2",
    "DAY4" to "CUW4",
    "IL10" to "TUN10",
    "WAI2" to "AUS2",
    "OAV4" to "CUW4",
    "DXW4" to "CUW4",
    "DAV4" to "CUW4",
    "UJMJ10" to "TUN10",
).also { aliases ->
    require(aliases.all { (raw, target) -> numericSuffix(raw) == numericSuffix(target) }) {
        "High-confidence exact aliases must keep the sticker number unchanged"
    }
}
private val STRUCTURED_CODE_RE = Regex("^([A-Z]{2,4})(\\d{1,3})$")
private val SAFE_SAME_LENGTH_CONFUSIONS = setOf(
    '0' to 'O',
    'O' to '0',
)

/** If [longer] becomes [shorter] by removing exactly one char, return it; else null. */
private fun singleRemovedChar(longer: String, shorter: String): Char? {
    return singleRemovedCharAt(longer, shorter)?.second
}

private fun singleRemovedCharAt(longer: String, shorter: String): Pair<Int, Char>? {
    if (longer.length != shorter.length + 1) return null
    var i = 0
    while (i < shorter.length && longer[i] == shorter[i]) i++
    if (longer.substring(i + 1) != shorter.substring(i)) return null
    return i to longer[i]
}

private fun isInteriorThinDrop(code: String, normalized: String): Boolean {
    val removed = singleRemovedCharAt(code, normalized) ?: return false
    val letters = STRUCTURED_CODE_RE.matchEntire(code)?.groupValues?.get(1) ?: return false
    return removed.second in DROPPABLE_LETTERS && removed.first > 0 && removed.first < letters.lastIndex
}

private fun safeSingleSubstitution(raw: String, code: String): Boolean {
    if (raw.length != code.length) return false
    var diffIndex = -1
    for (i in raw.indices) {
        if (raw[i] == code[i]) continue
        if (diffIndex != -1) return false
        diffIndex = i
    }
    if (diffIndex == -1) return false
    return (raw[diffIndex] to code[diffIndex]) in SAFE_SAME_LENGTH_CONFUSIONS
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
                    if (d <= maxDistance && safeSingleSubstitution(normalized, code)) consider(entry, d)
                }
            }
            code.length == normalized.length + 1 -> {
                if (isInteriorThinDrop(code, normalized)) consider(entry, 1)
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

fun bestHighConfidenceExactAliasMatchFromText(text: String, list: Checklist): MatchResult? {
    val exactAliasRaw = normalizeCode(text)
    HIGH_CONF_EXACT_ALIASES[exactAliasRaw]?.let { code ->
        val entry = list.byCode[code] ?: return@let
        return MatchResult(exactAliasRaw, MatchStatus.CORRECTED, entry, levenshtein(exactAliasRaw, code))
    }
    return null
}

fun bestHighConfidenceConfusionMatchFromText(text: String, list: Checklist): MatchResult? {
    bestHighConfidenceExactAliasMatchFromText(text, list)?.let { return it }

    val codes = extractCodes(text)
    if (codes.isEmpty()) return null
    var bestEntry: ChecklistEntry? = null
    var bestRaw = ""
    var bestDistance = Int.MAX_VALUE
    var tieAtBest = 0

    for (raw in codes) {
        val normalized = normalizeCode(raw)
        val rawMatch = STRUCTURED_CODE_RE.matchEntire(normalized) ?: continue
        val rawLetters = rawMatch.groupValues[1]
        val rawDigits = rawMatch.groupValues[2]
        for (entry in list.entries) {
            val entryMatch = STRUCTURED_CODE_RE.matchEntire(entry.code) ?: continue
            val entryLetters = entryMatch.groupValues[1]
            val entryDigits = entryMatch.groupValues[2]
            if (rawDigits != entryDigits || rawLetters.length != entryLetters.length) continue

            var distance = 0
            var ok = true
            for (i in rawLetters.indices) {
                val got = rawLetters[i]
                val expected = entryLetters[i]
                if (got == expected) continue
                if ((got to expected) !in HIGH_CONF_LETTER_CONFUSIONS) {
                    ok = false
                    break
                }
                distance++
            }
            if (!ok || distance !in 1..2) continue

            if (distance < bestDistance) {
                bestEntry = entry
                bestRaw = normalized
                bestDistance = distance
                tieAtBest = 1
            } else if (distance == bestDistance) {
                tieAtBest++
            }
        }
    }

    val entry = bestEntry
    return if (entry != null && tieAtBest == 1) {
        MatchResult(bestRaw, MatchStatus.CORRECTED, entry, bestDistance)
    } else {
        null
    }
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
