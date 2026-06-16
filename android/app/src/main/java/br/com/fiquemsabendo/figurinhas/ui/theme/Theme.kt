package br.com.fiquemsabendo.figurinhas.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Typography
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp

// App theme — light, high-contrast, kid-friendly. The two brand decisions that drive the whole UX
// are KEEP=green / REPEAT=red; they're exposed via [AppColors] (LocalAppColors) so screens and the
// scan flash use the EXACT same green/red as the chips and tags. Material3 is forced light: this is
// a daytime, on-the-table scanning app and a kid needs the colours to read the same every time
// (mirrors the PWA, which ships a single light palette).

/** The semantic brand colours shared by every screen + the scan flash. */
data class AppColors(
    /** GUARDAR / needed / not-yet-owned chip. */
    val keep: Color,
    val onKeep: Color,
    /** Soft green wash behind the green flash + owned-chip backgrounds. */
    val keepContainer: Color,
    /** REPETIDA / owned. */
    val repeat: Color,
    val onRepeat: Color,
    val repeatContainer: Color,
    /** Neutral / unknown ("tente de novo"). */
    val neutral: Color,
    val onNeutral: Color,
)

// Brand hues. Green is the album's "keep!" cue, red the "you already have it". Both are darkened
// enough to keep white text AA-legible (kids on cheap screens in daylight).
private val Green = Color(0xFF1B8A3A)
private val Red = Color(0xFFC62828)
private val Gray = Color(0xFF607080)

private val LightAppColors = AppColors(
    keep = Green,
    onKeep = Color.White,
    keepContainer = Color(0xFFD7F2DF),
    repeat = Red,
    onRepeat = Color.White,
    repeatContainer = Color(0xFFFBDCDC),
    neutral = Gray,
    onNeutral = Color.White,
)

/** Access the brand colours from any Composable: `AppTheme.colors.keep`. */
val LocalAppColors = staticCompositionLocalOf { LightAppColors }

private val ColorScheme = lightColorScheme(
    primary = Green,
    onPrimary = Color.White,
    primaryContainer = Color(0xFFD7F2DF),
    onPrimaryContainer = Color(0xFF06381A),
    secondary = Color(0xFF2D6CDF),
    onSecondary = Color.White,
    error = Red,
    onError = Color.White,
    background = Color(0xFFFAFBFC),
    onBackground = Color(0xFF1A1F24),
    surface = Color.White,
    onSurface = Color(0xFF1A1F24),
    surfaceVariant = Color(0xFFEDF1F4),
    onSurfaceVariant = Color(0xFF44505A),
    outline = Color(0xFFBCC6CE),
)

// Big, friendly type with generous weights — easy to read at a glance for kids/teens.
private val AppTypography = Typography(
    headlineLarge = Typography().headlineLarge.copy(fontWeight = FontWeight.ExtraBold, fontSize = 32.sp),
    headlineMedium = Typography().headlineMedium.copy(fontWeight = FontWeight.Bold, fontSize = 26.sp),
    titleLarge = Typography().titleLarge.copy(fontWeight = FontWeight.Bold, fontSize = 22.sp),
    titleMedium = Typography().titleMedium.copy(fontWeight = FontWeight.SemiBold, fontSize = 18.sp),
    bodyLarge = Typography().bodyLarge.copy(fontSize = 17.sp),
    bodyMedium = Typography().bodyMedium.copy(fontSize = 15.sp),
    labelLarge = Typography().labelLarge.copy(fontWeight = FontWeight.Bold, fontSize = 16.sp),
)

/** Convenience accessor object so call sites read `AppTheme.colors.keep`. */
object AppTheme {
    val colors: AppColors
        @Composable get() = LocalAppColors.current
}

@Composable
fun AppTheme(content: @Composable () -> Unit) {
    // We deliberately stay light regardless of system dark mode — referenced only to keep the
    // signature future-proof without an unused-import warning under the strict tsconfig-equivalent.
    @Suppress("UNUSED_VARIABLE") val dark = isSystemInDarkTheme()
    androidx.compose.runtime.CompositionLocalProvider(LocalAppColors provides LightAppColors) {
        MaterialTheme(
            colorScheme = ColorScheme,
            typography = AppTypography,
            content = content,
        )
    }
}
