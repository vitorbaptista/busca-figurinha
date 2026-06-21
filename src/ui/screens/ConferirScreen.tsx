import { useEffect, useRef, useState } from 'preact/hooks';
import type { AutoCapture, CaptureResult, CollectionStore, MatchResult, OcrEngine, SettingsStore } from '../../types';
import { CONFIG } from '../../config';
import { checklist } from '../../data/checklist';
import { pt } from '../../i18n/pt';
import { matchCode } from '../../domain/matching';
import { friendsNeeding, huntVerdict } from '../../domain/friendMatch';
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
import { ConferirVerdict, type ConferirVerdictState } from '../components/ConferirVerdict';

interface ConferirScreenProps {
  /** Read-only: PRECISO/JÁ TENHO comes from collection.has(code). Never written here. */
  collection: CollectionStore;
  /** Read-only: friends a scanned sticker serves (friendsNeeding, NOT spare-gated — it's THEIR sticker). */
  friendLists: FriendListsStore;
  settings: SettingsStore;
  onBack: () => void;
}

type CameraState = 'loading' | 'ready' | 'denied';
type ScanPhase = 'idle' | 'reading';

/**
 * "Conferir figurinhas" — show the OTHER person's stickers to the camera while trading. Per read:
 * PEGA! (você precisa) / PEGA PRO {amigo} / JÁ TENHO (pode deixar). It reuses the shipping scanner's
 * PRIMITIVES (camera source, autoCapture, recognizeFrame, confirmer, allowCommit) and replicates the
 * 0-FP commit discipline verbatim — a wrong PEGA/DEIXA would drive a bad PHYSICAL trade. The shipping
 * ScanScreen is left untouched (0% regression). Default camera is FRONT (phone flat, sticker shown to
 * the screen-side camera + the fill-light — the validated capture path, same as the album scanner).
 * It accumulates a running tally as you sweep the pile; the ONLY write is the explicit, user-initiated
 * "Salvar na coleção" (after you actually trade) — every per-read computation is read-only.
 */
