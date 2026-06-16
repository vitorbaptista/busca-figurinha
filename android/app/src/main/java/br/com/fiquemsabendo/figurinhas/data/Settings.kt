package br.com.fiquemsabendo.figurinhas.data

// User settings — ports src/types.ts (Settings, Language, CameraFacing) and the PWA defaults
// in src/state/settings.ts (DEFAULT_SETTINGS): sound off, not onboarded, front camera.

/** Album/UI language. Only pt-BR ships, mirroring the PWA's single-locale `Language`. */
enum class Language { PT }

/** Which camera the scanner uses. FRONT (screen-side) is the default: the phone lies flat on the
 *  table and the user shows the sticker back to the front camera. */
enum class CameraFacing { FRONT, BACK }

data class Settings(
    val language: Language = Language.PT,
    val sound: Boolean = false,
    val onboarded: Boolean = false,
    val camera: CameraFacing = CameraFacing.FRONT,
    /** Show the live OCR debug overlay (heartbeat, reads, fps, frame dump). Off by default; toggled in
     *  Ajustes. Mirrors the PWA's opt-in ?debug, but persisted so it survives restarts on any build. */
    val debug: Boolean = false,
)
