package br.com.fiquemsabendo.figurinhas.domain

// Pure helpers for the printed sticker codes (e.g. "CIV 12", "FWC 1", "00"). Ports code.ts.

private val NON_ALNUM = Regex("[^A-Z0-9]")
private val DISPLAY_RE = Regex("^([A-Z]+)(\\d+)$")
private val PARSE_RE = Regex("^([A-Z]*)(\\d+)$")

/** Uppercase and strip everything except A-Z and 0-9. "civ 12" -> "CIV12". */
fun normalizeCode(raw: String): String = raw.uppercase().replace(NON_ALNUM, "")

/** Insert a single space between a letters prefix and a digits suffix; else unchanged. */
fun toDisplay(code: String): String {
    val m = DISPLAY_RE.matchEntire(code) ?: return code
    return "${m.groupValues[1]} ${m.groupValues[2]}"
}

/** Normalize then split into a letter prefix + trailing integer; null when no digits. */
fun parseCode(raw: String): ParsedCode? {
    val canonical = normalizeCode(raw)
    val m = PARSE_RE.matchEntire(canonical) ?: return null
    return ParsedCode(m.groupValues[1], m.groupValues[2].toInt(), canonical)
}

/** Standard Levenshtein edit distance (insert/delete/substitute = 1). */
fun levenshtein(a: String, b: String): Int {
    if (a == b) return 0
    if (a.isEmpty()) return b.length
    if (b.isEmpty()) return a.length
    var prev = IntArray(b.length + 1) { it }
    for (i in 1..a.length) {
        val curr = IntArray(b.length + 1)
        curr[0] = i
        for (j in 1..b.length) {
            val cost = if (a[i - 1] == b[j - 1]) 0 else 1
            curr[j] = minOf(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost)
        }
        prev = curr
    }
    return prev[b.length]
}
