import { useEffect, useMemo, useState } from 'preact/hooks';
import type { FunctionComponent } from 'preact';
import type { ScanRecord, ScanSession, SessionReport } from './types';
import { checklist } from './data/checklist';
import { createCollectionStore, idbStore } from './state/collection';
import { createSettingsStore } from './state/settings';
import { createSession } from './domain/session';
import { readShareLink, shareTrades } from './domain/share';
import type { TradePayload } from './domain/tradeList';
import { useStore } from './ui/hooks';
import { Nav, type Screen } from './ui/Nav';
import { screenFromHash, sectionUrl } from './ui/routing';
import { Onboarding } from './ui/Onboarding';
import { ScanScreen } from './ui/screens/ScanScreen';
import { ReportScreen } from './ui/screens/ReportScreen';
import { TradeScreen } from './ui/screens/TradeScreen';
import { RepeatsScreen } from './ui/screens/RepeatsScreen';
import { CollectionScreen } from './ui/screens/CollectionScreen';
import { SettingsScreen } from './ui/screens/SettingsScreen';

// Stores are created once at module scope so every screen shares the same state.
const collection = createCollectionStore(idbStore);
// A second code-set store for the user's DUPLICATES (their tradeable spares), persisted
// separately from the owned set so the Trocar offer + sharing keep working any time — not
// only in the brief window between finishing a scan and committing it.
const repeats = createCollectionStore(idbStore, 'repeats');
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

/** A friend who opened a shared ?t= link arrives with their list in the URL. */
function loadFriendPayload(): TradePayload | null {
  if (typeof location === 'undefined') return null;
  return readShareLink(location.search, checklist);
}

// Gated dataset-capture tool, opened with ?capture (same obscurity as ?debug/?record — regular
// users never see it). Lazy-loaded so the capture UI + its deps stay out of the normal bundle.
const CAPTURE =
  typeof location !== 'undefined' && new URLSearchParams(location.search).has('capture');

function CaptureGate() {
  const [Comp, setComp] = useState<FunctionComponent | null>(null);
  useEffect(() => {
    void import('./dev/capture/CaptureScreen').then((m) =>
      setComp(() => m.CaptureScreen as FunctionComponent),
    );
  }, []);
  return Comp ? <Comp /> : <div class="screen">carregando captura…</div>;
}

export function App() {
  useStore(collection);
  useStore(repeats);
  useStore(settings);

  const initialFriendPayload = useMemo(loadFriendPayload, []);
  const [screen, setScreen] = useState<Screen>(() =>
    initialFriendPayload ? 'trade' : screenFromHash(typeof location === 'undefined' ? '' : location.hash),
  );
  const session = useMemo(loadSession, []);
  const [report, setReport] = useState<SessionReport | null>(null);
  const [friendPayload, setFriendPayload] = useState<TradePayload | null>(initialFriendPayload);

  const onboarded = settings.get().onboarded;

  // Mirror the active section into the URL hash so a refresh/shared link restores it, and (once a
  // ?t= friend link has been read into state) strip that query so a reload doesn't re-open the
  // list. replaceState (not assigning location.hash) adds no history entry — switching tabs doesn't
  // pile up Back steps — and doesn't fire `hashchange`, so there's no sync loop. sectionUrl keeps
  // pathname (GH-Pages base) + the ?debug/?capture flags.
  useEffect(() => {
    if (typeof history === 'undefined' || typeof location === 'undefined') return;
    history.replaceState(history.state, '', sectionUrl(location, screen, !!initialFriendPayload));
  }, [screen]);

  /** Build the report, end the current scan session, and move to the report screen. */
  const finishSession = () => {
    const nextReport = session.finish(checklist);
    clearStoredSession();
    setReport(nextReport);
    setScreen('report');
  };

  /** Wipe the session (after the user has committed their picks) and reset to scanning. */
  const resetSession = () => {
    session.clear();
    clearStoredSession();
    setReport(null);
  };

  // Dataset-capture takeover (?capture). All hooks above run unconditionally first, so this
  // conditional return is hook-safe (CAPTURE is constant for the page's lifetime).
  if (CAPTURE) return <CaptureGate />;

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
          onCommitRepeats={(codes) => repeats.setOwned(codes, true)}
          onCommitted={() => {
            resetSession();
            setScreen('collection');
          }}
          onBack={() => setScreen('scan')}
        />
      )}

      {screen === 'collection' && <CollectionScreen collection={collection} />}

      {screen === 'trade' && (
        <TradeScreen
          collection={collection}
          repeats={repeats}
          friendPayload={friendPayload}
          onShare={(payload) => shareTrades(payload, checklist)}
          onClearFriend={() => setFriendPayload(null)}
          onGoScan={() => setScreen('scan')}
          onEditRepeats={() => setScreen('repeats')}
          onEditNeed={() => setScreen('collection')}
        />
      )}

      {screen === 'repeats' && (
        <RepeatsScreen
          collection={collection}
          repeats={repeats}
          onBack={() => setScreen('trade')}
        />
      )}

      {screen === 'settings' && (
        <SettingsScreen collection={collection} repeats={repeats} settings={settings} />
      )}

      <Nav current={screen} onNavigate={setScreen} />

      {/* A friend who arrives via a shared link lands straight on their trade comparison — don't
          bury it behind the intro. The intro still gates the SCANNER (it teaches the show-the-back
          move), so it appears the moment they tap "Escanear". */}
      {!onboarded && !(initialFriendPayload && screen === 'trade') && (
        <Onboarding onDone={() => settings.set({ onboarded: true })} />
      )}
    </div>
  );
}
