import { useEffect, useRef, useState } from 'preact/hooks';
import type {
  AutoCapture,
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
import { matchCode, bestMatchFromText } from '../../domain/matching';
import { createConfirmer } from '../../domain/confirm';
import { createOcrEngine } from '../../ocr/engine';
import { createCameraSource } from '../../ocr/frameSource';
import { findCodeBoxes, codeCropCandidates, stackCrops } from '../../ocr/locate';
import { createAutoCapture } from '../../ocr/autoCapture';
import { Flash, type FlashState } from '../components/Flash';
import { MultiResult, type ScanResultItem } from '../components/MultiResult';

interface ScanScreenProps {
  session: ScanSession;
  collection: CollectionStore;
  settings: SettingsStore;
  onPersist: () => void;
  onFinish: () => void;
}

// Opt-in debug readout (open with ?debug): shows raw OCR text + matched codes and
// makes tapping the camera trigger an immediate capture. No effect without the flag.
const DEBUG = typeof location !== 'undefined' && new URLSearchParams(location.search).has('debug');

type CameraState = 'loading' | 'ready' | 'denied';

interface RecentScan {
  id: number;
  outcome: ScanOutcome;
  label: string;
}

const FLASH_MS = 1100;

export function ScanScreen({ session, collection, settings, onPersist, onFinish }: ScanScreenProps) {
  // Dedicated, Preact-untouched layer for the <video>. Preact never renders
  // children into it, so mounting the camera element by hand is safe.
  const videoLayerRef = useRef<HTMLDivElement>(null);
  const ocrRef = useRef<OcrEngine | null>(null);
  const ocrInitRef = useRef<Promise<boolean> | null>(null);
  const sourceRef = useRef<ReturnType<typeof createCameraSource> | null>(null);
  const captureRef = useRef<AutoCapture | null>(null);
  const flashTimerRef = useRef<number | undefined>(undefined);
  const multiTimerRef = useRef<number | undefined>(undefined);
  // Serializes every OCR call (auto-capture, photo, manual share one worker) so a
  // user-triggered read is queued behind a live one instead of being dropped.
  const recognizeChainRef = useRef<Promise<void>>(Promise.resolve());
  // Per-sticker agreement across the burst of frames; reset when a new sticker settles.
  const confirmerRef = useRef(createConfirmer(CONFIG.match.confirmations));
  const audioCtxRef = useRef<AudioContext | null>(null);
  const flashCounter = useRef(0);

  const [cameraState, setCameraState] = useState<CameraState>('loading');
  const [ocrProgress, setOcrProgress] = useState(0);
  const [ocrReady, setOcrReady] = useState(false);
  const [ocrFailed, setOcrFailed] = useState(false);
  const [flash, setFlash] = useState<FlashState | null>(null);
  const [multi, setMulti] = useState<ScanResultItem[] | null>(null);
  const [announce, setAnnounce] = useState('');
  const [counters, setCounters] = useState({ neededCount: 0, repeatedCount: 0 });
  const [recent, setRecent] = useState<RecentScan[]>([]);
  const [showManual, setShowManual] = useState(false);
  const [manualValue, setManualValue] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [debugText, setDebugText] = useState('');

  // ---------- Result handling shared by all input paths ----------

  /** Route one OR MANY recognized stickers (several backs can be in view at once)
   *  to the flash/panel, counters, session, and the screen-reader announcer.
   *  A resolved checklist code (exact or autocorrected) is trusted directly — the
   *  match is the confidence signal. We deliberately do NOT gate on Tesseract's
   *  whole-frame mean confidence: the sticker back is full of noisy legal text
   *  that drags that number down and would reject good reads. */
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
      showFlash({ outcome: 'unknown', display: '', teamName: '', key });
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
        ...items.map((it, i) => ({ id: key * 100 + i, outcome: it.outcome, label: it.display })),
        ...r,
      ].slice(0, 12),
    );
    setAnnounce(
      items
        .map((it) => `${it.outcome === 'owned' ? pt.scan.owned : pt.scan.needed}: ${it.display}`)
        .join('. ') + zwsp,
    );

    if (items.length === 1) {
      const it = items[0];
      clearMulti();
      showFlash({
        outcome: it.outcome,
        display: it.display,
        teamName: it.outcome === 'owned' ? '' : it.teamName,
        key,
      });
    } else {
      setFlash(null);
      showMulti(items);
    }
    beep(items.some((it) => it.outcome === 'needed') ? 'needed' : 'owned');
  };

  const showFlash = (next: FlashState) => {
    setFlash(next);
    window.clearTimeout(flashTimerRef.current);
    flashTimerRef.current = window.setTimeout(() => setFlash(null), FLASH_MS);
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
   *  Decoupled from the camera so the photo-upload fallback works even when the
   *  camera is denied or unavailable. */
  const ensureOcr = (): Promise<boolean> => {
    if (ocrInitRef.current) return ocrInitRef.current;
    const engine = createOcrEngine();
    ocrRef.current = engine;
    setOcrFailed(false);
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
   * `!confirm` (an explicit photo/tap) commits a single read and does report a miss.
   * Resolves true once at least one code is committed — the burst stops on that.
   */
  const recognizeCanvas = (
    canvas: HTMLCanvasElement,
    opts: { confirm: boolean; silent: boolean },
  ): Promise<boolean> => {
    const job = recognizeChainRef.current.then(async (): Promise<boolean> => {
      const ready = await ensureOcr();
      const ocr = ocrRef.current;
      if (!ready || !ocr) return false;
      try {
        if (DEBUG) postDebugImg('pixel-' + Date.now(), canvas);
        // Yield once so the camera preview can paint before the synchronous
        // detection work (cheap, but avoids a dropped frame on low-end phones).
        await new Promise((r) => setTimeout(r, 0));
        // Locate the printed code box(es) and OCR only those crops — far faster and
        // more accurate than the whole frame. Each box yields an upright + a flipped
        // crop (so rotated codes read), and every crop is OCR'd ON ITS OWN: stacking
        // them confuses Tesseract's layout analysis and drops thin glyphs (CIV→CV).
        // The small crops run in parallel across a worker pool (~tens of ms each).
        const boxes = findCodeBoxes(canvas);
        const crops = boxes.flatMap((b) => codeCropCandidates(canvas, b));
        const resolved: MatchResult[] = [];
        let rawText = '';
        if (crops.length) {
          if (DEBUG) postDebugImg('stack-live', stackCrops(crops));
          const results = await ocr.recognizeMany(crops);
          rawText = results
            .map((r) => r.text.replace(/\s+/g, ' ').trim())
            .filter(Boolean)
            .join(' | ');
          const seen = new Set<string>();
          for (const r of results) {
            const m = bestMatchFromText(r.text, checklist);
            if (m?.entry && !seen.has(m.entry.code)) {
              seen.add(m.entry.code);
              resolved.push(m);
            }
          }
        }

        // Live burst: only act on codes that agree across frames. Single shot: trust
        // the one read (there is no next frame to confirm against).
        let toCommit = resolved;
        if (opts.confirm) {
          const ok = new Set(confirmerRef.current.add(resolved.map((m) => m.entry!.code)));
          toCommit = resolved.filter((m) => ok.has(m.entry!.code));
        }

        if (DEBUG) {
          setDebugText(
            `${boxes.length}cx "${rawText.slice(0, 70)}" → ${
              resolved.map((m) => m.entry?.code).join(', ') || '(nenhum)'
            }${opts.confirm ? ` ✓[${toCommit.map((m) => m.entry?.code).join(',') || '-'}]` : ''}`,
          );
        }

        if (toCommit.length > 0) {
          handleMatches(toCommit);
          return true;
        }
        if (!opts.silent) handleMatches([]); // explicit read that found nothing
        return false;
      } catch {
        if (!opts.silent) handleMatches([]);
        return false;
      }
    });
    recognizeChainRef.current = job.then(
      () => {},
      () => {},
    );
    return job;
  };

  // ---------- Camera + OCR lifecycle ----------

  useEffect(() => {
    let cancelled = false;
    const source = createCameraSource();
    sourceRef.current = source;

    const start = async () => {
      try {
        await source.start();
        if (cancelled) return;
        source.element.classList.add('scan-video');
        videoLayerRef.current?.appendChild(source.element);
        setCameraState('ready');
      } catch {
        if (!cancelled) setCameraState('denied');
        return;
      }

      // Preload OCR now that the camera is live (idempotent; the photo-upload
      // path can also trigger it on demand when the camera is denied).
      const ready = await ensureOcr();
      if (cancelled || !ready) return;

      const capture = createAutoCapture({
        source,
        onBurstStart: () => confirmerRef.current.reset(),
        onCapture: (frame) => recognizeCanvas(frame, { confirm: true, silent: true }),
      });
      captureRef.current = capture;
      capture.start();
    };

    start();

    return () => {
      cancelled = true;
      window.clearTimeout(flashTimerRef.current);
      window.clearTimeout(multiTimerRef.current);
      captureRef.current?.stop();
      sourceRef.current?.stop();
      ocrRef.current?.terminate().catch(() => {});
      audioCtxRef.current?.close().catch(() => {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------- Manual entry ----------

  const submitManual = (e: Event) => {
    e.preventDefault();
    const value = manualValue.trim();
    if (!value) return;
    handleMatches([matchCode(value, checklist)]);
    setManualValue('');
    setShowManual(false);
  };

  // ---------- Photo upload ----------

  const onPhotoPicked = async (e: Event) => {
    const input = e.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = ''; // allow re-picking the same file
    if (!file) return;

    setAnalyzing(true);
    try {
      const bitmap = await loadImage(file);
      const canvas = document.createElement('canvas');
      const maxWidth = CONFIG.ocr.maxWidth;
      const scale = Math.min(1, maxWidth / bitmap.width);
      canvas.width = Math.round(bitmap.width * scale);
      canvas.height = Math.round(bitmap.height * scale);
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return;
      ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      await recognizeCanvas(canvas, { confirm: false, silent: false });
    } finally {
      setAnalyzing(false);
    }
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

  return (
    <div class="screen scan-screen">
      {/* Screen-reader / sound-off announcement of each scan result. */}
      <p class="sr-only" role="status" aria-live="assertive">
        {announce}
      </p>

      <div class="scan-video-wrap" onClick={DEBUG ? captureNow : undefined}>
        {/* Camera <video> is appended here imperatively; Preact leaves it alone. */}
        <div class="scan-video-layer" ref={videoLayerRef} aria-hidden="true" />

        {DEBUG && <div class="debug-box">{debugText || 'toque na câmera p/ capturar'}</div>}

        {cameraState !== 'denied' && (
          <>
            <div class="scan-frame" aria-hidden="true" />
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
              </div>
            )}
            {ocrReady && !flash && <p class="scan-hint">{pt.scan.startHint}</p>}
          </>
        )}

        {cameraState === 'denied' && (
          <div class="scan-denied">
            <div class="scan-denied-emoji">📷</div>
            <h2>{pt.scan.cameraDenied}</h2>
            <p>{pt.scan.cameraDeniedHint}</p>
            <button class="btn btn-primary" onClick={retryCamera}>
              {pt.scan.retry}
            </button>
          </div>
        )}

        {analyzing && (
          <div class="scan-overlay">
            <div class="spinner" />
            <p>{ocrReady ? pt.scan.analyzing : pt.scan.preparing(ocrProgress)}</p>
          </div>
        )}

        {flash && <Flash state={flash} />}
        {multi && <MultiResult items={multi} />}
      </div>

      {/* Top bar */}
      <div class="scan-topbar">
        <div class="scan-counters">
          <span class="counter counter-new">
            <b>{counters.neededCount}</b> {pt.scan.counters.new}
          </span>
          <span class="counter counter-rep">
            <b>{counters.repeatedCount}</b> {pt.scan.counters.repeated}
          </span>
        </div>
        <button class="btn btn-finish" onClick={onFinish} disabled={session.isEmpty()}>
          {pt.scan.finish}
        </button>
      </div>

      {/* Recent strip */}
      {recent.length > 0 && (
        <div class="scan-recent" aria-label={pt.scan.recent}>
          {recent.map((r) => (
            <span key={r.id} class={`recent-chip recent-${r.outcome}`}>
              {r.label}
            </span>
          ))}
        </div>
      )}

      {/* Fallback affordances */}
      <div class="scan-actions">
        <button class="btn btn-ghost" onClick={() => setShowManual((s) => !s)}>
          ⌨️ {pt.scan.manualEntry}
        </button>
        <label class="btn btn-ghost">
          🖼️ {pt.scan.sendPhoto}
          <input type="file" accept="image/*" capture="environment" hidden onChange={onPhotoPicked} />
        </label>
      </div>

      {showManual && (
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
          <button class="btn btn-primary" type="submit">
            {pt.scan.manualConfirm}
          </button>
        </form>
      )}
    </div>
  );
}

/** Decode a picked image file into something drawable. */
async function loadImage(file: File): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  } finally {
    // Revoke after decode; the bitmap is already in memory.
    URL.revokeObjectURL(url);
  }
}
