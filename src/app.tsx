import { useMemo, useState } from 'preact/hooks';
import type { ScanRecord, ScanSession, SessionReport } from './types';
import { checklist } from './data/checklist';
import { createCollectionStore, idbStore } from './state/collection';
import { createSettingsStore } from './state/settings';
import { createSession } from './domain/session';
import { useStore } from './ui/hooks';
import { Nav, type Screen } from './ui/Nav';
import { Onboarding } from './ui/Onboarding';
import { ScanScreen } from './ui/screens/ScanScreen';
import { ReportScreen } from './ui/screens/ReportScreen';
import { CollectionScreen } from './ui/screens/CollectionScreen';
import { SettingsScreen } from './ui/screens/SettingsScreen';

// Stores are created once at module scope so every screen shares the same state.
const collection = createCollectionStore(idbStore);
const settings = createSettingsStore();

const SESSION_KEY = 'session';

/** Load any session that was in progress when the app was last closed. */
function loadSession(): ScanSession {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (raw) {
      const records = JSON.parse(raw) as ScanRecord[];
      if (Array.isArray(records)) return createSession(records);
    }
  } catch {
    // Corrupt/absent session — start fresh.
  }
  return createSession();
}

function persistSession(session: ScanSession): void {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session.toJSON()));
  } catch {
    // Storage full or unavailable — non-fatal, the session just won't survive a reload.
  }
}

function clearStoredSession(): void {
  try {
    localStorage.removeItem(SESSION_KEY);
  } catch {
    /* ignore */
  }
}

export function App() {
  useStore(collection);
  useStore(settings);

  const [screen, setScreen] = useState<Screen>('scan');
  const session = useMemo(loadSession, []);
  const [report, setReport] = useState<SessionReport | null>(null);

  const onboarded = settings.get().onboarded;

  /** Build the report from the current session and move to the report screen. */
  const finishSession = () => {
    setReport(session.report(checklist));
    setScreen('report');
  };

  /** Wipe the session (after the user has committed their picks) and reset to scanning. */
  const resetSession = () => {
    session.clear();
    clearStoredSession();
    setReport(null);
  };

  return (
    <div class="app">
      {/* Mount the scanner only after onboarding so the camera permission prompt
          appears when the user actually starts scanning, not behind the intro. */}
      {screen === 'scan' && onboarded && (
        <ScanScreen
          session={session}
          collection={collection}
          settings={settings}
          onPersist={() => persistSession(session)}
          onFinish={finishSession}
        />
      )}

      {screen === 'report' && report && (
        <ReportScreen
          report={report}
          collection={collection}
          onCommitted={() => {
            resetSession();
            setScreen('collection');
          }}
          onBack={() => setScreen('scan')}
        />
      )}

      {screen === 'collection' && <CollectionScreen collection={collection} />}

      {screen === 'settings' && (
        <SettingsScreen collection={collection} settings={settings} />
      )}

      <Nav current={screen} onNavigate={setScreen} />

      {!onboarded && <Onboarding onDone={() => settings.set({ onboarded: true })} />}
    </div>
  );
}
