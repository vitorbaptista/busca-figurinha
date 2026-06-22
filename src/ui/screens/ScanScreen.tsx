import { useEffect, useRef, useState } from 'preact/hooks';
import type {
  CollectionStore,
  MatchResult,
  ScanOutcome,
  ScanSession,
  SettingsStore,
} from '../../types';
import { pt } from '../../i18n/pt';
import { radarFriendNames } from '../../domain/friendMatch';
import type { FriendListsStore } from '../../state/friendLists';
import { Verdict, type VerdictState } from '../components/Verdict';
import { MultiResult, type ScanResultItem } from '../components/MultiResult';
import { ImportSheet } from '../components/ImportSheet';
import { useScanner } from '../hooks/useScanner';

interface ScanScreenProps {
  session: ScanSession;
  collection: CollectionStore;
  /** The user's tradeable spares — to flag (radar) when a scanned spare serves a saved friend. */
  repeats: CollectionStore;
  /** Saved friend lists — radar source for the "📌 serve pro {nome}" verdict ribbon. */
  friendLists: FriendListsStore;
  /** Wishlist store — the "Preciso" destination when importing a list from the scan sheet. */
  wants: CollectionStore;
  settings: SettingsStore;
  onPersist: () => void;
  onFinish: () => void;
  /** Navigate to the Coleção screen (after a "Tenho" import finishes). */
  onGoToCollection: () => void;
}

// Opt-in debug readout (open with ?debug): shows raw OCR text + matched codes and
// makes tapping the camera trigger an immediate capture. No effect without the flag.
const DEBUG = typeof location !== 'undefined' && new URLSearchParams(location.search).has('debug');
// Recording mode (?record), independent of ?debug: every frame the scanner reads is saved to the
// dev server (./captures) in sequence, so a real scanning session can be replayed/benchmarked
// offline. Off unless explicitly requested — debug must never silently record.
const RECORD = typeof location !== 'undefined' && new URLSearchParams(location.search).has('record');

interface RecentScan {
  id: number;
  outcome: ScanOutcome;
  /** Canonical code, so "Não é essa?" can drop the corrected read from this strip. */
  code: string;
  label: string;
}

