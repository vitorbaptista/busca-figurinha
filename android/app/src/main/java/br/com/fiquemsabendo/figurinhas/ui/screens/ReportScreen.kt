package br.com.fiquemsabendo.figurinhas.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.Checkbox
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.snapshots.SnapshotStateMap
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import br.com.fiquemsabendo.figurinhas.data.CollectionRepository
import br.com.fiquemsabendo.figurinhas.domain.ChecklistEntry
import br.com.fiquemsabendo.figurinhas.domain.SessionReport
import br.com.fiquemsabendo.figurinhas.i18n.Pt
import br.com.fiquemsabendo.figurinhas.ui.theme.AppTheme
import kotlinx.coroutines.delay

// Ports src/ui/screens/ReportScreen.tsx — the end-of-session summary. Shows totals (scanned,
// pra guardar), the keepers list with checkboxes (default ALL checked), a "Marcar/Desmarcar todas"
// toggle, a collapsible repeats section, an unknowns note, then "Adicionar N à coleção" (commits the
// checked keepers via collection.setOwned(.., true), flashes 🎉, then onCommitted) and "Voltar a
// escanear" (onBack). Add is disabled when nothing is checked.

@Composable
fun ReportScreen(
    report: SessionReport,
    collection: CollectionRepository,
    onCommitted: () -> Unit,
    onBack: () -> Unit,
    modifier: Modifier = Modifier,
) {
    // Keepers default to checked: the user unticks the ones they didn't actually trade for.
    val checked: SnapshotStateMap<String, Boolean> = remember(report) {
        mutableStateMapOf<String, Boolean>().apply {
            report.keepers.forEach { put(it.code, true) }
        }
    }
    var repeatsOpen by remember { mutableStateOf(false) }
    var done by remember { mutableStateOf(false) }

    val checkedCount = checked.count { it.value }
    val allChecked = checkedCount == report.keepers.size && report.keepers.isNotEmpty()

    // Brief success state before handing back to the collection (mirrors the 900ms setTimeout).
    if (done) {
        androidx.compose.runtime.LaunchedEffect(Unit) {
            delay(900)
            onCommitted()
        }
        Column(
            modifier = modifier
                .fillMaxSize()
                .padding(24.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center,
        ) {
            Text("🎉", fontSize = 88.sp)
            Spacer(Modifier.height(12.dp))
            Text(
                text = Pt.Report.added,
                style = MaterialTheme.typography.headlineMedium,
                color = MaterialTheme.colorScheme.primary,
            )
        }
        return
    }

    Column(modifier = modifier.fillMaxSize()) {
        LazyColumn(
            modifier = Modifier.weight(1f),
            contentPadding = androidx.compose.foundation.layout.PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            item(key = "header") {
                Column {
                    Text(
                        text = Pt.Report.title,
                        style = MaterialTheme.typography.headlineMedium,
                    )
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(top = 12.dp),
                        horizontalArrangement = Arrangement.spacedBy(12.dp),
                    ) {
                        TotalCard(
                            value = report.scannedCount,
                            label = Pt.Report.scanned,
                            accent = false,
                            modifier = Modifier.weight(1f),
                        )
                        TotalCard(
                            value = report.keepers.size,
                            label = Pt.Report.toKeep,
                            accent = true,
                            modifier = Modifier.weight(1f),
                        )
                    }
                }
            }

            item(key = "keepers-head") {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(
                        text = Pt.Report.keepersSection,
                        style = MaterialTheme.typography.titleMedium,
                    )
                    if (report.keepers.isNotEmpty()) {
                        TextButton(onClick = {
                            val target = !allChecked
                            report.keepers.forEach { checked[it.code] = target }
                        }) {
                            Text(if (allChecked) Pt.Report.toggleNone else Pt.Report.toggleAll)
                        }
                    }
                }
            }

            if (report.keepers.isEmpty()) {
                item(key = "keepers-empty") {
                    Text(
                        text = Pt.Report.keepersEmpty,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            } else {
                items(report.keepers, key = { it.code }) { entry ->
                    KeeperRow(
                        entry = entry,
                        checked = checked[entry.code] == true,
                        onToggle = { checked[entry.code] = checked[entry.code] != true },
                    )
                }
            }

            if (report.repeats.isNotEmpty()) {
                item(key = "repeats-head") {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(10.dp))
                            .clickable { repeatsOpen = !repeatsOpen }
                            .padding(vertical = 8.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Text(
                            text = Pt.Report.repeatsSection(report.repeats.size),
                            style = MaterialTheme.typography.titleMedium,
                        )
                        Text(if (repeatsOpen) "▾" else "▸", fontSize = 18.sp)
                    }
                }
                if (repeatsOpen) {
                    items(report.repeats, key = { "rep-${it.code}" }) { entry ->
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(vertical = 6.dp, horizontal = 4.dp),
                            horizontalArrangement = Arrangement.spacedBy(10.dp),
                        ) {
                            Text(
                                text = entry.display,
                                fontWeight = FontWeight.Bold,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                            Text(
                                text = entry.teamName,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                        }
                    }
                }
            }

            if (report.unknowns.isNotEmpty()) {
                item(key = "unknowns") {
                    Text(
                        text = "⚠️ " + Pt.Report.unknownsNote(report.unknowns.size),
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        fontSize = 14.sp,
                    )
                }
            }
        }

        // Footer actions, pinned below the scroll.
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            Button(
                onClick = {
                    val keep = checked.filterValues { it }.keys
                    collection.setOwned(keep, true)
                    done = true
                },
                enabled = checkedCount > 0,
                modifier = Modifier
                    .fillMaxWidth()
                    .height(56.dp),
            ) {
                Text(
                    text = if (checkedCount > 0) Pt.Report.add(checkedCount) else Pt.Report.addEmpty,
                    fontSize = 18.sp,
                )
            }
            OutlinedButton(
                onClick = onBack,
                modifier = Modifier
                    .fillMaxWidth()
                    .height(52.dp),
            ) {
                Text(Pt.Report.back, fontSize = 16.sp)
            }
        }
    }
}

@Composable
private fun TotalCard(
    value: Int,
    label: String,
    accent: Boolean,
    modifier: Modifier = Modifier,
) {
    val colors = AppTheme.colors
    val bg = if (accent) colors.keepContainer else MaterialTheme.colorScheme.surfaceVariant
    Column(
        modifier = modifier
            .clip(RoundedCornerShape(12.dp))
            .background(bg)
            .padding(vertical = 16.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text(
            text = value.toString(),
            fontSize = 32.sp,
            fontWeight = FontWeight.ExtraBold,
            color = if (accent) colors.keep else MaterialTheme.colorScheme.onSurface,
        )
        Text(
            text = label,
            fontSize = 14.sp,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
    }
}

@Composable
private fun KeeperRow(
    entry: ChecklistEntry,
    checked: Boolean,
    onToggle: () -> Unit,
) {
    Surface(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .clickable(onClick = onToggle),
        color = if (checked) AppTheme.colors.keepContainer else MaterialTheme.colorScheme.surface,
        tonalElevation = 1.dp,
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 8.dp, vertical = 6.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Checkbox(checked = checked, onCheckedChange = { onToggle() })
            Text(
                text = entry.display,
                fontWeight = FontWeight.Bold,
                fontSize = 17.sp,
                modifier = Modifier.padding(start = 4.dp),
            )
            Text(
                text = entry.teamName,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                fontSize = 15.sp,
                modifier = Modifier.padding(start = 12.dp),
            )
        }
    }
}
