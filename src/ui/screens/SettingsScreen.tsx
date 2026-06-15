import { useState } from 'preact/hooks';
import type { BackupFile, CollectionStore, Settings, SettingsStore } from '../../types';
import { pt } from '../../i18n/pt';
import { useStore } from '../hooks';

interface SettingsScreenProps {
  collection: CollectionStore;
  settings: SettingsStore;
}

const APP_VERSION = '0.1.0';

export function SettingsScreen({ collection, settings }: SettingsScreenProps) {
  useStore(settings);

  const [notice, setNotice] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const current = settings.get();

  const flash = (kind: 'ok' | 'error', text: string) => {
    setNotice({ kind, text });
    window.setTimeout(() => setNotice(null), 3000);
  };

  const onExport = () => {
    const backup: BackupFile = {
      app: 'troca-figurinhas',
      version: 1,
      exportedAt: new Date().toISOString(),
      owned: collection.exportOwned(),
      settings: settings.get(),
    };
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `troca-figurinhas-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const onImport = async (e: Event) => {
    const input = e.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    try {
      const data = JSON.parse(await file.text()) as Partial<BackupFile>;
      if (data.app !== 'troca-figurinhas' || data.version !== 1 || !Array.isArray(data.owned)) {
        throw new Error('invalid');
      }
      collection.importOwned(data.owned);
      if (data.settings) settings.set(data.settings as Partial<Settings>);
      flash('ok', pt.settings.importDone);
    } catch {
      flash('error', pt.settings.importInvalid);
    }
  };

  const onClear = () => {
    if (!confirm(pt.settings.clearConfirm)) return;
    collection.clear();
    flash('ok', pt.settings.clearDone);
  };

  return (
    <div class="screen settings-screen">
      <header class="settings-header">
        <h1>{pt.settings.title}</h1>
      </header>

      {notice && <div class={`settings-notice notice-${notice.kind}`}>{notice.text}</div>}

      <section class="settings-group">
        <h2>{pt.settings.data}</h2>
        <button class="settings-row settings-action" onClick={onExport}>
          <span class="settings-row-emoji">⬇️</span>
          <span class="settings-row-text">
            <b>{pt.settings.export}</b>
            <small>{pt.settings.exportHint}</small>
          </span>
        </button>
        <label class="settings-row settings-action">
          <span class="settings-row-emoji">⬆️</span>
          <span class="settings-row-text">
            <b>{pt.settings.import}</b>
            <small>{pt.settings.importHint}</small>
          </span>
          <input type="file" accept="application/json,.json" hidden onChange={onImport} />
        </label>
      </section>

      <section class="settings-group">
        <div class="settings-row">
          <span class="settings-row-emoji">🔊</span>
          <span class="settings-row-text">
            <b>{pt.settings.sound}</b>
          </span>
          <button
            class={`toggle ${current.sound ? 'is-on' : ''}`}
            role="switch"
            aria-checked={current.sound}
            onClick={() => settings.set({ sound: !current.sound })}
          >
            <span class="toggle-knob" />
          </button>
        </div>
        <button
          class="settings-row settings-action"
          onClick={() => settings.set({ onboarded: false })}
        >
          <span class="settings-row-emoji">📖</span>
          <span class="settings-row-text">
            <b>{pt.settings.tutorial}</b>
          </span>
        </button>
      </section>

      <section class="settings-group settings-danger">
        <h2>{pt.settings.danger}</h2>
        <button class="settings-row settings-action settings-clear" onClick={onClear}>
          <span class="settings-row-emoji">🗑️</span>
          <span class="settings-row-text">
            <b>{pt.settings.clear}</b>
            <small>{pt.settings.clearHint}</small>
          </span>
        </button>
      </section>

      <footer class="settings-footer">
        <p>{pt.settings.version(APP_VERSION)}</p>
        <p>{pt.settings.credit}</p>
      </footer>
    </div>
  );
}