export function ConferirScreen({ collection, friendLists, settings, onBack }: ConferirScreenProps) {
  const videoLayerRef = useRef<HTMLDivElement>(null);
  const ocrRef = useRef<OcrEngine | null>(null);
  const ocrInitRef = useRef<Promise<boolean> | null>(null);
  const codeNetRef = useRef<CodeNet | null>(null);
  const sourceRef = useRef<ReturnType<typeof createCameraSource> | null>(null);
  const captureRef = useRef<AutoCapture | null>(null);
  // Serializes every OCR call (one wasm/tfjs worker) so a manual read can't race the live burst.
  const recognizeChainRef = useRef<Promise<void>>(Promise.resolve());
  const confirmerRef = useRef(createConfirmer(CONFIG.match.confirmations));
  const lastCommitAtRef = useRef(0);
  const committedThisBurstRef = useRef(false);
  const flashCounter = useRef(0);

  const [cameraState, setCameraState] = useState<CameraState>('loading');
  const [ocrProgress, setOcrProgress] = useState(0);
  const [ocrReady, setOcrReady] = useState(false);
  const [ocrFailed, setOcrFailed] = useState(false);
  const [verdict, setVerdict] = useState<ConferirVerdictState | null>(null);
  const [announce, setAnnounce] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  // Default FRONT camera (phone flat on the table, sticker shown to the screen-side camera + the
  // fill-light) — the validated capture path the album scanner uses; flip to back is remembered.
  const [facing, setFacing] = useState<'user' | 'environment'>(
    settings.get().conferirCamera === 'back' ? 'environment' : 'user',
  );
  // Running tally of distinct stickers worth grabbing as you sweep the pile: ones you NEED (forMe →
  // savable to your album once you trade) and ones a saved friend needs (forFriends → advisory only).
  const [takenForMe, setTakenForMe] = useState<Set<string>>(() => new Set());
  const [takenForFriends, setTakenForFriends] = useState<Set<string>>(() => new Set());
  const [showManual, setShowManual] = useState(false);
  const [manualValue, setManualValue] = useState('');
  const [scanPhase, setScanPhase] = useState<ScanPhase>('idle');
  const scanPhaseRef = useRef<ScanPhase>('idle');

  const flash = (text: string) => {
    setNotice(text);
    window.setTimeout(() => setNotice(null), 2600);
  };

  // ---------- Result handling (READ-ONLY: compute a verdict, persist nothing) ----------
  const handleMatch = (matches: MatchResult[]) => {
    flashCounter.current += 1;
    const key = flashCounter.current;
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
    // Tally the takes (deduped). forMe = a sticker you need (savable to your album after the trade);
    // take-friends = you own it but a friend needs it (advisory — it's not yours to keep).
    if (v.forMe) setTakenForMe((s) => (s.has(entry.code) ? s : new Set(s).add(entry.code)));
    else if (v.kind === 'take-friends')
      setTakenForFriends((s) => (s.has(entry.code) ? s : new Set(s).add(entry.code)));
    const who =
      v.kind === 'take-mine'
        ? pt.conferir.takeWord + ' ' + pt.conferir.takeMineSub
        : v.kind === 'take-friends'
          ? pt.conferir.takeWord + ' ' + pt.scan.radarServes(v.forFriends)
          : pt.conferir.skipWord + ' ' + pt.conferir.skipSub;
    setAnnounce(`${entry.display}: ${who}${zwsp}`);
  };

  // The ONE write in this screen — explicit + user-initiated (you actually did the trade): add the
  // stickers you needed to your album. Same trust bar as the album scanner's report commit (the reads
  // are confirmer-gated) and reversible in Coleção. The friend-takes are NOT saved (not yours to keep).
  const saveTaken = () => {
    if (takenForMe.size === 0) return;
    const n = takenForMe.size;
    collection.setOwned([...takenForMe], true);
    setTakenForMe(new Set());
    flash(pt.conferir.saved(n));
  };

  // ---------- OCR engine init (codeNet ensemble + hybrid), identical 0-FP discipline ----------
  const ensureOcr = (): Promise<boolean> => {
    if (ocrInitRef.current) return ocrInitRef.current;
    const engine = createOcrEngine();
    ocrRef.current = engine;
    setOcrFailed(false);
    if (!codeNetRef.current) {
      import('../../ocr/codeNetEngine')
        .then(({ createCodeNet }) => {
          const cn = createCodeNet(checklist);
          return cn.init(import.meta.env.BASE_URL + 'models/codenet/model.json').then(() => {
            codeNetRef.current = cn;
          });
        })
        .catch(() => {
          /* codeNet unavailable → hybrid-only fallback */
        });
    }
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

  // Recognize a drawn canvas — copied verbatim from the shipping scanner's 0-FP path: codeNet-first
  // ensemble with hybrid fallback, multi-frame confirmer, and the commit cooldown. The ONLY change is
  // the result sink (handleMatch instead of the album handler). Keep every guard identical.
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
        await new Promise((r) => setTimeout(r, 0));
        const cn = codeNetRef.current;
        let out = cn?.ready()
          ? await recognizeFrameCodeNet(cn, canvas, checklist, opts.confirm)
          : await recognizeFrameInOrder(ocr, canvas, checklist, opts.confirm);
        if (cn?.ready() && out.resolved.length === 0) {
          out = await recognizeFrameInOrder(ocr, canvas, checklist, opts.confirm);
        }
        const { resolved, crops } = out;

        let toCommit = resolved;
        let stopBurst = true;
        if (opts.confirm) {
          const newly = confirmerRef.current.add(resolved.map((m) => m.entry!.code));
          const ok = new Set(newly);
          toCommit = resolved.filter((m) => ok.has(m.entry!.code));
          stopBurst = confirmerRef.current.committedCount() > 0 && newly.length === 0;
          // Commit cooldown — gates only the burst's FIRST commit. The committedThisBurstRef reset on
          // onBurstStart (below) is load-bearing: without it allowCommit would return true forever.
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

        if (toCommit.length > 0) {
          handleMatch(toCommit);
        } else if (!opts.silent) {
          handleMatch([]);
        }
        const committed = opts.confirm ? confirmerRef.current.committedCount() > 0 : toCommit.length > 0;
        return { stop: opts.confirm ? stopBurst : true, committed, detected: crops > 0 };
      } catch {
        if (!opts.silent) handleMatch([]);
        return idle;
      }
    });
    recognizeChainRef.current = job.then(
      () => {},
      () => {},
    );
    return job;
  };

  // Lock the document to the visible viewport (full-bleed camera must never scroll). Same as ScanScreen.
  useEffect(() => {
    const root = document.documentElement;
    root.classList.add('scan-active');
    return () => root.classList.remove('scan-active');
  }, []);

  // Keep the screen awake during the hands-free loop.
  useEffect(() => {
    const wake = createScreenWakeLock();
    wake.acquire();
    return () => wake.release();
  }, []);

  // OCR lifecycle (independent of which camera is active).
  useEffect(() => {
    void ensureOcr();
    return () => {
      ocrRef.current?.terminate().catch(() => {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Camera lifecycle (restarts on flip).
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
      videoLayerRef.current?.replaceChildren(source.element);
      setCameraState('ready');

      const capture = createAutoCapture({
        source,
        onBurstStart: () => {
          // Load-bearing for 0-FP: reset the per-burst commit flag so the cooldown gate works.
          confirmerRef.current.reset();
          committedThisBurstRef.current = false;
        },
        onCapture: (frame) => recognizeCanvas(frame, { confirm: true, silent: true }),
        onTick: (s) => {
          const phase: ScanPhase = s.phase === 'holding' || s.phase === 'reading' ? 'reading' : 'idle';
          if (phase !== scanPhaseRef.current) {
            scanPhaseRef.current = phase;
            setScanPhase(phase);
          }
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

  useRoiViewport(videoLayerRef, () => sourceRef.current?.element as HTMLVideoElement | undefined, [
    cameraState,
    facing,
  ]);

  const flipCamera = () => {
    const next = facing === 'user' ? 'environment' : 'user';
    setFacing(next);
    settings.set({ conferirCamera: next === 'user' ? 'front' : 'back' });
  };

  // Manual entry — the escape hatch AND the headless test seam (drives handleMatch without a camera).
  const submitManual = (e: Event) => {
    e.preventDefault();
    const value = manualValue.trim();
    if (!value) return;
    handleMatch([matchCode(value, checklist)]);
    setManualValue('');
    setShowManual(false);
  };

  const retryCamera = () => {
    setCameraState('loading');
    setOcrReady(false);
    setOcrProgress(0);
    window.location.reload();
  };

  const reading = scanPhase === 'reading' && ocrReady;

  return (
    <div class="screen scan-screen conferir-screen">
      <p class="sr-only" role="status" aria-live="assertive">
        {announce}
      </p>

      <div class="pagetab">
        <span class="pagetab-name">{pt.conferir.pageTitle}</span>
        <span class="pagetab-pg">{pt.conferir.pageSubtitle}</span>
      </div>

      <div class="cam">
        <div class="cam-top">
          <div class="conferir-top-left">
            <button class="cam-icon-btn" onClick={onBack} aria-label={pt.conferir.back} title={pt.conferir.back}>
              ←
            </button>
            <div class="counters">
              <div class="chip-count">
                <b>{takenForMe.size}</b>
                <span>{pt.conferir.counterMine}</span>
              </div>
              {takenForFriends.size > 0 && (
                <div class="chip-count dup">
                  <b>{takenForFriends.size}</b>
                  <span>{pt.conferir.counterFriends}</span>
                </div>
              )}
            </div>
          </div>
          <div class="cam-top-actions">
            {cameraState !== 'denied' && (
              <>
                <button
                  class="cam-icon-btn"
                  onClick={() => setShowManual(true)}
                  aria-label={pt.scan.manualEntry}
                  title={pt.scan.manualEntry}
                >
                  ⌨️
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

        {cameraState !== 'denied' && (
          <div class="mira-wrap">
            <div class={reading ? 'mira reading' : 'mira'}>
              <div class="scan-video-layer" ref={videoLayerRef} aria-hidden="true" />
              {reading && <span class="mira-scan" aria-hidden="true" />}
              <span class="corner tl" aria-hidden="true" />
              <span class="corner tr" aria-hidden="true" />
              <span class="corner bl" aria-hidden="true" />
              <span class="corner br" aria-hidden="true" />
              {cameraState === 'loading' && <span class="cole">{pt.scan.slotLabel}</span>}
            </div>
            {ocrReady && !verdict && (
              <span class={reading ? 'hint reading' : 'hint'}>
                <span class="pulse" aria-hidden="true" />
                {reading ? pt.scan.reading : pt.conferir.holdStill}
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
              ⌨️ {pt.scan.manualOpen}
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

        <div class="cam-bottom">
          {notice && (
            <div class="conferir-notice" role="status" aria-live="polite">
              {notice}
            </div>
          )}
          {takenForMe.size > 0 && (
            <button class="conferir-save" onClick={saveTaken}>
              💾 {pt.conferir.save(takenForMe.size)}
            </button>
          )}
          {verdict && <ConferirVerdict state={verdict} onManual={() => setShowManual(true)} />}
        </div>
      </div>

      {showManual && (
        <div class="manual-sheet">
          <form class="manual-form" onSubmit={submitManual}>
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
              <button class="btn btn-ghost" type="button" onClick={() => setShowManual(false)}>
                {pt.scan.manualCancel}
              </button>
              <button class="btn btn-primary" type="submit">
                {pt.scan.manualConfirm}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
