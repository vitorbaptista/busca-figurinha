package br.com.fiquemsabendo.figurinhas.data

import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json

// Pure backup serialization — ports src/types.ts BackupFile + the PWA export/import shape. NO
// Android here, so it unit-tests on the plain JVM. The settings are stored as STRINGS/booleans
// (enum names) so the JSON stays human-readable and stable across the typed `Settings` model.

/** The settings block of a backup, mirroring `Settings` as JSON-friendly primitives. */
@Serializable
data class BackupSettings(
    val language: String = Language.PT.name,
    val sound: Boolean = false,
    val onboarded: Boolean = false,
    val camera: String = CameraFacing.FRONT.name,
    val debug: Boolean = false,
)

/** A full local backup: the owned codes plus settings, tagged with the app + schema version. */
@Serializable
data class BackupFile(
    val app: String = "troca-figurinhas",
    val version: Int = 1,
    val exportedAt: String,
    val owned: List<String>,
    val settings: BackupSettings,
)

// One lenient codec: tolerate unknown keys so a backup from a newer build still imports, and emit
// no nulls for absent optionals.
private val json = Json {
    ignoreUnknownKeys = true
    encodeDefaults = true
}

/** Convert the typed `Settings` to its JSON-friendly backup form. */
fun Settings.toBackup(): BackupSettings =
    BackupSettings(
        language = language.name,
        sound = sound,
        onboarded = onboarded,
        camera = camera.name,
        debug = debug,
    )

/** Convert a backup's settings block back to typed `Settings`; unknown enum names fall to defaults. */
fun BackupSettings.toSettings(): Settings =
    Settings(
        language = runCatching { Language.valueOf(language) }.getOrDefault(Language.PT),
        sound = sound,
        onboarded = onboarded,
        camera = runCatching { CameraFacing.valueOf(camera) }.getOrDefault(CameraFacing.FRONT),
        debug = debug,
    )

/** Serialize a backup. `exportedAt` is supplied by the caller (an ISO string from the UI/clock). */
fun encodeBackup(owned: List<String>, settings: Settings, exportedAt: String): String =
    json.encodeToString(
        BackupFile.serializer(),
        BackupFile(
            exportedAt = exportedAt,
            owned = owned,
            settings = settings.toBackup(),
        ),
    )

/** Parse a backup; lenient about unknown keys. Throws on structurally-invalid JSON (caller decides). */
fun decodeBackup(jsonText: String): BackupFile =
    json.decodeFromString(BackupFile.serializer(), jsonText)
