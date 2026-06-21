import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createSettingsStore, DEFAULT_SETTINGS } from './settings';

const KEY = 'settings';

/** Hermetic in-memory Storage so the tests don't depend on the jsdom global. */
function createMemoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (key: string) => (map.has(key) ? map.get(key)! : null),
    key: (index: number) => [...map.keys()][index] ?? null,
    removeItem: (key: string) => void map.delete(key),
    setItem: (key: string, value: string) => void map.set(key, String(value)),
  } as Storage;
}

describe('createSettingsStore', () => {
  let storage: Storage;

  beforeEach(() => {
    storage = createMemoryStorage();
  });

  it('returns defaults when nothing is stored', () => {
    const store = createSettingsStore(storage, KEY);
    expect(store.get()).toEqual(DEFAULT_SETTINGS);
  });

  it('set merges a patch, persists, and reloads', () => {
    const store = createSettingsStore(storage, KEY);
    store.set({ sound: true });
    expect(store.get()).toEqual({ ...DEFAULT_SETTINGS, sound: true });

    // A fresh store over the same storage sees the persisted value.
    const reloaded = createSettingsStore(storage, KEY);
    expect(reloaded.get().sound).toBe(true);
    expect(reloaded.get().onboarded).toBe(false);
  });

  it('tolerates malformed stored JSON by falling back to defaults', () => {
    storage.setItem(KEY, '{not valid json');
    const store = createSettingsStore(storage, KEY);
    expect(store.get()).toEqual(DEFAULT_SETTINGS);
  });

  it('merges partial stored JSON over defaults', () => {
    storage.setItem(KEY, JSON.stringify({ onboarded: true }));
    const store = createSettingsStore(storage, KEY);
    expect(store.get()).toEqual({ ...DEFAULT_SETTINGS, onboarded: true });
  });

  it('subscribe fires on set and unsubscribe stops it', () => {
    const store = createSettingsStore(storage, KEY);
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);

    store.set({ onboarded: true });
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
    store.set({ sound: true });
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('ready resolves immediately', async () => {
    const store = createSettingsStore(storage, KEY);
    await expect(store.ready).resolves.toBeUndefined();
  });
});
