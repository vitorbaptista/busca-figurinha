package br.com.fiquemsabendo.figurinhas.data

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.preferencesDataStore

// The ONLY Android-coupled glue in the persistence layer: three Preferences DataStores backing the
// collection, settings, and in-progress session. Each is a distinct file so they can't collide
// (mirrors the PWA's separate IndexedDB store + localStorage keys). The repositories take a
// DataStore<Preferences> in their constructors, so they stay testable; the app wires these in.

val Context.collectionDataStore: DataStore<Preferences> by preferencesDataStore(name = "collection")
val Context.settingsDataStore: DataStore<Preferences> by preferencesDataStore(name = "settings")
val Context.sessionDataStore: DataStore<Preferences> by preferencesDataStore(name = "session")
