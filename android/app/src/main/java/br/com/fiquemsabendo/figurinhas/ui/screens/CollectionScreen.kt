package br.com.fiquemsabendo.figurinhas.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.sizeIn
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import br.com.fiquemsabendo.figurinhas.data.CollectionRepository
import br.com.fiquemsabendo.figurinhas.data.checklist
import br.com.fiquemsabendo.figurinhas.domain.TeamGroup
import br.com.fiquemsabendo.figurinhas.i18n.Pt
import br.com.fiquemsabendo.figurinhas.ui.components.ProgressBar
import br.com.fiquemsabendo.figurinhas.ui.theme.AppTheme

// Ports src/ui/screens/CollectionScreen.tsx — the album view. Observes collection.owned; shows the
// overall progress (owned/total + %, "Coleção completa! 🎉" at 100%), a ProgressBar, a search box,
// then a scrolling list of teams in album order with a "Grupo X" header before the first team of
// each group. Each team shows its name + owned/total and a grid of number chips (green if owned,
// neutral if not) that toggle on tap. Filters by team name / team code / entry code+display.

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun CollectionScreen(
    collection: CollectionRepository,
    modifier: Modifier = Modifier,
) {
    val owned by collection.owned.collectAsStateWithLifecycle()
    var query by remember { mutableStateOf("") }

    val total = checklist.total
    val ownedCount = owned.size
    val pct = if (total == 0) 0 else (ownedCount * 100) / total
    val teams = remember(query) { filterTeams(checklist.teams, query) }

    LazyColumn(
        modifier = modifier.fillMaxWidth(),
        contentPadding = androidx.compose.foundation.layout.PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        item(key = "header") {
            Column {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(
                        text = Pt.Collection.title,
                        style = MaterialTheme.typography.headlineMedium,
                    )
                    Text(
                        text = Pt.Collection.progress(ownedCount, total),
                        fontSize = 18.sp,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
                Box(modifier = Modifier.padding(top = 10.dp)) {
                    ProgressBar(value = if (total == 0) 0f else ownedCount.toFloat() / total)
                }
                Text(
                    text = if (ownedCount >= total) Pt.Collection.complete else "$pct%",
                    fontSize = 15.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = MaterialTheme.colorScheme.primary,
                    modifier = Modifier.padding(top = 6.dp),
                )
                OutlinedTextField(
                    value = query,
                    onValueChange = { query = it },
                    placeholder = { Text(Pt.Collection.searchPlaceholder) },
                    singleLine = true,
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(top = 12.dp),
                )
            }
        }

        if (teams.isEmpty()) {
            item(key = "empty") {
                Text(
                    text = Pt.Collection.noResults,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.padding(vertical = 24.dp),
                )
            }
        } else {
            // Each team item renders its preceding "Grupo X" header when the group changes.
            itemsIndexed(teams, key = { _, t -> t.teamCode }) { i, team ->
                val prevGroup = teams.getOrNull(i - 1)?.group
                val showGroupHeader = team.group != null && team.group != prevGroup
                Column {
                    if (showGroupHeader) {
                        Text(
                            text = Pt.Collection.group(team.group!!),
                            fontSize = 14.sp,
                            fontWeight = FontWeight.Bold,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            modifier = Modifier.padding(top = 8.dp, bottom = 4.dp),
                        )
                    }
                    TeamCard(team = team, owned = owned, onToggle = collection::toggle)
                }
            }
        }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun TeamCard(
    team: TeamGroup,
    owned: Set<String>,
    onToggle: (String) -> Unit,
) {
    val ownedInTeam = team.entries.count { it.code in owned }
    val complete = ownedInTeam == team.entries.size

    Surface(
        modifier = Modifier.fillMaxWidth(),
        color = MaterialTheme.colorScheme.surface,
        shape = RoundedCornerShape(14.dp),
        tonalElevation = 1.dp,
    ) {
        Column(modifier = Modifier.padding(12.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    text = team.teamName,
                    fontSize = 17.sp,
                    fontWeight = FontWeight.Bold,
                )
                Text(
                    text = Pt.Collection.teamProgress(ownedInTeam, team.entries.size),
                    fontSize = 14.sp,
                    fontWeight = FontWeight.Bold,
                    color = if (complete) MaterialTheme.colorScheme.primary
                    else MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            FlowRow(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(top = 10.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                team.entries.forEach { entry ->
                    val has = entry.code in owned
                    NumberChip(
                        label = if (entry.number == 0) "00" else entry.number.toString(),
                        owned = has,
                        onClick = { onToggle(entry.code) },
                    )
                }
            }
        }
    }
}

@Composable
private fun NumberChip(
    label: String,
    owned: Boolean,
    onClick: () -> Unit,
) {
    val colors = AppTheme.colors
    val bg = if (owned) colors.keep else MaterialTheme.colorScheme.surfaceVariant
    val fg = if (owned) colors.onKeep else MaterialTheme.colorScheme.onSurfaceVariant
    Box(
        modifier = Modifier
            .sizeIn(minWidth = 44.dp, minHeight = 44.dp)
            .size(44.dp)
            .clip(RoundedCornerShape(10.dp))
            .background(bg)
            .clickable(onClick = onClick),
        contentAlignment = Alignment.Center,
    ) {
        Text(text = label, color = fg, fontSize = 16.sp, fontWeight = FontWeight.Bold)
    }
}

/** Filter teams by team name or by code/display of any entry — mirrors filterTeams in the PWA. */
private fun filterTeams(teams: List<TeamGroup>, query: String): List<TeamGroup> {
    val q = query.trim().uppercase()
    if (q.isEmpty()) return teams
    val qNorm = q.replace(Regex("\\s+"), "")
    return teams.filter { team ->
        if (team.teamName.uppercase().contains(q) || team.teamCode.contains(qNorm)) return@filter true
        team.entries.any { it.code.contains(qNorm) || it.display.uppercase().contains(q) }
    }
}