export function ScanScreen({
  session,
  collection,
  repeats,
  friendLists,
  wants,
  settings,
  onPersist,
  onFinish,
  onGoToCollection,
}: ScanScreenProps) {
  const multiTimerRef = useRef<number | undefined>(undefined);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const flashCounter = useRef(0);

  const [verdict, setVerdict] = useState<VerdictState | null>(null);
  const [multi, setMulti] = useState<ScanResultItem[] | null>(null);
  const [announce, setAnnounce] = useState('');
  const [counters, setCounters] = useState({ neededCount: 0, repeatedCount: 0 });
  const [recent, setRecent] = useState<RecentScan[]>([]);
  const [showManual, setShowManual] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [manualValue, setManualValue] = useState('');

  // ---------- Result handling shared by all input paths ----------

  /** Route one OR MANY recognized stickers (several backs can be in view at once)
   *  to the verdict card / multi panel, counters, session, and the screen-reader announcer.
   *  A resolved checklist code (exact or autocorrected) is trusted directly — the
   *  match is the confidence signal. We deliberately do NOT gate on Tesseract's
   *  whole-frame mean confidence: the sticker back is full of noisy legal text
   *  that drags that number down and would reject good reads. */
  // Radar: the saved friends a just-scanned spare serves. Reads the stores imperatively at commit time
  // (a verdict is a snapshot — no subscription, no extra re-renders in the hot scan screen) and
  // short-circuits when no friends are saved, so a friendless user pays nothing.
  const radarServesFor = (code: string): string[] => {
    const friends = friendLists.active();
    if (friends.length === 0) return [];
    const myRepeatCodes = new Set([...repeats.codes()].filter((c) => collection.has(c)));
    return radarFriendNames(code, myRepeatCodes, friends);
  };

  const handleMatches = (matches: MatchResult[]) => {
    flashCounter.current += 1;
    const key = flashCounter.current;
    // A toggled zero-width space forces the aria-live region to re-announce even
    // when the same result repeats; it is not spoken by screen readers.
    const zwsp = '​'.repeat(key % 2);

    // Resolve to unique album entries for this capture. Count/record each sticker
    // only ONCE per session — re-capturing the same back (a jiggle, a glare re-arm,
    // or a second copy) still re-flashes for feedback but doesn't double-count.
    const alreadyInSession = new Set(session.records().map((r) => r.code));
    const items: ScanResultItem[] = [];
    const seen = new Set<string>();
    let newNeeded = 0;
    let newOwned = 0;
    for (const match of matches) {
      if (!match.entry || seen.has(match.entry.code)) continue;
      seen.add(match.entry.code);
      const owned = collection.has(match.entry.code);
      items.push({
        code: match.entry.code,
        display: match.entry.display,
        teamName: match.entry.teamName,
        outcome: owned ? 'owned' : 'needed',
      });
      if (!alreadyInSession.has(match.entry.code)) {
        session.add(match, owned);
        if (owned) newOwned++;
        else newNeeded++;
      }
    }

    if (items.length === 0) {
      clearMulti();
      setVerdict({ outcome: 'unknown', code: '', display: '', teamName: '', key });
      setAnnounce(pt.scan.tryAgain + zwsp);
      return;
    }

    onPersist();

    setCounters((c) => ({
      neededCount: c.neededCount + newNeeded,
      repeatedCount: c.repeatedCount + newOwned,
    }));
    setRecent((r) =>
      [
        ...items.map((it, i) => ({
          id: key * 100 + i,
          outcome: it.outcome,
          code: it.code,
          label: it.display,
        })),
        ...r,
      ].slice(0, 12),
    );
    // Radar for the single-verdict case: which saved friends this read serves. Only fires for a real
    // spare (repeats∩owned via radarFriendNames), so a GUARDAR or a single-copy owned read never tells
    // a kid to give it away. Computed once and reused for the spoken announce + the verdict ribbon.
    const serves = items.length === 1 ? radarServesFor(items[0].code) : [];
    setAnnounce(
      items
        .map((it) => `${it.outcome === 'owned' ? pt.scan.owned : pt.scan.needed}: ${it.display}`)
        .join('. ') +
        (serves.length > 0 ? `. ${pt.scan.radarServes(serves)}` : '') +
        zwsp,
    );

    if (items.length === 1) {
      const it = items[0];
      clearMulti();
      setVerdict({
        outcome: it.outcome,
        code: it.code,
        display: it.display,
        teamName: it.teamName,
        serves,
        key,
      });
    } else {
      setVerdict(null);
      showMulti(items);
    }
    const outcome = items.some((it) => it.outcome === 'needed') ? 'needed' : 'owned';
    beep(outcome);
    haptic(outcome);
  };

  /** Multi-sticker panel: shown a bit longer so all rows can be read. */
  const showMulti = (items: ScanResultItem[]) => {
    setMulti(items);
    window.clearTimeout(multiTimerRef.current);
    const ms = Math.min(5000, 1600 + items.length * 500);
    multiTimerRef.current = window.setTimeout(() => setMulti(null), ms);
  };
  const clearMulti = () => {
    window.clearTimeout(multiTimerRef.current);
    setMulti(null);
  };

  /** A short buzz so the result lands even when the phone is on the table and the
   *  user is looking at the sticker, not the screen — the "scanner beeped" feel.
   *  KEEP gets a brighter double pulse, REPEAT a single tap. No-op where unsupported
   *  (iOS); independent of the sound setting since it's the silent feedback. */
  const haptic = (outcome: ScanOutcome) => {
    try {
      navigator.vibrate?.(outcome === 'needed' ? [28, 45, 28] : 22);
    } catch {
      /* vibration unsupported */
    }
  };

  const beep = (outcome: ScanOutcome) => {
    if (!settings.get().sound) return;
    try {
      // One shared AudioContext reused for every beep — creating one per scan
      // exhausts the browser's ~6-context cap and silently kills sound.
      let ctx = audioCtxRef.current;
      if (!ctx) {
        ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        audioCtxRef.current = ctx;
      }
      if (ctx.state === 'suspended') void ctx.resume();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = outcome === 'needed' ? 880 : 330; // bright up vs low down
      gain.gain.value = 0.06;
      osc.connect(gain).connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.12);
    } catch {
      /* audio is best-effort */
    }
  };

  const scanner = useScanner({
    onMatches: handleMatches,
    settings,
    cameraSetting: 'camera',
    debug: DEBUG,
    record: RECORD,
  });

  // Screen-local cleanup for album-only timers (the hook does NOT own these).
  useEffect(() => {
    return () => {
      window.clearTimeout(multiTimerRef.current);
      audioCtxRef.current?.close().catch(() => {});
    };
  }, []);

  // ---------- Manual entry ----------

  const submitManual = (e: Event) => {
    e.preventDefault();
    const value = manualValue.trim();
    if (!value) return;
    scanner.submitManualCode(value);
    setManualValue('');
    setShowManual(false);
  };

  /** "Não é essa?" — the read on screen is wrong. Undo it so a confident misread never
   *  reaches the report: drop the record from the session, uncount it, remove it from the
   *  recent strip, clear the card, then open manual entry to type the right code. The
   *  counter decrement is clamped (the session may hold records from a previous launch
   *  that this run's counters never tallied) and only applied when a record was removed. */
  const handleWrong = () => {
    const v = verdict;
    if (!v || !v.code) return;
    if (session.removeByCode(v.code)) {
      onPersist();
      setCounters((c) => ({
        neededCount: Math.max(0, c.neededCount - (v.outcome === 'needed' ? 1 : 0)),
        repeatedCount: Math.max(0, c.repeatedCount - (v.outcome === 'owned' ? 1 : 0)),
      }));
    }
    // Drop every "Últimas leituras" row for this code: the strip isn't deduped (re-scans prepend
    // fresh rows), and the code is now fully gone from the session, so none should linger.
    setRecent((r) => r.filter((x) => x.code !== v.code));
    setVerdict(null);
    setAnnounce(pt.scan.discarded);
    setShowManual(true);
  };

  // ---------- Render ----------

  return (
    <div class="screen scan-screen">
      {/* Screen-reader / sound-off announcement of each scan result. */}
      <p class="sr-only" role="status" aria-live="assertive">
        {announce}
      </p>

      {/* Album section tab */}
      <div class="pagetab">
        <span class="pagetab-name">{pt.scan.pageTitle}</span>
        <span class="pagetab-pg">{pt.scan.pageSubtitle}</span>
      </div>

      {/* Full-bleed camera. The live <video> is shown ONLY inside the .mira window;
          everything around it is the dark album surface (no fill-light flood). */}
      <div class="cam" onClick={DEBUG ? scanner.captureNow : undefined}>
        <div class="cam-top">
          <div class="counters">
            <div class="chip-count">
              <b>{counters.neededCount}</b>
              <span>{pt.scan.counters.new}</span>
            </div>
            <div class="chip-count dup">
              <b>{counters.repeatedCount}</b>
              <span>{pt.scan.counters.repeated}</span>
            </div>
          </div>
          <div class="cam-top-actions">
            {!session.isEmpty() && (
              <button class="finish-pill" onClick={onFinish}>
                {pt.scan.finish}
              </button>
            )}
            {scanner.cameraState !== 'denied' && (
              <>
                {/* Always-reachable manual entry: the live burst is silent on misses, so the
                    "Não li" card rarely shows — without this a stuck sticker has no escape. */}
                <button
                  class="cam-icon-btn"
                  onClick={() => setShowManual(true)}
                  aria-label={pt.scan.manualEntry}
                  title={pt.scan.manualEntry}
                >
                  📝
                </button>
                <button
                  class="cam-icon-btn"
                  onClick={scanner.flipCamera}
                  aria-label={pt.scan.flipCamera}
                  title={scanner.facing === 'user' ? pt.scan.cameraFront : pt.scan.cameraBack}
                >
                  🔄
                </button>
              </>
            )}
          </div>
        </div>

        {RECORD && (
          <div class="scan-rec" role="status">
            <span class="scan-rec-dot" aria-hidden="true" />
            Gravando · {scanner.debug.recCount}
          </div>
        )}

        {DEBUG && (
          <div class="debug-box">
            {scanner.debug.beat || 'iniciando…'}
            {scanner.debug.text ? ` · ${scanner.debug.text}` : ''}
          </div>
        )}

        {scanner.cameraState !== 'denied' && (
          <div class="mira-wrap">
            <div class={scanner.reading ? 'mira reading' : 'mira'}>
              {/* Camera <video> is appended here imperatively; Preact leaves it alone. */}
              <div class="scan-video-layer" ref={scanner.videoLayerRef} aria-hidden="true" />
              {/* Scanner sweep — the visible "it's reading" signal (mounts fresh each read so
                  the sweep restarts). Reduced-motion turns this into a still glow via CSS. */}
              {scanner.reading && <span class="mira-scan" aria-hidden="true" />}
              <span class="corner tl" aria-hidden="true" />
              <span class="corner tr" aria-hidden="true" />
              <span class="corner bl" aria-hidden="true" />
              <span class="corner br" aria-hidden="true" />
              {scanner.cameraState === 'loading' && <span class="cole">{pt.scan.slotLabel}</span>}
            </div>
            {scanner.ocrReady && !verdict && !multi && (
              <span class={scanner.reading ? 'hint reading' : 'hint'}>
                <span class="pulse" aria-hidden="true" />
                {scanner.reading ? pt.scan.reading : pt.scan.holdStill}
              </span>
            )}
          </div>
        )}

        {scanner.cameraState === 'ready' && !scanner.ocrReady && !scanner.ocrFailed && (
          <div class="scan-overlay">
            <div class="spinner" />
            <p>{pt.scan.preparing(scanner.ocrProgress)}</p>
          </div>
        )}
        {scanner.cameraState === 'ready' && scanner.ocrFailed && (
          <div class="scan-overlay scan-overlay-msg">
            <div class="scan-denied-emoji">📴</div>
            <p>{pt.scan.ocrUnavailable}</p>
            <button class="miss-action" type="button" onClick={() => setShowManual(true)}>
              📝 {pt.scan.manualOpen}
            </button>
          </div>
        )}
        {scanner.cameraState === 'denied' && (
          <div class="scan-overlay scan-denied">
            <div class="scan-denied-emoji">📷</div>
            <h2>{pt.scan.cameraDenied}</h2>
            <p>{pt.scan.cameraDeniedHint}</p>
            <button class="btn btn-primary" onClick={scanner.retryCamera}>
              {pt.scan.retry}
            </button>
          </div>
        )}

        {/* Multi-sticker reads (several backs at once) stay a full-camera overlay panel. */}
        {multi && <MultiResult items={multi} />}

        {/* Bottom dock — recent reads sit above the verdict, both stay visible. */}
        <div class="cam-bottom">
          {recent.length > 0 && (
            <>
              <div class="recent-cap">{pt.scan.recentCap}</div>
              <div class="recent" aria-label={pt.scan.recent}>
                {recent.slice(0, 3).map((r) => (
                  <div key={r.id} class="rd">
                    <div class="rc">{r.label}</div>
                    <div class={r.outcome === 'owned' ? 'rs rep' : 'rs nova'}>
                      {r.outcome === 'owned' ? pt.scan.recentRep : pt.scan.recentNew}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
          {verdict && !multi && (
            <Verdict
              state={verdict}
              onManual={() => setShowManual(true)}
              onWrong={handleWrong}
            />
          )}
        </div>
      </div>

      {showManual && (
        <div class="manual-sheet">
          <form class="manual-form" onSubmit={submitManual}>
            <h2 class="manual-title">{pt.scan.manualEntry}</h2>
            <input
              class="manual-input"
              type="text"
              inputMode="text"
              autocomplete="off"
              autocapitalize="characters"
              placeholder={pt.scan.manualPlaceholder}
              value={manualValue}
              onInput={(e) => setManualValue((e.currentTarget as HTMLInputElement).value)}
              autofocus
            />
            <div class="manual-actions">
              <button
                class="btn btn-ghost"
                type="button"
                onClick={() => setShowManual(false)}
              >
                {pt.scan.manualCancel}
              </button>
              <button class="btn btn-primary" type="submit">
                {pt.scan.manualConfirm}
              </button>
            </div>
            {/* Tertiary: jump to the same "Colar lista" import flow (a paste of many codes),
                a quieter affordance below the type-one-code group. */}
            <button
              class="manual-import"
              type="button"
              onClick={() => {
                setShowManual(false);
                setShowImport(true);
              }}
            >
              📋 {pt.collection.importCta}
            </button>
          </form>
        </div>
      )}

      {showImport && (
        <ImportSheet
          collection={collection}
          repeats={repeats}
          wants={wants}
          onClose={() => setShowImport(false)}
          onSeeCollection={() => {
            setShowImport(false);
            onGoToCollection();
          }}
        />
      )}
    </div>
  );
}
