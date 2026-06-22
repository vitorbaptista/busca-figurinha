import { useEffect, useMemo, useState } from 'preact/hooks';
import type { FunctionComponent } from 'preact';
import type { ScanRecord, ScanSession, SessionReport } from './types';
import { checklist } from './data/checklist';
import { createCollectionStore, idbStore } from './state/collection';
import { createFriendListsStore } from './state/friendLists';
import { createSettingsStore } from './state/settings';
import { createSession } from './domain/session';
import { readShareLink, shareTrades } from './domain/share';
import { readPilePayload } from './domain/pileShare';
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
import { ConferirScreen } from './ui/screens/ConferirScreen';
import { PileImportSheet } from './ui/components/PileImportSheet';
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
// Saved friend lists (what OTHER people need), to find trades for them — separate from your own
// collection. Codes are canonicalized at the store boundary against the album.
const friendLists = createFriendListsStore(idbStore, checklist);
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

/** Someone who opened a scanned-pile ?p= link arrives with the codes to import into THEIR álbum.
 *  The trade ?t= link wins if both are somehow present (they never are — a link carries one). */
function loadPilePayload(): { codes: string[]; name?: string } | null {
  if (typeof location === 'undefined') return null;
  if (readShareLink(location.search, checklist)) return null;
  return readPilePayload(location.search, checklist);
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
  useStore(friendLists);
  useStore(settings);

  const initialFriendPayload = useMemo(loadFriendPayload, []);
  const [screen, setScreen] = useState<Screen>(() =>
    initialFriendPayload ? 'trade' : screenFromHash(typeof location === 'undefined' ? '' : location.hash),
  );
  const session = useMemo(loadSession, []);
  const [report, setReport] = useState<SessionReport | null>(null);
  const [friendPayload, setFriendPayload] = useState<TradePayload | null>(initialFriendPayload);
  // A scanned-pile ?p= link (a friend scanned my pile) → import the codes into MY álbum + repetidas.
  const initialPilePayload = useMemo(loadPilePayload, []);
  const [pilePayload, setPilePayload] = useState(initialPilePayload);

  // PWA install flow. The hook lives here at the root because `beforeinstallprompt` fires early
  // (before lazily-mounted screens exist); its result is passed down to Ajustes — installing is
  // OPT-IN from there, never auto-prompted. `iosStepsOpen` toggles the iOS instructions sheet
  // (Android installs straight from the OS dialog, with no sheet of ours).
  const pwa = usePwaInstall();
  const [iosStepsOpen, setIosStepsOpen] = useState(false);

  const onboarded = settings.get().onboarded;

  // Mirror the active section into the URL hash so a refresh/shared link restores it, and (once a
  // ?t= friend link has been read into state) strip that query so a reload doesn't re-open the
  // list. replaceState (not assigning location.hash) adds no history entry — switching tabs doesn't
  // pile up Back steps — and doesn't fire `hashchange`, so there's no sync loop. sectionUrl keeps
  // pathname (GH-Pages base) + the ?debug/?capture flags.
  useEffect(() => {
    if (typeof history === 'undefined' || typeof location === 'undefined') return;
    // Drop the query once a ?t= friend link OR a ?p= pile link has been read into state, so a
    // reload/back doesn't re-open it. Same single-writer replaceState — no second history site.
    const dropQuery = !!initialFriendPayload || !!initialPilePayload;
    history.replaceState(history.state, '', sectionUrl(location, screen, dropQuery));
  }, [screen]);

  /** Install is opt-in from Ajustes (never auto-prompted). Android (a stashed prompt event) goes
   *  straight to the native OS install dialog; iOS Safari has no such API, so we show the manual
   *  "Compartilhar → Adicionar à Tela de Início" steps in a sheet. */
  const openInstall = () => {
    if (pwa.invite === 'prompt') void pwa.promptInstall();
    else if (pwa.invite === 'ios-steps') setIosStepsOpen(true);
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
          repeats={repeats}
          friendLists={friendLists}
          wants={wants}
          settings={settings}
          onPersist={() => persistSession(session)}
          onFinish={finishSession}
          onGoToCollection={() => setScreen('collection')}
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

      {screen === 'collection' && (
        <CollectionScreen collection={collection} repeats={repeats} wants={wants} />
      )}

      {screen === 'trade' && (
        <TradeScreen
          collection={collection}
          repeats={repeats}
          wants={wants}
          settings={settings}
          friendLists={friendLists}
          friendPayload={friendPayload}
          onShare={(payload) => shareTrades(payload, checklist)}
          onClearFriend={() => setFriendPayload(null)}
          onGoScan={() => setScreen('scan')}
          onConferir={() => setScreen('conferir')}
          onEditRepeats={() => setScreen('repeats')}
          onEditNeed={() => setScreen('collection')}
        />
      )}

      {screen === 'conferir' && (
        <ConferirScreen
          collection={collection}
          friendLists={friendLists}
          settings={settings}
          onBack={() => setScreen('trade')}
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
          friendLists={friendLists}
          settings={settings}
          installInvite={pwa.invite}
          isStandalone={pwa.isStandalone}
          onOpenInstall={openInstall}
        />
      )}

      {/* Hide the bottom nav while a friend's shared list is open: the receiver has no tabs to use
          mid-flow, and dropping it recovers ~48px on a 320px screen. It returns once they clear the
          friend (← Ver minha lista) or navigate away. */}
      {!(friendPayload && screen === 'trade') && <Nav current={screen} onNavigate={setScreen} />}

      {/* A friend who arrives via a shared link lands straight on their trade comparison — don't
          bury it behind the intro. The intro still gates the SCANNER (it teaches the show-the-back
          move), so it appears the moment they tap "Escanear". */}
      {!onboarded && !(initialFriendPayload && screen === 'trade') && !initialPilePayload && (
        <Onboarding onDone={() => settings.set({ onboarded: true })} />
      )}

      {/* iOS-only install instructions, opened on demand from Ajustes (never auto-shown). */}
      {iosStepsOpen && pwa.invite === 'ios-steps' && (
        <InstallPrompt onClose={() => setIosStepsOpen(false)} />
      )}

      {/* Receiving end: a friend opened a ?p= link of a pile someone scanned for them. Import it
          (with consent) into their own álbum + repetidas. Bypasses onboarding so it shows first. */}
      {pilePayload && (
        <PileImportSheet
          codes={pilePayload.codes}
          fromName={pilePayload.name}
          collection={collection}
          repeats={repeats}
          onClose={() => {
            // Land on Coleção — shows the just-imported stickers ("Ver minha coleção"), and gives a
            // brand-new receiver a calm first screen instead of the camera-permission prompt.
            setPilePayload(null);
            setScreen('collection');
          }}
        />
      )}
    </div>
  );
}
