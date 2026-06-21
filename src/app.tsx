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
import { InstallPrompt } from './ui/InstallPrompt';
import { usePwaInstall } from './ui/usePwaInstall';
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
// A wishlist set: codes the user WANTS, seeded by tapping a friend's spares on a shared link (and
// shareable/persisted like repeats). No 0-FP risk — wanting a sticker can never offer a wrong trade.
const wants = createCollectionStore(idbStore, 'wants');
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
  useStore(wants);
  useStore(settings);

  const initialFriendPayload = useMemo(loadFriendPayload, []);
  const [screen, setScreen] = useState<Screen>(() =>
    initialFriendPayload ? 'trade' : screenFromHash(typeof location === 'undefined' ? '' : location.hash),
  );
  const session = useMemo(loadSession, []);
  const [report, setReport] = useState<SessionReport | null>(null);
  const [friendPayload, setFriendPayload] = useState<TradePayload | null>(initialFriendPayload);

  // PWA install flow. The hook lives here at the root because `beforeinstallprompt` fires early
  // (before lazily-mounted screens exist); its result is passed down to Ajustes. `installOpen`
  // is 'auto' (the one-time nudge) or 'manual' (reopened from Ajustes) so dismiss can differ.
  const pwa = usePwaInstall();
  const [installOpen, setInstallOpen] = useState<'auto' | 'manual' | null>(null);

  const onboarded = settings.get().onboarded;
  const installDismissed = settings.get().installDismissed;

  // Mirror the active section into the URL hash so a refresh/shared link restores it, and (once a
  // ?t= friend link has been read into state) strip that query so a reload doesn't re-open the
  // list. replaceState (not assigning location.hash) adds no history entry — switching tabs doesn't
  // pile up Back steps — and doesn't fire `hashchange`, so there's no sync loop. sectionUrl keeps
  // pathname (GH-Pages base) + the ?debug/?capture flags.
  useEffect(() => {
    if (typeof history === 'undefined' || typeof location === 'undefined') return;
    history.replaceState(history.state, '', sectionUrl(location, screen, !!initialFriendPayload));
  }, [screen]);

  // Auto-show the install nudge once, after onboarding, when the app is actually installable and
  // hasn't been dismissed. NOT on the scan screen — that's the camera surface, where an overlay
  // would fight the permission prompt and interrupt scanning; the nudge waits for an idle moment
  // (any other tab). `?? 'auto'` never clobbers a 'manual' open already in progress.
  useEffect(() => {
    if (onboarded && !installDismissed && !pwa.isStandalone && pwa.invite !== 'none' && screen !== 'scan') {
      setInstallOpen((cur) => cur ?? 'auto');
    }
  }, [onboarded, installDismissed, pwa.isStandalone, pwa.invite, screen]);

  /** Close the install sheet and stop auto-nagging — once the user has seen the invite (whether
   *  the auto nudge or one they opened from Ajustes), don't pop it again. They can still install
   *  any time from the Ajustes row, which ignores `installDismissed`. */
  const closeInstall = () => {
    settings.set({ installDismissed: true });
    setInstallOpen(null);
  };

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
          wants={wants}
          settings={settings}
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
        <SettingsScreen
          collection={collection}
          repeats={repeats}
          wants={wants}
          settings={settings}
          installInvite={pwa.invite}
          isStandalone={pwa.isStandalone}
          onOpenInstall={() => setInstallOpen('manual')}
        />
      )}

      {/* Hide the bottom nav while a friend's shared list is open: the receiver has no tabs to use
          mid-flow, and dropping it recovers ~48px on a 320px screen. It returns once they clear the
          friend (← Ver minha lista) or navigate away. */}
      {!(friendPayload && screen === 'trade') && <Nav current={screen} onNavigate={setScreen} />}

      {/* A friend who arrives via a shared link lands straight on their trade comparison — don't
          bury it behind the intro. The intro still gates the SCANNER (it teaches the show-the-back
          move), so it appears the moment they tap "Escanear". */}
      {!onboarded && !(initialFriendPayload && screen === 'trade') && (
        <Onboarding onDone={() => settings.set({ onboarded: true })} />
      )}

      {/* Install nudge. Only once onboarded and actually installable; hidden behind a friend's
          shared list (same as the nav). `kind` is the capability the hook resolved. */}
      {installOpen && onboarded && pwa.invite !== 'none' && !(friendPayload && screen === 'trade') && (
        <InstallPrompt
          kind={pwa.invite === 'ios-steps' ? 'ios-steps' : 'prompt'}
          onInstall={() => void pwa.promptInstall().then(closeInstall)}
          onDismiss={closeInstall}
        />
      )}
    </div>
  );
}
