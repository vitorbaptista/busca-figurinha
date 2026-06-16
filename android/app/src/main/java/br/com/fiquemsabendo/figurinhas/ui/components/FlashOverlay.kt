package br.com.fiquemsabendo.figurinhas.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import br.com.fiquemsabendo.figurinhas.domain.ScanOutcome
import br.com.fiquemsabendo.figurinhas.i18n.Pt
import br.com.fiquemsabendo.figurinhas.ui.theme.AppTheme

// Ports src/ui/components/Flash.tsx — the full-screen colored result flash. Green = needed
// (✅ GUARDAR + code + team), red = owned (♻️ REPETIDA + code), gray = unknown (🤔 Tente de novo).
// The caller owns show/hide timing (the PWA showed it ~1.1s); this is a pure render of one state.

/**
 * One flash to render. `key` is bumped by the caller so repeated identical outcomes still re-trigger
 * the flash (mirrors Flash.tsx's `key`). `display` is "" for unknown; `teamName` only shown for
 * keepers.
 */
data class FlashState(
    val outcome: ScanOutcome,
    /** Display code, e.g. "CIV 12" (empty for unknown). */
    val display: String,
    /** Team name shown under the code for keepers. */
    val teamName: String,
    /** Bumped each time so repeated identical outcomes still re-trigger the animation. */
    val key: Long,
)

@Composable
fun FlashOverlay(
    state: FlashState,
    modifier: Modifier = Modifier,
) {
    val colors = AppTheme.colors
    val (bg, fg) = when (state.outcome) {
        ScanOutcome.NEEDED -> colors.keep to colors.onKeep
        ScanOutcome.OWNED -> colors.repeat to colors.onRepeat
        ScanOutcome.UNKNOWN -> colors.neutral to colors.onNeutral
    }

    Column(
        modifier = modifier
            .fillMaxSize()
            .background(bg)
            .padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        when (state.outcome) {
            ScanOutcome.NEEDED -> {
                FlashEmoji("✅")
                FlashVerb(Pt.Scan.needed, fg)
                FlashCode(state.display, fg)
                if (state.teamName.isNotEmpty()) FlashTeam(state.teamName, fg)
            }
            ScanOutcome.OWNED -> {
                FlashEmoji("♻️")
                FlashVerb(Pt.Scan.owned, fg)
                FlashCode(state.display, fg)
            }
            ScanOutcome.UNKNOWN -> {
                FlashEmoji("🤔")
                FlashVerbSmall(Pt.Scan.tryAgain, fg)
            }
        }
    }
}

@Composable
private fun FlashEmoji(emoji: String) {
    Text(text = emoji, fontSize = 88.sp, textAlign = TextAlign.Center)
}

@Composable
private fun FlashVerb(text: String, color: Color) {
    Text(
        text = text,
        color = color,
        fontSize = 56.sp,
        fontWeight = FontWeight.ExtraBold,
        textAlign = TextAlign.Center,
        modifier = Modifier.padding(top = 8.dp),
    )
}

@Composable
private fun FlashVerbSmall(text: String, color: Color) {
    Text(
        text = text,
        color = color,
        fontSize = 32.sp,
        fontWeight = FontWeight.Bold,
        textAlign = TextAlign.Center,
        modifier = Modifier.padding(top = 8.dp),
    )
}

@Composable
private fun FlashCode(code: String, color: Color) {
    Text(
        text = code,
        color = color,
        fontSize = 40.sp,
        fontWeight = FontWeight.Bold,
        textAlign = TextAlign.Center,
        modifier = Modifier.padding(top = 4.dp),
    )
}

@Composable
private fun FlashTeam(team: String, color: Color) {
    Text(
        text = team,
        color = color,
        fontSize = 22.sp,
        textAlign = TextAlign.Center,
        modifier = Modifier.padding(top = 4.dp),
    )
}
