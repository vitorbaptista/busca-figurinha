package br.com.fiquemsabendo.figurinhas.data

import br.com.fiquemsabendo.figurinhas.domain.Checklist
import br.com.fiquemsabendo.figurinhas.domain.ChecklistEntry
import br.com.fiquemsabendo.figurinhas.domain.StickerType
import br.com.fiquemsabendo.figurinhas.domain.TeamGroup
import java.text.Collator
import java.util.Locale

// Official Panini FIFA World Cup 2026 album: 48 teams × 20 + 20 special "FWC" = 980.
// Ports src/data/checklist.ts (names pt-BR). Edit here to correct data.

private data class RawTeam(val code: String, val name: String, val count: Int)

private val RAW_TEAMS: List<RawTeam> = listOf(
    RawTeam("ALG", "Argélia", 20),
    RawTeam("ARG", "Argentina", 20),
    RawTeam("AUS", "Austrália", 20),
    RawTeam("AUT", "Áustria", 20),
    RawTeam("BEL", "Bélgica", 20),
    RawTeam("BIH", "Bósnia e Herzegovina", 20),
    RawTeam("BRA", "Brasil", 20),
    RawTeam("CAN", "Canadá", 20),
    RawTeam("CPV", "Cabo Verde", 20),
    RawTeam("COL", "Colômbia", 20),
    RawTeam("COD", "Congo (RD)", 20),
    RawTeam("CRO", "Croácia", 20),
    RawTeam("CUW", "Curaçao", 20),
    RawTeam("CZE", "Tchéquia", 20),
    RawTeam("ECU", "Equador", 20),
    RawTeam("EGY", "Egito", 20),
    RawTeam("ENG", "Inglaterra", 20),
    RawTeam("FRA", "França", 20),
    RawTeam("GER", "Alemanha", 20),
    RawTeam("GHA", "Gana", 20),
    RawTeam("HAI", "Haiti", 20),
    RawTeam("IRN", "Irã", 20),
    RawTeam("IRQ", "Iraque", 20),
    RawTeam("CIV", "Costa do Marfim", 20),
    RawTeam("JPN", "Japão", 20),
    RawTeam("JOR", "Jordânia", 20),
    RawTeam("MEX", "México", 20),
    RawTeam("MAR", "Marrocos", 20),
    RawTeam("NED", "Países Baixos", 20),
    RawTeam("NZL", "Nova Zelândia", 20),
    RawTeam("NOR", "Noruega", 20),
    RawTeam("PAN", "Panamá", 20),
    RawTeam("PAR", "Paraguai", 20),
    RawTeam("POR", "Portugal", 20),
    RawTeam("QAT", "Catar", 20),
    RawTeam("KSA", "Arábia Saudita", 20),
    RawTeam("SCO", "Escócia", 20),
    RawTeam("SEN", "Senegal", 20),
    RawTeam("RSA", "África do Sul", 20),
    RawTeam("KOR", "Coreia do Sul", 20),
    RawTeam("ESP", "Espanha", 20),
    RawTeam("SWE", "Suécia", 20),
    RawTeam("SUI", "Suíça", 20),
    RawTeam("TUN", "Tunísia", 20),
    RawTeam("TUR", "Turquia", 20),
    RawTeam("URU", "Uruguai", 20),
    RawTeam("USA", "Estados Unidos", 20),
    RawTeam("UZB", "Uzbequistão", 20),
)

// Album order: teams laid out by 2026 World Cup GROUP (A→L), each group in printed order.
private data class AlbumGroup(val group: String, val codes: List<String>)

private val ALBUM_GROUPS: List<AlbumGroup> = listOf(
    AlbumGroup("A", listOf("MEX", "RSA", "KOR", "CZE")),
    AlbumGroup("B", listOf("CAN", "BIH", "QAT", "SUI")),
    AlbumGroup("C", listOf("BRA", "MAR", "HAI", "SCO")),
    AlbumGroup("D", listOf("USA", "PAR", "AUS", "TUR")),
    AlbumGroup("E", listOf("GER", "CUW", "CIV", "ECU")),
    AlbumGroup("F", listOf("NED", "JPN", "SWE", "TUN")),
    AlbumGroup("G", listOf("BEL", "EGY", "IRN", "NZL")),
    AlbumGroup("H", listOf("ESP", "CPV", "KSA", "URU")),
    AlbumGroup("I", listOf("FRA", "SEN", "IRQ", "NOR")),
    AlbumGroup("J", listOf("ARG", "ALG", "AUT", "JOR")),
    AlbumGroup("K", listOf("POR", "COD", "UZB", "COL")),
    AlbumGroup("L", listOf("ENG", "CRO", "GHA", "PAN")),
)

private const val SPECIAL_NAME = "Especiais"
private const val SPECIAL_CODE = "FWC"

private fun teamEntries(team: RawTeam): List<ChecklistEntry> =
    (1..team.count).map { n ->
        ChecklistEntry(
            code = "${team.code}$n",
            display = "${team.code} $n",
            teamCode = team.code,
            teamName = team.name,
            number = n,
            type = if (n == 1) StickerType.TEAM else StickerType.PLAYER,
        )
    }

private fun specialEntries(): List<ChecklistEntry> {
    val out = mutableListOf(
        ChecklistEntry("00", "00", SPECIAL_CODE, SPECIAL_NAME, 0, StickerType.SPECIAL),
    )
    for (n in 1..19) {
        out.add(
            ChecklistEntry("$SPECIAL_CODE$n", "$SPECIAL_CODE $n", SPECIAL_CODE, SPECIAL_NAME, n, StickerType.SPECIAL),
        )
    }
    return out
}

private fun build(): Checklist {
    val byTeamCode = RAW_TEAMS.associateBy { it.code }
    val teamGroups = mutableListOf<TeamGroup>()
    for (ag in ALBUM_GROUPS) {
        for (code in ag.codes) {
            val t = byTeamCode[code] ?: continue // data guard
            teamGroups.add(TeamGroup(t.code, t.name, teamEntries(t), ag.group))
        }
    }
    // Safety net: any team missing from ALBUM_GROUPS still appears (alphabetically by pt name).
    val placed = teamGroups.map { it.teamCode }.toSet()
    val collator = Collator.getInstance(Locale("pt", "BR"))
    RAW_TEAMS.filter { it.code !in placed }
        .sortedWith(compareBy(collator) { it.name })
        .forEach { teamGroups.add(TeamGroup(it.code, it.name, teamEntries(it))) }

    val specials = TeamGroup(SPECIAL_CODE, SPECIAL_NAME, specialEntries())
    val teams = teamGroups + specials
    val entries = teams.flatMap { it.entries }
    val byCode = entries.associateBy { it.code }
    return Checklist(entries, byCode, teams, entries.size)
}

val checklist: Checklist = build()
