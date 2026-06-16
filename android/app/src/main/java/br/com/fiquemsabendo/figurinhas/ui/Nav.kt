package br.com.fiquemsabendo.figurinhas.ui

import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.unit.sp
import br.com.fiquemsabendo.figurinhas.i18n.Pt

// Ports src/ui/Nav.tsx + the Screen state type from app.tsx. The report screen lives "inside" the
// scan flow, so Escanear stays highlighted while on it (active = if report then scan). Icons are
// emoji (📷 📚 ⚙️), matching the PWA verbatim and avoiding the material-icons-extended dependency.

enum class Screen { SCAN, REPORT, COLLECTION, SETTINGS }

private data class NavItem(val screen: Screen, val label: String, val emoji: String)

private val ITEMS = listOf(
    NavItem(Screen.SCAN, Pt.Nav.scan, "📷"),
    NavItem(Screen.COLLECTION, Pt.Nav.collection, "📚"),
    NavItem(Screen.SETTINGS, Pt.Nav.settings, "⚙️"),
)

@Composable
fun BottomNav(
    current: Screen,
    onNavigate: (Screen) -> Unit,
) {
    // Keep Scan highlighted on the report screen (the report is part of the scan flow).
    val active = if (current == Screen.REPORT) Screen.SCAN else current
    NavigationBar {
        ITEMS.forEach { item ->
            NavigationBarItem(
                selected = active == item.screen,
                onClick = { onNavigate(item.screen) },
                icon = { Text(item.emoji, fontSize = 22.sp) },
                label = { Text(item.label) },
            )
        }
    }
}
