import { useRef, useState } from 'preact/hooks';
import type { CollectionStore, MatchResult, SettingsStore } from '../../types';
import { pt } from '../../i18n/pt';
import { friendsNeeding, huntVerdict } from '../../domain/friendMatch';
import type { FriendListsStore } from '../../state/friendLists';
import type { PileSession } from '../../domain/pileSession';
import { useScanner } from '../hooks/useScanner';
import { ScanShell } from '../components/ScanShell';
import { ConferirVerdict, type ConferirVerdictState } from '../components/ConferirVerdict';

interface ConferirScreenProps {
  /** Read-only: PRECISO/JÁ TENHO comes from collection.has(code). Never written here (only the
   *  finish step writes). */
  collection: CollectionStore;
  /** Read-only: friends a scanned sticker serves (friendsNeeding, NOT spare-gated — it's THEIR sticker). */
  friendLists: FriendListsStore;
  settings: SettingsStore;
  /** The lifted pile accumulator; live reads are recorded here, the finish step reads it. */
  pileSession: PileSession;
  /** "Terminar" → build the report + route to the finish step (owned by app.tsx). */
  onFinish: () => void;
  onBack: () => void;
}

/**
 * "Conferir figurinhas" — show the OTHER person's stickers to the camera while trading. Per read:
 * PEGA! (você precisa) / PEGA PRO {amigo} / JÁ TENHO (pode deixar). Pure live scanning now: it shares
 * the album scanner's engine (useScanner) and chrome (ScanShell), and accumulates into the lifted
 * pileSession. The post-scan actions (review takes → save, share the pile) live in the "Terminar"
 * finish step (ConferirReportScreen), reached by the Terminar pill — symmetric to Escanear's report.
 */
export function ConferirScreen({
  collection,
  friendLists,
  settings,
  pileSession,
  onFinish,
  onBack,
}: ConferirScreenProps) {
  const [verdict, setVerdict] = useState<ConferirVerdictState | null>(null);
  const [announce, setAnnounce] = useState('');
  const [showManual, setShowManual] = useState(false);
  // A monotonic tick bumped on each NEW read so the chips re-read the (non-reactive) pileSession.
  const [, bumpTally] = useState(0);
  const flashCounterRef = useRef(0);

  // READ-ONLY result handling: compute a verdict, record into the pile, persist nothing here.
  const handleMatch = (matches: MatchResult[]) => {
    flashCounterRef.current += 1;
    const key = flashCounterRef.current;
    const zwsp = '​'.repeat(key % 2);

    // One sticker at a time (you check the pile one by one). Take the first resolved entry.
    const entry = matches.find((m) => m.entry)?.entry ?? null;
    if (!entry) {
      setVerdict({ kind: 'unknown', display: '', teamName: '', forFriends: [], key });
      setAnnounce(pt.scan.tryAgain + zwsp);
      return;
    }
    const owned = collection.has(entry.code);
    const friendNames = friendsNeeding(entry.code, friendLists.active());
    const v = huntVerdict({ owned, friendNames });
    setVerdict({ kind: v.kind, display: entry.display, teamName: entry.teamName, forFriends: v.forFriends, key });
    if (pileSession.add(entry, v.kind)) bumpTally((n) => n + 1);
    const who =
      v.kind === 'take-mine'
        ? pt.conferir.takeWord + ' ' + pt.conferir.takeMineSub
        : v.kind === 'take-friends'
          ? pt.conferir.takeWord + ' ' + pt.scan.radarServes(v.forFriends)
          : pt.conferir.skipWord + ' ' + pt.conferir.skipSub;
    setAnnounce(`${entry.display}: ${who}${zwsp}`);
  };

  const scanner = useScanner({
    onMatches: handleMatch,
    settings,
    cameraSetting: 'conferirCamera',
  });

  const mineCount = pileSession.takenForMe().length;
  const friendsCount = pileSession.takenForFriends().length;
  const hasScanned = pileSession.wholePile().length > 0;

  return (
    <ScanShell
      rootClass="conferir-screen"
      pageTitle={pt.conferir.pageTitle}
      pageSubtitle={pt.conferir.pageSubtitle}
      announce={announce}
      holdStillText={pt.conferir.holdStill}
      cameraState={scanner.cameraState}
      ocrReady={scanner.ocrReady}
      ocrFailed={scanner.ocrFailed}
      ocrProgress={scanner.ocrProgress}
      reading={scanner.reading}
      hideHint={!!verdict}
      facing={scanner.facing}
      videoLayerRef={scanner.videoLayerRef}
      onFlip={scanner.flipCamera}
      onRetry={scanner.retryCamera}
      manualOpen={showManual}
      setManualOpen={setShowManual}
      onManualSubmit={(v) => scanner.submitManualCode(v)}
      topLeft={
        <div class="conferir-top-left">
          <button class="cam-icon-btn" onClick={onBack} aria-label={pt.conferir.back} title={pt.conferir.back}>
            ←
          </button>
          <div class="counters">
            <div class="chip-count">
              <b>{mineCount}</b>
              <span>{pt.conferir.counterMine}</span>
            </div>
            {friendsCount > 0 && (
              <div class="chip-count dup">
                <b>{friendsCount}</b>
                <span>{pt.conferir.counterFriends}</span>
              </div>
            )}
          </div>
        </div>
      }
      finishAction={
        hasScanned && (
          <button class="finish-pill" onClick={onFinish}>
            {pt.scan.finish}
          </button>
        )
      }
      bottom={verdict && <ConferirVerdict state={verdict} onManual={() => setShowManual(true)} />}
    />
  );
}
