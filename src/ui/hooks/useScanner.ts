import { useEffect, useRef, useState } from 'preact/hooks';
import type { AutoCapture, CaptureResult, MatchResult, OcrEngine, SettingsStore } from '../../types';
import { CONFIG } from '../../config';
import { checklist } from '../../data/checklist';
import { matchCode } from '../../domain/matching';
import { track } from '../../analytics';
import { createConfirmer } from '../../domain/confirm';
import { allowCommit } from '../../domain/commitGate';
import { createHybridOcrEngine as createOcrEngine } from '../../ocr/hybridEngine';
import { createCameraSource } from '../../ocr/frameSource';
import { useRoiViewport } from './useRoiViewport';
import { recognizeFrameInOrder, recognizeFrameCodeNet } from '../../ocr/recognize';
import type { CodeNet } from '../../ocr/codeNetEngine';
import { createAutoCapture } from '../../ocr/autoCapture';
import { createScreenWakeLock } from '../wakeLock';

export type CameraState = 'loading' | 'ready' | 'denied';
type ScanPhase = 'idle' | 'reading';

export interface UseScannerOptions {
  /** The single result sink: called with the committed matches, or [] on an explicit (non-silent)
   *  read that found nothing. The screen decides one-vs-many and what to record. `source` lets the
   *  screen tag a read as camera vs manual entry (for analytics); callers may ignore it. */
  onMatches: (matches: MatchResult[], source: 'camera' | 'manual') => void;
  settings: SettingsStore;
  /** Which Settings key persists this scanner's camera facing. */
  cameraSetting: 'camera' | 'conferirCamera';
  /** ?debug: raw-read readout + tap-to-capture. */
  debug?: boolean;
  /** ?record: save every read frame to the dev server in sequence (rec-NNNN.jpg). */
  record?: boolean;
}

export interface Scanner {
  videoLayerRef: import('preact').RefObject<HTMLDivElement>;
  cameraState: CameraState;
  ocrReady: boolean;
  ocrFailed: boolean;
  ocrProgress: number;
  facing: 'user' | 'environment';
  reading: boolean;
  flipCamera: () => void;
  retryCamera: () => void;
  submitManualCode: (value: string) => void;
  captureNow: () => void;
  debug: { beat: string; text: string; recCount: number; recording: boolean };
}

