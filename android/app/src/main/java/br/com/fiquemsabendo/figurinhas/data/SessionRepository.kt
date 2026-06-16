package br.com.fiquemsabendo.figurinhas.data

import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import br.com.fiquemsabendo.figurinhas.domain.ScanRecord
import kotlinx.coroutines.flow.first

// DataStore-backed in-progress session — ports src/app.tsx loadSession/persistSession/
// clearStoredSession. The whole session is persisted as ONE JSON string (encodeSession) under a
// single key, matching the PWA's localStorage 'session' = JSON.stringify(ScanRecord[]). Loads are
// tolerant: a corrupt or absent value yields an empty list (decodeSession handles the parsing).

class SessionRepository(
    private val dataStore: DataStore<Preferences>,
) {
    private val sessionKey = stringPreferencesKey("session")

    /** The in-progress session, or empty if none/corrupt — mirrors loadSession. */
    suspend fun load(): List<ScanRecord> {
        val raw = dataStore.data.first()[sessionKey] ?: return emptyList()
        return decodeSession(raw)
    }

    /** Persist the current session as JSON — mirrors persistSession. */
    suspend fun save(records: List<ScanRecord>) {
        val encoded = encodeSession(records)
        dataStore.edit { prefs -> prefs[sessionKey] = encoded }
    }

    /** Drop the stored session (after the user committed their picks) — mirrors clearStoredSession. */
    suspend fun clear() {
        dataStore.edit { prefs -> prefs.remove(sessionKey) }
    }
}
