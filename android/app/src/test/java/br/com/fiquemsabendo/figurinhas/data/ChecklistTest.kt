package br.com.fiquemsabendo.figurinhas.data

import br.com.fiquemsabendo.figurinhas.domain.StickerType
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue

class ChecklistTest {
    @Test fun has_980_entries() {
        assertEquals(980, checklist.total)
        assertEquals(980, checklist.entries.size)
    }

    @Test fun has_48_teams_plus_specials() {
        assertEquals(49, checklist.teams.size) // 48 teams + 1 Especiais
    }

    @Test fun known_codes_resolve_with_pt_names() {
        assertEquals("Costa do Marfim", checklist.byCode["CIV12"]?.teamName)
        assertEquals("Egito", checklist.byCode["EGY4"]?.teamName)
        assertEquals("CIV 12", checklist.byCode["CIV12"]?.display)
    }

    @Test fun logo_and_specials_present() {
        assertNotNull(checklist.byCode["00"])
        assertEquals(StickerType.SPECIAL, checklist.byCode["00"]?.type)
        assertNotNull(checklist.byCode["FWC19"])
        assertNull(checklist.byCode["FWC20"]) // specials are 00 + FWC1..19
    }

    @Test fun teams_are_in_album_group_order_A_first() {
        assertEquals("MEX", checklist.teams.first().teamCode)
        assertEquals("FWC", checklist.teams.last().teamCode)
        assertEquals("A", checklist.teams.first().group)
    }

    @Test fun every_team_has_20() {
        val teamGroups = checklist.teams.filter { it.teamCode != "FWC" }
        assertEquals(48, teamGroups.size)
        assertTrue(teamGroups.all { it.entries.size == 20 })
    }
}