export function useScanner({
  onMatches,
  settings,
  cameraSetting,
  debug = false,
  record = false,
}: UseScannerOptions): Scanner {
  const videoLayerRef = useRef<HTMLDivElement>(null);
  const ocrRef = useRef<OcrEngine | null>(null);
  const ocrInitRef = useRef<Promise<boolean> | null>(null);
  const codeNetRef = useRef<CodeNet | null>(null);
  const sourceRef = useRef<ReturnType<typeof createCameraSource> | null>(null);
  const captureRef = useRef<AutoCapture | null>(null);
  const recognizeChainRef = useRef<Promise<void>>(Promise.resolve());
  const recSeqRef = useRef(0);
  const confirmerRef = useRef(createConfirmer(CONFIG.match.confirmations));
  const lastCommitAtRef = useRef(0);
  const committedThisBurstRef = useRef(false);
  // Fire the anonymous `ocr_unavailable` stat at most once per mount (ensureOcr's catch can re-run).
  const ocrUnavailableFiredRef = useRef(false);

  const [cameraState, setCameraState] = useState<CameraState>('loading');
  const [ocrProgress, setOcrProgress] = useState(0);
  const [ocrReady, setOcrReady] = useState(false);
  const [ocrFailed, setOcrFailed] = useState(false);
  const [facing, setFacing] = useState<'user' | 'environment'>(
    settings.get()[cameraSetting] === 'back' ? 'environment' : 'user',
  );
  const [scanPhase, setScanPhase] = useState<ScanPhase>('idle');
  const scanPhaseRef = useRef<ScanPhase>('idle');
  const [beat, setBeat] = useState('');
  const [debugText, setDebugText] = useState('');
  const [recCount, setRecCount] = useState(0);

  /** Debug-only: ship a canvas to the dev server (./captures). */
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

  /** Create + initialize the OCR engine exactly once. Resolves true when ready. */
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
        // Anonymous stat: OCR couldn't load (blocked/slow CDN) so the user is pushed to manual
        // entry. Once per mount — this catch can re-run on later ensureOcr() calls.
        if (!ocrUnavailableFiredRef.current) {
          ocrUnavailableFiredRef.current = true;
          track('ocr_unavailable');
        }
        return false;
      });
    return ocrInitRef.current;
  };

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
        if (record) {
          postDebugImg('rec-' + String(recSeqRef.current++).padStart(4, '0'), canvas);
          setRecCount(recSeqRef.current);
        } else if (debug) {
          postDebugImg('pixel-' + Date.now(), canvas);
        }
        await new Promise((r) => setTimeout(r, 0));
        const cn = codeNetRef.current;
        let out = cn?.ready()
          ? await recognizeFrameCodeNet(cn, canvas, checklist, /* stopOnFirstCode */ opts.confirm)
          : await recognizeFrameInOrder(ocr, canvas, checklist, opts.confirm);
        if (cn?.ready() && out.resolved.length === 0) {
          out = await recognizeFrameInOrder(ocr, canvas, checklist, opts.confirm);
        }
        const { resolved, reads, crops } = out;
        const rawText = reads.join(' | ');

        let toCommit = resolved;
        let stopBurst = true;
        if (opts.confirm) {
          const newly = confirmerRef.current.add(resolved.map((m) => m.entry!.code));
          const ok = new Set(newly);
          toCommit = resolved.filter((m) => ok.has(m.entry!.code));
          stopBurst = confirmerRef.current.committedCount() > 0 && newly.length === 0;
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

        if (debug) {
          setDebugText(
            `${crops}cr "${rawText.slice(0, 70)}" → ${
              resolved.map((m) => m.entry?.code).join(', ') || '(nenhum)'
            }${opts.confirm ? ` ✓[${toCommit.map((m) => m.entry?.code).join(',') || '-'}]` : ''}`,
          );
        }

        if (toCommit.length > 0) {
          onMatches(toCommit, 'camera');
        } else if (!opts.silent) {
          onMatches([], 'camera');
        }
        const committed = opts.confirm
          ? confirmerRef.current.committedCount() > 0
          : toCommit.length > 0;
        return { stop: opts.confirm ? stopBurst : true, committed, detected: crops > 0 };
      } catch {
        if (!opts.silent) onMatches([], 'camera');
        return idle;
      }
    });
    recognizeChainRef.current = job.then(
      () => {},
      () => {},
    );
    return job;
  };

  // Lock the document to the visible viewport while scanning (full-bleed camera must never scroll).
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

  // Camera lifecycle (restarts when the user flips the camera).
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
          confirmerRef.current.reset();
          committedThisBurstRef.current = false;
        },
        onCapture: (frame) => recognizeCanvas(frame, { confirm: true, silent: true }),
        onTick: (s) => {
          const phase: ScanPhase =
            s.phase === 'holding' || s.phase === 'reading' ? 'reading' : 'idle';
          if (phase !== scanPhaseRef.current) {
            scanPhaseRef.current = phase;
            setScanPhase(phase);
          }
          if (!debug) return;
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

  useRoiViewport(
    videoLayerRef,
    () => sourceRef.current?.element as HTMLVideoElement | undefined,
    [cameraState, facing],
  );

  const flipCamera = () => {
    const next = facing === 'user' ? 'environment' : 'user';
    setFacing(next);
    const value = next === 'user' ? 'front' : 'back';
    // Explicit branch (not a computed key) to keep the Partial<Settings> types clean.
    if (cameraSetting === 'camera') settings.set({ camera: value });
    else settings.set({ conferirCamera: value });
  };

  const retryCamera = () => {
    setCameraState('loading');
    setOcrReady(false);
    setOcrProgress(0);
    window.location.reload();
  };

  const submitManualCode = (value: string) => {
    onMatches([matchCode(value, checklist)], 'manual');
  };

  const captureNow = () => {
    const source = sourceRef.current;
    if (!source || !source.isReady()) return;
    const canvas = document.createElement('canvas');
    if (!source.drawTo(canvas, CONFIG.ocr.maxWidth)) return;
    void recognizeCanvas(canvas, { confirm: false, silent: false });
  };

  const reading = scanPhase === 'reading' && ocrReady;

  return {
    videoLayerRef,
    cameraState,
    ocrReady,
    ocrFailed,
    ocrProgress,
    facing,
    reading,
    flipCamera,
    retryCamera,
    submitManualCode,
    captureNow,
    debug: { beat, text: debugText, recCount, recording: record },
  };
}
