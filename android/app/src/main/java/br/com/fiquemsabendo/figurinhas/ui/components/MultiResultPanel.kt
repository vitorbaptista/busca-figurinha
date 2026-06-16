package br.com.fiquemsabendo.figurinhas.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import br.com.fiquemsabendo.figurinhas.i18n.Pt
import br.com.fiquemsabendo.figurinhas.scan.ScanItem
import br.com.fiquemsabendo.figurinhas.ui.theme.AppTheme

// Ports src/ui/components/MultiResult.tsx — the panel shown when several sticker backs are
// recognized in one capture. Each row is glanceable on its own (icon + colour + word) so a kid
// sorting a pile sees at once which to keep. The single-sticker case uses the big [FlashOverlay].
// Drives off ScanController.ScanItem: `owned == true` is REPETIDA (🔁 / "já tem"), false is GUARDAR
// (✅ / "guardar").

@Composable
fun MultiResultPanel(
    items: List<ScanItem>,
    modifier: Modifier = Modifier,
) {
    val colors = AppTheme.colors
    val neededCount = items.count { !it.owned }

    Surface(
        modifier = modifier.fillMaxWidth(),
        color = MaterialTheme.colorScheme.surface,
        shape = RoundedCornerShape(16.dp),
        tonalElevation = 3.dp,
        shadowElevation = 6.dp,
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            // Header: count + "figurinha(s) encontrada(s)" + the keep summary.
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    text = items.size.toString(),
                    fontSize = 28.sp,
                    fontWeight = FontWeight.ExtraBold,
                    color = MaterialTheme.colorScheme.primary,
                )
                Text(
                    text = " " + Pt.Scan.multiTitle(items.size),
                    fontSize = 18.sp,
                    fontWeight = FontWeight.SemiBold,
                    modifier = Modifier.padding(start = 4.dp),
                )
            }
            Text(
                text = if (neededCount > 0) Pt.Scan.multiNeeded(neededCount) else Pt.Scan.multiNoneNeeded,
                fontSize = 15.sp,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.padding(top = 2.dp, bottom = 8.dp),
            )

            Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                items.forEach { item ->
                    val rowColor = if (item.owned) colors.repeatContainer else colors.keepContainer
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(10.dp))
                            .background(rowColor)
                            .padding(horizontal = 12.dp, vertical = 10.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Text(
                            text = if (item.owned) "🔁" else "✅",
                            fontSize = 22.sp,
                            modifier = Modifier.size(28.dp),
                        )
                        Text(
                            text = item.display,
                            fontSize = 18.sp,
                            fontWeight = FontWeight.Bold,
                            modifier = Modifier.padding(start = 8.dp),
                        )
                        Text(
                            text = item.teamName,
                            fontSize = 14.sp,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            modifier = Modifier
                                .weight(1f)
                                .padding(start = 10.dp),
                        )
                        Text(
                            text = if (item.owned) Pt.Scan.have else Pt.Scan.keep,
                            fontSize = 13.sp,
                            fontWeight = FontWeight.Bold,
                            color = if (item.owned) colors.repeat else colors.keep,
                        )
                    }
                }
            }
        }
    }
}
