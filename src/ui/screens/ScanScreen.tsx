import { useEffect, useRef, useState } from 'preact/hooks';
import type {
  AutoCapture,
  CaptureResult,
  CollectionStore,
  MatchResult,
  OcrEngine,
  ScanOutcome,
  ScanSession,
  SettingsStore,
} from '../../types';
import { CONFIG } from '../../config';
import { checklist } from '../../data/checklist';
import { pt } from '../../i18n/pt';
import { matchCode } from '../../domain/matching';
import { radarFriendNames } from '../../domain/friendMatch';
import type { FriendListsStore } from '../../state/friendLists';
import { createConfirmer } from '../../domain/confirm';
import { allowCommit } from '../../domain/commitGate';
import { createHybridOcrEngine as createOcrEngine } from '../../ocr/hybridEngine';
import { createCameraSource } from '../../ocr/frameSource';
import { useRoiViewport } from '../hooks/useRoiViewport';
import { recognizeFrameInOrder, recognizeFrameCodeNet } from '../../ocr/recognize';
import type { CodeNet } from '../../ocr/codeNetEngine';
import { createAutoCapture } from '../../ocr/autoCapture';
import { createScreenWakeLock } from '../wakeLock';
import { Verdict, type VerdictState } from '../components/Verdict';
import { MultiResult, type ScanResultItem } from '../components/MultiResult';
import { ImportSheet } from '../components/ImportSheet';

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

type CameraState = 'loading' | 'ready' | 'denied';

interface RecentScan {
  id: number;
  outcome: ScanOutcome;
  /** Canonical code, so "Não é essa?" can drop the corrected read from this strip. */
  code: string;
  label: string;
}

