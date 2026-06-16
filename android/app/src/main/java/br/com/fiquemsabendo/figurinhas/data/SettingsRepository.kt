package br.com.fiquemsabendo.figurinhas.data

import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.booleanPreferencesKey
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.emptyPreferences
import androidx.datastore.preferences.core.stringPreferencesKey
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import java.io.IOException

// DataStore-backed settings — ports src/state/settings.ts (createSettingsStore). The four fields
// are stored as individual preferences (booleans for sound/onboarded, enum names for
// language/camera) so they read the same way as the PWA's JSON-over-defaults. Anything absent or
// unparseable falls back to the Settings() defaults (sound off, not onboarded, front camera).

class SettingsRepository(
    private val dataStore: DataStore<Preferences>,
    scope: CoroutineScope,
) {
    private val languageKey = stringPreferencesKey("language")
    private val soundKey = booleanPreferencesKey("sound")
    private val onboardedKey = booleanPreferencesKey("onboarded")
    private val cameraKey = stringPreferencesKey("camera")
    private val debugKey = booleanPreferencesKey("debug")

    /** The current settings as a StateFlow. Bootstraps with the defaults; the first DataStore read
     *  replaces it. A read error degrades to defaults rather than crashing. */
    val settings: StateFlow<Settings> =
        dataStore.data
            .catch { e ->
                if (e is IOException) emit(emptyPreferences()) else throw e
            }
            .map { prefs -> prefs.toSettings() }
            .stateIn(scope, SharingStarted.Eagerly, Settings())

    private val mutationScope = scope

    private fun Preferences.toSettings(): Settings {
        val defaults = Settings()
        return Settings(
            language = this[languageKey]
                ?.let { runCatching { Language.valueOf(it) }.getOrNull() }
                ?: defaults.language,
            sound = this[soundKey] ?: defaults.sound,
            onboarded = this[onboardedKey] ?: defaults.onboarded,
            camera = this[cameraKey]
                ?.let { runCatching { CameraFacing.valueOf(it) }.getOrNull() }
                ?: defaults.camera,
            debug = this[debugKey] ?: defaults.debug,
        )
    }

    /** Apply a patch over the current settings and persist all four fields — mirrors set(patch). */
    fun set(patch: (Settings) -> Settings) {
        mutationScope.launch {
            dataStore.edit { prefs ->
                val next = patch(prefs.toSettings())
                prefs[languageKey] = next.language.name
                prefs[soundKey] = next.sound
                prefs[onboardedKey] = next.onboarded
                prefs[cameraKey] = next.camera.name
                prefs[debugKey] = next.debug
            }
        }
    }

    fun setSound(sound: Boolean) = set { it.copy(sound = sound) }
    fun setOnboarded(onboarded: Boolean) = set { it.copy(onboarded = onboarded) }
    fun setCamera(camera: CameraFacing) = set { it.copy(camera = camera) }
    fun setDebug(debug: Boolean) = set { it.copy(debug = debug) }
}
