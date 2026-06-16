package br.com.fiquemsabendo.figurinhas.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.semantics.progressBarRangeInfo
import androidx.compose.ui.semantics.ProgressBarRangeInfo
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp

// Ports src/ui/components/ProgressBar.tsx — a flat 0..1 bar. Track + green fill (the brand "keep"
// hue, same as the chips), clamped and rounded.

@Composable
fun ProgressBar(
    value: Float,
    modifier: Modifier = Modifier,
) {
    val pct = value.coerceIn(0f, 1f)
    Box(
        modifier = modifier
            .fillMaxWidth()
            .height(12.dp)
            .clip(RoundedCornerShape(6.dp))
            .background(MaterialTheme.colorScheme.surfaceVariant)
            .semantics {
                progressBarRangeInfo = ProgressBarRangeInfo(pct, 0f..1f)
            },
    ) {
        Box(
            modifier = Modifier
                .fillMaxWidth(pct)
                .fillMaxHeight()
                .clip(RoundedCornerShape(6.dp))
                .background(MaterialTheme.colorScheme.primary),
        )
    }
}