// Coarse, user-facing capture phase (derived from the autoCapture heartbeat). `reading`
// covers "sticker held + OCR burst in flight" — what the scanner-sweep on the mira shows.
type ScanPhase = 'idle' | 'reading';

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
  // Dedicated, Preact-untouched layer for the <video>. Preact never renders
  // children into it, so mounting the camera element by hand is safe.
  const videoLayerRef = useRef<HTMLDivElement>(null);
  const ocrRef = useRef<OcrEngine | null>(null);
  const ocrInitRef = useRef<Promise<boolean> | null>(null);
  // Neural recognizer (codeNet), lazy-loaded in the background; the ensemble cascade uses it
  // once ready and falls back to the hybrid alone until then / if it fails to load.
  const codeNetRef = useRef<CodeNet | null>(null);
  const sourceRef = useRef<ReturnType<typeof createCameraSource> | null>(null);
  const captureRef = useRef<AutoCapture | null>(null);
  const multiTimerRef = useRef<number | undefined>(undefined);
  // Serializes every OCR call (auto-capture, manual share one worker) so a
  // user-triggered read is queued behind a live one instead of being dropped.
  const recognizeChainRef = useRef<Promise<void>>(Promise.resolve());
  // ?record: running count of saved frames, for ordered filenames (rec-0000.jpg, …).
  const recSeqRef = useRef(0);
  // Per-sticker agreement across the burst of frames; reset when a new sticker settles.
  const confirmerRef = useRef(createConfirmer(CONFIG.match.confirmations));
  // When the last live code committed — a guard so a "new" code sooner than minRecaptureMs
  // (the deliberate inter-scan pace) is dropped as bogus.
  const lastCommitAtRef = useRef(0);
  // Whether the current burst (one sticker hold) has already committed a code. The commit
  // cooldown gates only a burst's FIRST commit, so co-present stickers that confirm a frame
  // later in the SAME hold aren't dropped as a same-sticker re-trigger. Reset on burst start.
  const committedThisBurstRef = useRef(false);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const flashCounter = useRef(0);

  const [cameraState, setCameraState] = useState<CameraState>('loading');
  const [ocrProgress, setOcrProgress] = useState(0);
  const [ocrReady, setOcrReady] = useState(false);
  const [ocrFailed, setOcrFailed] = useState(false);
  const [verdict, setVerdict] = useState<VerdictState | null>(null);
  const [multi, setMulti] = useState<ScanResultItem[] | null>(null);
  const [announce, setAnnounce] = useState('');
  const [counters, setCounters] = useState({ neededCount: 0, repeatedCount: 0 });
  const [recent, setRecent] = useState<RecentScan[]>([]);
  const [facing, setFacing] = useState<'user' | 'environment'>(
    settings.get().camera === 'back' ? 'environment' : 'user',
  );
  const [showManual, setShowManual] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [manualValue, setManualValue] = useState('');
  const [debugText, setDebugText] = useState('');
  // Live "is it reading?" state for the normal (non-debug) UI — drives the mira scanner
  // sweep. Deduped via a ref so the per-tick heartbeat only re-renders on a real change.
  const [scanPhase, setScanPhase] = useState<ScanPhase>('idle');
  const scanPhaseRef = useRef<ScanPhase>('idle');
  // Debug-only capture-loop heartbeat (a rotating spinner proves the loop is ticking).
  const [beat, setBeat] = useState('');
  // ?record: how many frames have been saved this session (shown in the REC badge).
  const [recCount, setRecCount] = useState(0);

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

  /** Create + initialize the OCR engine exactly once. Resolves true when ready.
   *  Decoupled from the camera so OCR can initialize independently of the stream. */
  const ensureOcr = (): Promise<boolean> => {
    if (ocrInitRef.current) return ocrInitRef.current;
    const engine = createOcrEngine();
    ocrRef.current = engine;
    setOcrFailed(false);
    // Lazy-load the neural recognizer in the background (dynamic import keeps tfjs + the model
    // out of the initial bundle). It's OPTIONAL: until it's ready (or if it fails), the scanner
    // uses the hybrid alone; once ready, recognizeCanvas runs the ensemble cascade.
    if (!codeNetRef.current) {
      import('../../ocr/codeNetEngine')
        .then(({ createCodeNet }) => {
          const cn = createCodeNet(checklist);
          return cn.init(import.meta.env.BASE_URL + 'models/codenet/model.json').then(() => {
            codeNetRef.current = cn;
          });
        })
        .catch(() => {
          /* codeNet unavailable (offline first-load, slow net, etc.) → hybrid-only */
        });
    }
    // Race init against a timeout so a blocked/slow CDN (school/kid networks) can't
    // hang the "preparing" spinner forever — we fall back to manual entry instead.
    const init = engine.init((ratio) => setOcrProgress(Math.round(ratio * 100))).then(() => true);
    const timeout = new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 25000));
    ocrInitRef.current = Promise.race([init, timeout])
      .then((ok) => {
        if (!ok) throw new Error('ocr-init-timeout');
        setOcrReady(true);
        return true;
      })
      .catch(() => {
        ocrRef.current = null;
        ocrInitRef.current = null;
        setOcrReady(false);
        setOcrFailed(true);
        return false;
      });
    return ocrInitRef.current;
  };

  /**
   * Recognize a drawn canvas, serialized so concurrent reads queue (one worker).
   * `confirm` (the live burst) only commits a code once the multi-frame confirmer
   * agrees, and stays silent on a miss so empty frames don't spam "try again".
   * `!confirm` (an explicit debug tap) commits a single read and does report a miss.
   * Resolves a CaptureResult so the capture loop knows whether a code committed (lock),
   * a sticker was merely detected (keep trying), or nothing was in view (idle).
   */
  const recognizeCanvas = (
    canvas: HTMLCanvasElement,
    opts: { confirm: boolean; silent: boolean },
  ): Promise<CaptureResult> => {
    const idle: CaptureResult = { stop: false, committed: false, detected: false };
    const job = recognizeChainRef.current.then(async (): Promise<CaptureResult> => {
      const ready = await ensureOcr();
      const ocr = ocrRef.current;
      if (!ready || !ocr) return idle;
      try {
        if (RECORD) {
          postDebugImg('rec-' + String(recSeqRef.current++).padStart(4, '0'), canvas);
          setRecCount(recSeqRef.current);
        } else if (DEBUG) {
          postDebugImg('pixel-' + Date.now(), canvas);
        }
        // Yield once so the camera preview can paint before the synchronous
        // detection work (cheap, but avoids a dropped frame on low-end phones).
        await new Promise((r) => setTimeout(r, 0));
        // Locate the printed code box(es) and OCR only those crops — far faster and
        // more accurate than the whole frame. The boxes come back sorted best-first (the
        // real code pill scores highest), and recognizeFrameInOrder OCRs their crops in
        // that order ONE AT A TIME: a box's 180° flip crop is skipped once its upright crop
        // resolves, and in the live burst (stopOnFirstCode) the whole frame stops at the
        // first resolved code — the prominent pill is box[0], so a clean frame costs ONE
        // OCR instead of ~11. The cross-frame confirmer still gathers every sticker in a
        // multi-sticker hold as the burst progresses; the single-shot debug-tap path keeps
        // stopOnFirstCode=false so one static frame of several backs surfaces them all.
        // Ensemble cascade: the neural codeNet (reads the RAW grayscale crop, strong on the
        // low-contrast pills) runs first; the classical hybrid is the fallback only when codeNet
        // resolves nothing — combining their complementary hits. Both are 0-FP-gated. Until
        // codeNet finishes loading (or if it failed), this is the hybrid alone.
        const cn = codeNetRef.current;
        let out = cn?.ready()
          ? await recognizeFrameCodeNet(cn, canvas, checklist, /* stopOnFirstCode */ opts.confirm)
          : await recognizeFrameInOrder(ocr, canvas, checklist, opts.confirm);
        if (cn?.ready() && out.resolved.length === 0) {
          out = await recognizeFrameInOrder(ocr, canvas, checklist, opts.confirm);
        }
        const { resolved, reads, crops } = out;
        const rawText = reads.join(' | ');

        // Live burst: only act on codes that agree across frames. Single shot: trust
        // the one read (there is no next frame to confirm against).
        let toCommit = resolved;
        let stopBurst = true; // single shot: always "done" after one read
        if (opts.confirm) {
          const newly = confirmerRef.current.add(resolved.map((m) => m.entry!.code));
          const ok = new Set(newly);
          toCommit = resolved.filter((m) => ok.has(m.entry!.code));
          // Keep bursting as long as new codes are still confirming — this lets every
          // sticker in a multi-sticker frame reach the threshold instead of stopping
          // on whichever one confirmed first. Stop one frame after the last
          // confirmation (nothing new AND we've committed at least one).
          stopBurst = confirmerRef.current.committedCount() > 0 && newly.length === 0;

          // Commit cooldown (minRecaptureMs): a FRESH hold committing sooner than the inter-scan
          // pace after the last commit is almost certainly the SAME sticker re-triggering — drop
          // it. But a second code confirmed LATER IN THE SAME burst is a genuinely co-present
          // sticker (the confirmer settles them a frame apart), so the gate applies only to the
          // burst's first commit; within-burst misreads are already rejected by the 2-frame confirmer.
          if (toCommit.length > 0) {
            const now = Date.now();
            const state = {
              lastCommitAt: lastCommitAtRef.current,
              committedThisBurst: committedThisBurstRef.current,
            };
            if (allowCommit(state, now, CONFIG.capture.minRecaptureMs)) {
              lastCommitAtRef.current = now;
              committedThisBurstRef.current = true;
            } else {
              toCommit = [];
            }
          }
        }

        if (DEBUG) {
          setDebugText(
            `${crops}cr "${rawText.slice(0, 70)}" → ${
              resolved.map((m) => m.entry?.code).join(', ') || '(nenhum)'
            }${opts.confirm ? ` ✓[${toCommit.map((m) => m.entry?.code).join(',') || '-'}]` : ''}`,
          );
        }

        if (toCommit.length > 0) {
          handleMatches(toCommit);
        } else if (!opts.silent) {
          handleMatches([]); // explicit read that found nothing
        }
        // Tell the capture loop what happened so it can lock on a real read, keep trying on a
        // present-but-unread sticker, or idle on an empty view. `committed` = a code agreed this
        // burst (even if the cooldown deduped its display); `detected` = a code box was located
        // (a sticker is in view); `stop` = end the burst now.
        const committed = opts.confirm
          ? confirmerRef.current.committedCount() > 0
          : toCommit.length > 0;
        return { stop: opts.confirm ? stopBurst : true, committed, detected: crops > 0 };
      } catch {
        if (!opts.silent) handleMatches([]);
        return idle; // a bad frame — let the burst try the next one
      }
    });
    recognizeChainRef.current = job.then(
      () => {},
      () => {},
    );
    return job;
  };

  // ---------- Lock the document to the visible viewport while scanning ----------

  useEffect(() => {
    // The scanner is a full-viewport view that must NEVER scroll — the bottom verdict
    // (GUARDAR / REPETIDA) has to stay on screen. The screen itself is height:100dvh +
    // overflow:hidden, but that only clips ITS OWN content: the shared shell ancestors
    // (#app/.app) are sized to height/min-height:100%, which on mobile is the LARGE
    // (url-bar-hidden) viewport — taller than the visible area 100dvh tracks. So the
    // DOCUMENT scrolled around the screen and the verdict fell below the fold. Pin the
    // root to the dynamic viewport + lock its overflow (see html.scan-active in styles.css)
    // for as long as the scanner is mounted; other (scrolling) screens are untouched.
    const root = document.documentElement;
    root.classList.add('scan-active');
    return () => root.classList.remove('scan-active');
  }, []);

  // ---------- Keep the screen awake while scanning ----------

  useEffect(() => {
    // Otherwise the phone dims/locks mid-scan — interrupting the hands-free loop, pausing the
    // camera, and killing the fill-light. Re-acquired automatically on return to the tab; released
    // when the scanner unmounts (navigating to another section). Silent no-op where unsupported.
    const wake = createScreenWakeLock();
    wake.acquire();
    return () => wake.release();
  }, []);

  // ---------- OCR lifecycle (independent of which camera is active) ----------

  useEffect(() => {
    // Preload OCR up front so it's ready by the time a sticker is shown.
    void ensureOcr();
    return () => {
      window.clearTimeout(multiTimerRef.current);
      ocrRef.current?.terminate().catch(() => {});
      audioCtxRef.current?.close().catch(() => {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------- Camera lifecycle (restarts when the user flips the camera) ----------

  useEffect(() => {
    let cancelled = false;
    setCameraState('loading');
    const source = createCameraSource({ facingMode: facing });
    sourceRef.current = source;

    const start = async () => {
      try {
        await source.start();
      } catch {
        if (!cancelled) setCameraState('denied');
        return;
      }
      if (cancelled) {
        source.stop();
        return;
      }
      source.element.classList.add('scan-video');
      // replaceChildren so flipping the camera swaps the <video> cleanly.
      videoLayerRef.current?.replaceChildren(source.element);
      setCameraState('ready');

      // The burst calls recognizeCanvas, which waits for OCR itself — so the loop
      // can start now and simply no-ops until the engine finishes loading.
      const capture = createAutoCapture({
        source,
        onBurstStart: () => {
          confirmerRef.current.reset();
          committedThisBurstRef.current = false;
        },
        onCapture: (frame) => recognizeCanvas(frame, { confirm: true, silent: true }),
        // Surface the loop phase. Normal UI: a coarse idle/reading flag (deduped) that drives
        // the mira scanner-sweep so the user can SEE it's reading — a held sticker (holding)
        // and the OCR burst (reading) both count as "reading". Debug adds the full heartbeat.
        onTick: (s) => {
          const phase: ScanPhase =
            s.phase === 'holding' || s.phase === 'reading' ? 'reading' : 'idle';
          if (phase !== scanPhaseRef.current) {
            scanPhaseRef.current = phase;
            setScanPhase(phase);
          }
          if (!DEBUG) return;
          const sp = '⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏'[s.tick % 10];
          const label =
            s.phase === 'waiting'
              ? 'aguardando figurinha'
              : s.phase === 'moving'
                ? `movendo ${Math.round(s.change * 100)}%`
                : s.phase === 'holding'
                  ? `parado ${s.heldMs}ms`
                  : s.phase === 'reading'
                    ? 'lendo…'
                    : s.phase === 'stalled'
                      ? 'sem vídeo — reconectando'
                      : 'lido ✓ — troque a figurinha';
          setBeat(`${sp} ${label}`);
        },
      });
      captureRef.current = capture;
      capture.start();
    };

    start();

    return () => {
      cancelled = true;
      captureRef.current?.stop();
      captureRef.current = null;
      source.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [facing]);

  // Make the mira window a viewport onto the detection ROI, so what the user frames in the slot is
  // exactly the region the recognizer reads (CONFIG.detect.roiRect), not a centred crop of the frame.
  useRoiViewport(
    videoLayerRef,
    () => sourceRef.current?.element as HTMLVideoElement | undefined,
    [cameraState, facing],
  );

  const flipCamera = () => {
    const next = facing === 'user' ? 'environment' : 'user';
    setFacing(next);
    settings.set({ camera: next === 'user' ? 'front' : 'back' });
  };

  // ---------- Manual entry ----------

  const submitManual = (e: Event) => {
    e.preventDefault();
    const value = manualValue.trim();
    if (!value) return;
    handleMatches([matchCode(value, checklist)]);
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

  /** Debug-only: ship a canvas to the dev server (./captures) so we can inspect
   *  real device frames and OCR crops offline. */
  const postDebugImg = (name: string, canvas: HTMLCanvasElement) => {
    try {
      void fetch('/__capture', {
        method: 'POST',
        body: JSON.stringify({ name, dataUrl: canvas.toDataURL('image/jpeg', 0.92) }),
      }).catch(() => {});
    } catch {
      /* dev-only, best effort */
    }
  };

  /** Debug-only: capture the current camera frame immediately (tap the preview). */
  const captureNow = () => {
    const source = sourceRef.current;
    if (!source || !source.isReady()) return;
    const canvas = document.createElement('canvas');
    if (!source.drawTo(canvas, CONFIG.ocr.maxWidth)) return;
    void recognizeCanvas(canvas, { confirm: false, silent: false });
  };

  const retryCamera = () => {
    setCameraState('loading');
    setOcrReady(false);
    setOcrProgress(0);
    // Re-mounting via key would be cleaner, but a reload is the simplest reliable reset.
    window.location.reload();
  };

  // ---------- Render ----------

  // The scanner-sweep / "Lendo…" state, gated only on OCR being up. Deliberately NOT gated on
  // verdict/multi: the sweep runs on the mira even while a previous sticker's verdict is still
  // docked below, so the user can see the NEXT sticker being read (the common sticker-after-
  // sticker case). It clears itself — a committed read sends the loop to 'locked' → idle, and an
  // empty or held-already-read mat is 'waiting'/'locked' → idle, so it is never falsely 'reading'.
  const reading = scanPhase === 'reading' && ocrReady;

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
      <div class="cam" onClick={DEBUG ? captureNow : undefined}>
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
            {cameraState !== 'denied' && (
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
                  onClick={flipCamera}
                  aria-label={pt.scan.flipCamera}
                  title={facing === 'user' ? pt.scan.cameraFront : pt.scan.cameraBack}
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
            Gravando · {recCount}
          </div>
        )}

        {DEBUG && (
          <div class="debug-box">
            {beat || 'iniciando…'}
            {debugText ? ` · ${debugText}` : ''}
          </div>
        )}

        {cameraState !== 'denied' && (
          <div class="mira-wrap">
            <div class={reading ? 'mira reading' : 'mira'}>
              {/* Camera <video> is appended here imperatively; Preact leaves it alone. */}
              <div class="scan-video-layer" ref={videoLayerRef} aria-hidden="true" />
              {/* Scanner sweep — the visible "it's reading" signal (mounts fresh each read so
                  the sweep restarts). Reduced-motion turns this into a still glow via CSS. */}
              {reading && <span class="mira-scan" aria-hidden="true" />}
              <span class="corner tl" aria-hidden="true" />
              <span class="corner tr" aria-hidden="true" />
              <span class="corner bl" aria-hidden="true" />
              <span class="corner br" aria-hidden="true" />
              {cameraState === 'loading' && <span class="cole">{pt.scan.slotLabel}</span>}
            </div>
            {ocrReady && !verdict && !multi && (
              <span class={reading ? 'hint reading' : 'hint'}>
                <span class="pulse" aria-hidden="true" />
                {reading ? pt.scan.reading : pt.scan.holdStill}
              </span>
            )}
          </div>
        )}

        {cameraState === 'ready' && !ocrReady && !ocrFailed && (
          <div class="scan-overlay">
            <div class="spinner" />
            <p>{pt.scan.preparing(ocrProgress)}</p>
          </div>
        )}
        {cameraState === 'ready' && ocrFailed && (
          <div class="scan-overlay scan-overlay-msg">
            <div class="scan-denied-emoji">📴</div>
            <p>{pt.scan.ocrUnavailable}</p>
            <button class="miss-action" type="button" onClick={() => setShowManual(true)}>
              📝 {pt.scan.manualOpen}
            </button>
          </div>
        )}
        {cameraState === 'denied' && (
          <div class="scan-overlay scan-denied">
            <div class="scan-denied-emoji">📷</div>
            <h2>{pt.scan.cameraDenied}</h2>
            <p>{pt.scan.cameraDeniedHint}</p>
            <button class="btn btn-primary" onClick={retryCamera}>
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
