package br.com.fiquemsabendo.figurinhas.data

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

// Pure-JVM tests for the backup serialization (no DataStore). Round-trip must preserve the owned
// codes + every settings field + exportedAt, decode must tolerate unknown keys (a newer build's
// extra fields), and non-default enum values must survive the trip.

class BackupTest {
    @Test fun roundTrip_preserves_owned_settings_and_exportedAt() {
        val owned = listOf("CIV12", "BRA1", "00")
        val settings = Settings(
            language = Language.PT,
            sound = true,
            onboarded = true,
            camera = CameraFacing.BACK,
            debug = true,
        )
        val exportedAt = "2026-06-16T12:00:00.000Z"

        val decoded = decodeBackup(encodeBackup(owned, settings, exportedAt))

        assertEquals("troca-figurinhas", decoded.app)
        assertEquals(1, decoded.version)
        assertEquals(exportedAt, decoded.exportedAt)
        assertEquals(owned, decoded.owned)
        assertEquals("PT", decoded.settings.language)
        assertEquals(true, decoded.settings.sound)
        assertEquals(true, decoded.settings.onboarded)
        assertEquals("BACK", decoded.settings.camera)
        assertEquals(true, decoded.settings.debug)
    }

    @Test fun roundTrip_via_typed_settings_helpers() {
        // The backup settings block converts back to the typed Settings unchanged.
        val settings = Settings(sound = true, onboarded = true, camera = CameraFacing.BACK, debug = true)
        val decoded = decodeBackup(encodeBackup(emptyList(), settings, "2026-01-01T00:00:00Z"))
        assertEquals(settings, decoded.settings.toSettings())
    }

    @Test fun decode_tolerates_unknown_keys() {
        val json = """
            {
              "app": "troca-figurinhas",
              "version": 1,
              "exportedAt": "2026-06-16T12:00:00.000Z",
              "owned": ["CIV12"],
              "settings": { "language": "PT", "sound": false, "onboarded": false, "camera": "FRONT" },
              "futureField": "ignore me",
              "nested": { "a": 1 }
            }
        """.trimIndent()

        val decoded = decodeBackup(json)
        assertEquals(listOf("CIV12"), decoded.owned)
        assertEquals("FRONT", decoded.settings.camera)
        assertEquals(false, decoded.settings.toSettings().debug)
    }

    @Test fun unknown_enum_name_falls_back_to_default() {
        // A garbled camera/language name in a backup must not crash conversion to typed Settings.
        val bogus = BackupSettings(
            language = "XX",
            sound = true,
            onboarded = true,
            camera = "SIDEWAYS",
            debug = true,
        )
        val settings = bogus.toSettings()
        assertEquals(Language.PT, settings.language)
        assertEquals(CameraFacing.FRONT, settings.camera)
        assertTrue(settings.sound)
        assertTrue(settings.onboarded)
        assertTrue(settings.debug)
    }

    @Test fun defaults_match_the_PWA() {
        // sound off, not onboarded, front camera, pt — mirrors DEFAULT_SETTINGS in settings.ts.
        val d = Settings()
        assertEquals(Language.PT, d.language)
        assertEquals(false, d.sound)
        assertEquals(false, d.onboarded)
        assertEquals(CameraFacing.FRONT, d.camera)
        assertEquals(false, d.debug)
    }
}
