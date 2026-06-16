package br.com.fiquemsabendo.figurinhas.domain

// Shared contracts for the whole app. Pure types only — ports src/types.ts.

enum class StickerType { TEAM, PLAYER, SPECIAL }

/** One sticker in the album, keyed by its printed back code. */
data class ChecklistEntry(
    val code: String,       // canonical: uppercase, no spaces. "CIV12", "FWC1", "00"
    val display: String,    // human form. "CIV 12", "FWC 1", "00"
    val teamCode: String,   // grouping key. "CIV", "FWC"
    val teamName: String,   // pt-BR section name. "Costa do Marfim", "Especiais"
    val number: Int,        // number within the team (0 for the "00" logo)
    val type: StickerType,
)

data class TeamGroup(
    val teamCode: String,
    val teamName: String,
    val entries: List<ChecklistEntry>, // ordered by number
    val group: String? = null,         // World Cup group A–L; null for "FWC"
)

data class Checklist(
    val entries: List<ChecklistEntry>,
    val byCode: Map<String, ChecklistEntry>, // O(1) lookup + fuzzy-match candidate keys
    val teams: List<TeamGroup>,              // display order
    val total: Int,
)

data class ParsedCode(
    val teamCode: String,  // "" for pure-number codes like "00"
    val number: Int,
    val canonical: String,
)

enum class MatchStatus { EXACT, CORRECTED, UNKNOWN }

data class MatchResult(
    val raw: String,             // normalized raw OCR token matched against
    val status: MatchStatus,
    val entry: ChecklistEntry?,  // matched entry, or null when unknown
    val distance: Int,           // 0 exact, >=1 corrected, -1 unknown
)

enum class ScanOutcome { NEEDED, OWNED, UNKNOWN }

data class ScanRecord(
    val raw: String,
    val code: String?,   // canonical code when matched, else null
    val outcome: ScanOutcome,
    val ts: Long,
)

data class SessionReport(
    val scannedCount: Int,
    val keepers: List<ChecklistEntry>, // deduped needed
    val repeats: List<ChecklistEntry>, // deduped owned
    val unknowns: List<String>,        // deduped raw tokens that matched nothing
)
