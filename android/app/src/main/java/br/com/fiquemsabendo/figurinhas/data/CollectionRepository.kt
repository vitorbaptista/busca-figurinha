package br.com.fiquemsabendo.figurinhas.data

import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.emptyPreferences
import androidx.datastore.preferences.core.stringSetPreferencesKey
import br.com.fiquemsabendo.figurinhas.scan.OwnedCodes
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import java.io.IOException

// DataStore-backed owned-codes store — ports src/state/collection.ts (createCollectionStore).
// Persists the owned set under a single stringSet preference. Mirrors the PWA semantics: add is a
// no-op if already owned, remove a no-op if absent, toggle flips, setOwned bulk-adds/removes,
// import replaces wholesale, export is sorted.

class CollectionRepository(
    private val dataStore: DataStore<Preferences>,
    scope: CoroutineScope,
) {
    private val ownedKey = stringSetPreferencesKey("owned")

    /** The owned codes, kept hot as a StateFlow so the UI observes changes and the synchronous
     *  has()/size() reads can use .value. Bootstraps with an empty set; the first DataStore read
     *  replaces it asynchronously (the PWA's async IndexedDB load → notify() does the same).
     *  A read error (corrupt store) degrades to empty rather than crashing. */
    val owned: StateFlow<Set<String>> =
        dataStore.data
            .catch { e ->
                if (e is IOException) emit(emptyPreferences()) else throw e
            }
            .map { prefs -> prefs[ownedKey] ?: emptySet() }
            .stateIn(scope, SharingStarted.Eagerly, emptySet())

    /** Launch every mutation on the repository's scope so callers stay synchronous, like the PWA's
     *  fire-and-forget persist(). */
    private val mutationScope = scope

    /** Synchronous membership test reading the current StateFlow snapshot — the OwnedCodes contract
     *  the scan loop calls on every frame must not suspend. */
    fun has(code: String): Boolean = code in owned.value

    /** Current owned count from the StateFlow snapshot. */
    fun size(): Int = owned.value.size

    /** Sorted snapshot for backup/export — mirrors exportOwned(). */
    fun export(): List<String> = owned.value.sorted()

    fun add(code: String) {
        mutationScope.launch {
            dataStore.edit { prefs ->
                prefs[ownedKey] = (prefs[ownedKey] ?: emptySet()) + code
            }
        }
    }

    fun remove(code: String) {
        mutationScope.launch {
            dataStore.edit { prefs ->
                prefs[ownedKey] = (prefs[ownedKey] ?: emptySet()) - code
            }
        }
    }

    fun toggle(code: String) {
        mutationScope.launch {
            dataStore.edit { prefs ->
                val current = prefs[ownedKey] ?: emptySet()
                prefs[ownedKey] = if (code in current) current - code else current + code
            }
        }
    }

    /** Bulk add (owned = true) or remove (owned = false) — mirrors setOwned(codes, owned). */
    fun setOwned(codes: Iterable<String>, owned: Boolean) {
        val delta = codes.toSet()
        if (delta.isEmpty()) return
        mutationScope.launch {
            dataStore.edit { prefs ->
                val current = prefs[ownedKey] ?: emptySet()
                prefs[ownedKey] = if (owned) current + delta else current - delta
            }
        }
    }

    fun clear() {
        mutationScope.launch {
            dataStore.edit { prefs -> prefs.remove(ownedKey) }
        }
    }

    /** Replace the whole owned set (import a backup) — mirrors importOwned(codes). */
    fun import(codes: List<String>) {
        mutationScope.launch {
            dataStore.edit { prefs -> prefs[ownedKey] = codes.toSet() }
        }
    }

    /** Adapt to the scan loop's OwnedCodes port. */
    fun asOwnedCodes(): OwnedCodes = OwnedCodes { has(it) }
}
