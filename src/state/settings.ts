import type { Settings, SettingsStore } from '../types';

export const DEFAULT_SETTINGS: Settings = {
  language: 'pt',
  sound: false,
  onboarded: false,
  // Front (screen-side) camera by default: phone flat on the table, sticker back
  // shown to it. The user can switch to the back camera from the scan screen.
  camera: 'front',
  installDismissed: false,
};

export function createSettingsStore(storage: Storage = localStorage, key = 'settings'): SettingsStore {
  const listeners = new Set<() => void>();
  let current = load();

  /** Read stored JSON over the defaults; tolerate missing or corrupt data. */
  function load(): Settings {
    try {
      const raw = storage.getItem(key);
      if (!raw) return { ...DEFAULT_SETTINGS };
      const parsed = JSON.parse(raw) as Partial<Settings>;
      return { ...DEFAULT_SETTINGS, ...parsed };
    } catch {
      return { ...DEFAULT_SETTINGS };
    }
  }

  return {
    ready: Promise.resolve(),
    get: () => current,
    set(patch) {
      current = { ...current, ...patch };
      try {
        storage.setItem(key, JSON.stringify(current));
      } catch {
        // Storage can be unavailable (private mode / disabled). Keep the in-memory
        // value so the UI stays consistent and onboarding can still complete.
      }
      for (const listener of listeners) listener();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
