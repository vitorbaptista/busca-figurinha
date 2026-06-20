import { get, set, del, createStore } from 'idb-keyval';
import type { CollectionStore, KeyValueStore } from '../types';

// Dedicated IndexedDB store so the app's keys don't collide with anything else
// running on the same origin (e.g. the dev server's HMR scratch data).
const store = createStore('troca-figurinhas', 'kv');

/** Persistent KeyValueStore backed by IndexedDB (idb-keyval). */
export const idbStore: KeyValueStore = {
  get: (key) => get(key, store),
  set: (key, value) => set(key, value, store),
  del: (key) => del(key, store),
};

/** In-memory KeyValueStore for tests. */
export function memoryStore(): KeyValueStore {
  const map = new Map<string, unknown>();
  return {
    async get<T>(key: string) {
      return map.get(key) as T | undefined;
    },
    async set<T>(key: string, value: T) {
      map.set(key, value);
    },
    async del(key: string) {
      map.delete(key);
    },
  };
}

export function createCollectionStore(kv: KeyValueStore, key = 'owned'): CollectionStore {
  const owned = new Set<string>();
  const listeners = new Set<() => void>();
  let isLoaded = false;

  const ready = kv.get<string[]>(key).then((stored) => {
    isLoaded = true;
    if (stored && stored.length) {
      for (const code of stored) owned.add(code);
      // Notify so any UI mounted before the async load finishes re-renders with
      // the real collection instead of an empty 0/980.
      notify();
    }
  });

  function notify(): void {
    for (const listener of listeners) listener();
  }

  /** Persist the current set; fire-and-forget so callers stay synchronous. */
  function persist(): void {
    void kv.set(key, [...owned]).catch(() => {
      /* storage may be full/evicted on low-end devices; nothing we can do here. */
    });
  }

  function commit(): void {
    persist();
    notify();
  }

  return {
    ready,
    loaded: () => isLoaded,
    has: (code) => owned.has(code),
    add(code) {
      if (owned.has(code)) return;
      owned.add(code);
      commit();
    },
    remove(code) {
      if (!owned.delete(code)) return;
      commit();
    },
    toggle(code) {
      if (owned.has(code)) owned.delete(code);
      else owned.add(code);
      commit();
    },
    setOwned(codes, isOwned) {
      let changed = false;
      for (const code of codes) {
        if (isOwned) {
          if (!owned.has(code)) {
            owned.add(code);
            changed = true;
          }
        } else if (owned.delete(code)) {
          changed = true;
        }
      }
      if (changed) commit();
    },
    codes: () => new Set(owned),
    size: () => owned.size,
    clear() {
      if (owned.size === 0) return;
      owned.clear();
      commit();
    },
    exportOwned: () => [...owned].sort(),
    importOwned(codes) {
      owned.clear();
      for (const code of codes) owned.add(code);
      commit();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
