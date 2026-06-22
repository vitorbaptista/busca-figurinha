# Unificar os scanners + "Terminar" no Conferir — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract the live-scan engine + camera chrome into a shared hook + component used by both scanners, and give the Conferir flow a "Terminar" step (review what you took → save to collection + share the pile back) symmetric to Escanear's scan→report split.

**Architecture:** A new `useScanner` hook owns the camera/OCR/recognize/confirmer/commit engine (today copy-pasted between `ScanScreen` and `ConferirScreen`); a new `<ScanShell>` component owns the shared markup (mira, overlays, top-bar actions, manual sheet). `ScanScreen` and `ConferirScreen` become thin consumers. The Conferir pile state lifts to `app.tsx` via a `createPileSession` accumulator (mirroring `domain/session.ts`), and a new ephemeral `ConferirReportScreen` is the finish step.

**Tech Stack:** Preact + TypeScript, Vite, Vitest (node tests on pure logic only), `idb-keyval`. No linter — `tsc --noEmit` (strict, `noUnusedLocals`/`noUnusedParameters`) is the static gate.

## Global Constraints

- **0 false positives is the cardinal rule.** The confirmer (`CONFIG.match.confirmations`) + commit cooldown (`allowCommit` / `CONFIG.capture.minRecaptureMs`) must stay byte-for-byte equivalent after the engine extraction. Verify with `npm run bench:pixel`.
- **`npm run build` must pass** (it runs `tsc --noEmit` then `vite build`). An unused import/local/param fails the build.
- **All user-facing text in pt-BR.** Code, comments, and these docs may be English.
- **No new dependencies.**
- **Match surrounding comment density and naming.** This repo is heavily commented at decision points — keep that.
- **Keep `CHANGELOG.md` updated.**
- Camera frames are NOT mirrored; the front camera is the default for both scanners.
- `routing.ts` stays pure (no `location` access) so it unit-tests in node. The URL has exactly one writer effect in `app.tsx` — do not add a second.

---

### Task 1: `createPileSession` domain accumulator

A read-only accumulator for a "conferir a pilha do amigo" session, mirroring `domain/session.ts`. In-memory only (NOT persisted). Pure → node-testable.

**Files:**
- Create: `src/domain/pileSession.ts`
- Test: `src/domain/pileSession.test.ts`

**Interfaces:**
- Consumes: `ChecklistEntry` from `src/types.ts`; `HuntVerdict` from `src/domain/friendMatch.ts` (`kind: 'take-mine' | 'take-friends' | 'skip'`).
- Produces: `createPileSession(): PileSession`, `PileSession` (`add(entry, kind): boolean`, `takenForMe(): string[]`, `takenForFriends(): string[]`, `wholePile(): string[]`, `finish(): PileReport`, `reset(): void`), `PileReport` (`{ taken: ChecklistEntry[]; wholePile: string[] }`).

- [ ] **Step 1: Write the failing test**

```ts
// src/domain/pileSession.test.ts
import { describe, expect, it } from 'vitest';
import { createPileSession } from './pileSession';
import type { ChecklistEntry } from '../types';

// Minimal entry — `type` is cast so the test doesn't depend on the StickerType union's literals.
const entry = (code: string): ChecklistEntry => ({
  code,
  display: code,
  teamCode: 'T',
  teamName: 'Time',
  number: 1,
  type: 'team' as ChecklistEntry['type'],
});

describe('createPileSession', () => {
  it('dedupes reads by code in the whole pile and reports newness', () => {
    const s = createPileSession();
    expect(s.add(entry('A1'), 'take-mine')).toBe(true);
    expect(s.add(entry('A1'), 'take-mine')).toBe(false); // re-read of the same sticker
    expect(s.add(entry('B2'), 'skip')).toBe(true);
    expect(s.wholePile()).toEqual(['A1', 'B2']);
  });

  it('separates take-mine, take-friends and skip', () => {
    const s = createPileSession();
    s.add(entry('A1'), 'take-mine');
    s.add(entry('B2'), 'take-friends');
    s.add(entry('C3'), 'skip');
    expect(s.takenForMe()).toEqual(['A1']);
    expect(s.takenForFriends()).toEqual(['B2']);
    expect(s.wholePile()).toEqual(['A1', 'B2', 'C3']);
  });

  it('finish() returns the take-mine entries and the whole pile', () => {
    const s = createPileSession();
    s.add(entry('A1'), 'take-mine');
    s.add(entry('B2'), 'skip');
    const r = s.finish();
    expect(r.taken.map((e) => e.code)).toEqual(['A1']);
    expect(r.wholePile).toEqual(['A1', 'B2']);
  });

  it('finish() does NOT clear (unlike session.finish) — reset() is explicit', () => {
    const s = createPileSession();
    s.add(entry('A1'), 'take-mine');
    s.finish();
    expect(s.wholePile()).toEqual(['A1']);
    s.reset();
    expect(s.wholePile()).toEqual([]);
    expect(s.finish().taken).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/domain/pileSession.test.ts`
Expected: FAIL — `Failed to resolve import "./pileSession"`.

- [ ] **Step 3: Write the implementation**

```ts
// src/domain/pileSession.ts
import type { ChecklistEntry } from '../types';
import type { HuntVerdict } from './friendMatch';

/** What the Conferir finish step ("Terminar") needs from the live pile scan. */
export interface PileReport {
  /** Distinct stickers you NEED (the take-mine reads) — the review list to commit to the collection. */
  taken: ChecklistEntry[];
  /** Every distinct sticker code you read (the friend's whole pile) — what the viral share encodes. */
  wholePile: string[];
}

/**
 * Read-only accumulator for a "conferir a pilha do amigo" session. Mirrors domain/session.ts:
 * scanning records nothing into any store; only the finish step writes. In-memory (a trade is one
 * sitting) — unlike the album session it is NOT persisted to localStorage.
 */
export interface PileSession {
  /** Record one committed read. Returns true when the code was newly recorded (a fresh sticker),
   *  false on a re-read of one already seen — so the live counters stay in sync with the dedup. */
  add(entry: ChecklistEntry, kind: HuntVerdict['kind']): boolean;
  /** Distinct codes you need (take-mine) — drives the live "pra você" counter. */
  takenForMe(): string[];
  /** Distinct codes a saved friend needs but you already own (take-friends) — the "pros amigos" counter. */
  takenForFriends(): string[];
  /** Every distinct code read so far. */
  wholePile(): string[];
  /** Build the finish-step report. Pure: does NOT clear (reset() is explicit). */
  finish(): PileReport;
  /** Clear everything (start a fresh trade). */
  reset(): void;
}

export function createPileSession(): PileSession {
  // code -> { entry, kind }. A Map dedupes by code and preserves first-seen insertion order.
  const reads = new Map<string, { entry: ChecklistEntry; kind: HuntVerdict['kind'] }>();

  const codesWhere = (match: HuntVerdict['kind']): string[] => {
    const out: string[] = [];
    for (const [code, r] of reads) if (r.kind === match) out.push(code);
    return out;
  };

  return {
    add(entry, kind) {
      // First read of a code wins its kind; a sticker's verdict is deterministic, so re-reads agree.
      if (reads.has(entry.code)) return false;
      reads.set(entry.code, { entry, kind });
      return true;
    },
    takenForMe: () => codesWhere('take-mine'),
    takenForFriends: () => codesWhere('take-friends'),
    wholePile: () => [...reads.keys()],
    finish: () => ({
      taken: [...reads.values()].filter((r) => r.kind === 'take-mine').map((r) => r.entry),
      wholePile: [...reads.keys()],
    }),
    reset: () => reads.clear(),
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/domain/pileSession.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/domain/pileSession.ts src/domain/pileSession.test.ts
git commit -m "feat(conferir): add createPileSession accumulator for the pile-scan finish step"
```

---

### Task 2: Route the ephemeral `conferir-report` screen

Add the new screen to the `Screen` union and routing maps. It shares Banca's `trocar` slug (like `conferir`), is absent from the reverse parse map, and the bottom nav highlights Trocar for it.

**Files:**
- Modify: `src/ui/Nav.tsx` (the `Screen` union + the `active` derivation)
- Modify: `src/ui/routing.ts` (the `SLUGS` map)
- Test: `src/ui/routing.test.ts` (add cases)

**Interfaces:**
- Produces: `Screen` union now includes `'conferir-report'`; `hashFromScreen('conferir-report') === 'trocar'`; `screenFromHash('#trocar') === 'trade'` (unchanged — conferir-report is never a parse target).

- [ ] **Step 1: Add a failing routing test**

Add inside the existing `describe('hashFromScreen', ...)` block in `src/ui/routing.test.ts`, after the `report` case:

```ts
  it('writes the trocar slug for the ephemeral conferir-report screen', () => {
    expect(hashFromScreen('conferir-report')).toBe('trocar');
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/ui/routing.test.ts`
Expected: FAIL — `hashFromScreen('conferir-report')` returns `undefined` (and TS flags `'conferir-report'` as not assignable to `Screen`).

- [ ] **Step 3: Add the screen to the union**

In `src/ui/Nav.tsx`, extend the union (lines 3–10):

```ts
export type Screen =
  | 'scan'
  | 'report'
  | 'collection'
  | 'trade'
  | 'repeats'
  | 'conferir'
  | 'conferir-report'
  | 'settings';
```

And extend the `active` derivation (line 27) so the new screen highlights the Trocar tab:

```ts
  // Report lives "inside" the scan flow (Escanear tab); Conferir + its finish step are launched
  // from Trocar (Trocar tab).
  const active =
    current === 'report'
      ? 'scan'
      : current === 'conferir' || current === 'conferir-report'
        ? 'trade'
        : current;
```

- [ ] **Step 4: Add the slug mapping**

In `src/ui/routing.ts`, add the entry to `SLUGS` (after the `conferir` line, ~line 16). `SLUGS` is `Record<Screen, string>`, so this is required for the build to pass:

```ts
  conferir: 'trocar',
  // Conferir's finish step ("Terminar") — ephemeral like `report`/`conferir`: shares the Trocar slug
  // and is absent from the reverse map, so a refresh lands on Trocar (don't relaunch a camera cold).
  'conferir-report': 'trocar',
```

Leave `SCREENS` (the reverse map) unchanged — `conferir-report` is never a parse target.

- [ ] **Step 5: Run tests + typecheck**

Run: `npx vitest run src/ui/routing.test.ts && npm run typecheck`
Expected: routing tests PASS; typecheck PASS (no other file references the new member yet).

- [ ] **Step 6: Commit**

```bash
git add src/ui/Nav.tsx src/ui/routing.ts src/ui/routing.test.ts
git commit -m "feat(routing): add ephemeral conferir-report screen (shares Trocar slug)"
```

---

### Task 3: Extract the `useScanner` engine hook; `ScanScreen` consumes it

Move the camera/OCR/recognize/confirmer/commit engine out of `ScanScreen` into a reusable hook. **Behavior-preserving code-motion** — the album scanner must behave identically. This is the cardinal-rule-sensitive task: capture a `bench:pixel` baseline first.

**Files:**
- Create: `src/ui/hooks/useScanner.ts`
- Modify: `src/ui/screens/ScanScreen.tsx` (remove the moved engine code; call the hook)

**Interfaces:**
- Consumes: `MatchResult`, `OcrEngine`, `AutoCapture`, `CaptureResult`, `SettingsStore` from `src/types.ts`; `CONFIG`; `checklist`; `matchCode`; `createConfirmer`; `allowCommit`; `createHybridOcrEngine`; `createCameraSource`; `useRoiViewport`; `recognizeFrameInOrder`, `recognizeFrameCodeNet`; `CodeNet`; `createAutoCapture`; `createScreenWakeLock`.
- Produces:

```ts
export type CameraState = 'loading' | 'ready' | 'denied';
export interface UseScannerOptions {
  onMatches: (matches: MatchResult[]) => void;
  settings: SettingsStore;
  cameraSetting: 'camera' | 'conferirCamera';
  debug?: boolean;
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
export function useScanner(opts: UseScannerOptions): Scanner;
```

- [ ] **Step 1: Capture the bench:pixel baseline (before any change)**

Run: `npm run bench:pixel -- --split=val`
Then copy `captures/bench-pixel-results.md` to a scratch file so you can diff after:
```bash
cp captures/bench-pixel-results.md /tmp/bench-pixel-baseline.md
```
Record the VAL recall, per-frame FP, confirmed-sticker FP, and det+ocr median/p95 latency. These are the numbers Task 3 and Task 4 must hold.

- [ ] **Step 2: Create the hook**

Create `src/ui/hooks/useScanner.ts`. The engine body below is lifted verbatim from the current `ScanScreen.tsx` (the `ensureOcr`, `recognizeCanvas`, the four effects, `flipCamera`, `retryCamera`); the only changes are: the result sink is the injected `onMatches` (instead of `handleMatches`); `DEBUG`/`RECORD` become the `debug`/`record` options; the debug heartbeat + readouts become hook state exposed in the return; the facing key is `cameraSetting`.

```ts
import { useEffect, useRef, useState } from 'preact/hooks';
import type { AutoCapture, CaptureResult, MatchResult, OcrEngine, SettingsStore } from '../../types';
import { CONFIG } from '../../config';
import { checklist } from '../../data/checklist';
import { matchCode } from '../../domain/matching';
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
   *  read that found nothing. The screen decides one-vs-many and what to record. */
  onMatches: (matches: MatchResult[]) => void;
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
          onMatches(toCommit);
        } else if (!opts.silent) {
          onMatches([]);
        }
        const committed = opts.confirm
          ? confirmerRef.current.committedCount() > 0
          : toCommit.length > 0;
        return { stop: opts.confirm ? stopBurst : true, committed, detected: crops > 0 };
      } catch {
        if (!opts.silent) onMatches([]);
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
    onMatches([matchCode(value, checklist)]);
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
```

- [ ] **Step 3: Rewire `ScanScreen` to use the hook**

In `src/ui/screens/ScanScreen.tsx`:

1. **Delete** the engine refs/state/functions now owned by the hook: `ocrRef`, `ocrInitRef`, `codeNetRef`, `sourceRef`, `captureRef`, `recognizeChainRef`, `recSeqRef`, `confirmerRef`, `lastCommitAtRef`, `committedThisBurstRef`, `scanPhaseRef`; the state `cameraState`, `ocrProgress`, `ocrReady`, `ocrFailed`, `facing`, `scanPhase`, `beat`, `recCount`, `debugText`; the functions `ensureOcr`, `recognizeCanvas`, `postDebugImg`, `captureNow`, `flipCamera`, `retryCamera`; and the four effects (scan-active lock, wake lock, OCR lifecycle, camera lifecycle) plus the `useRoiViewport` call. Keep `videoLayerRef`? No — it comes from the hook now; delete the local one.

2. **Keep** the album-specific state/logic: `multiTimerRef`, `audioCtxRef`, `flashCounter`, and the state `verdict`, `multi`, `announce`, `counters`, `recent`, `showManual`, `showImport`, `manualValue`; the functions `radarServesFor`, `handleMatches`, `showMulti`, `clearMulti`, `haptic`, `beep`, `submitManual`, `handleWrong`.

3. **Add** the hook call near the top of the component body (after the kept refs/state):

```ts
const scanner = useScanner({
  onMatches: handleMatches,
  settings,
  cameraSetting: 'camera',
  debug: DEBUG,
  record: RECORD,
});
```

4. **Add** a screen-local cleanup effect for the album-only timers (the hook does NOT own these):

```ts
useEffect(() => {
  return () => {
    window.clearTimeout(multiTimerRef.current);
    audioCtxRef.current?.close().catch(() => {});
  };
}, []);
```

5. **Replace** every former local reference in the render with the hook's: `scanner.cameraState`, `scanner.ocrReady`, `scanner.ocrFailed`, `scanner.ocrProgress`, `scanner.reading`, `scanner.facing`, `scanner.videoLayerRef`, `scanner.flipCamera`, `scanner.retryCamera`. The debug box reads `scanner.debug.beat` / `scanner.debug.text`; the REC badge reads `scanner.debug.recCount`. The `onClick={DEBUG ? captureNow : undefined}` on `.cam` becomes `onClick={DEBUG ? scanner.captureNow : undefined}`. `submitManual` calls `scanner.submitManualCode(value)` instead of `handleMatches([matchCode(...)])`:

```ts
const submitManual = (e: Event) => {
  e.preventDefault();
  const value = manualValue.trim();
  if (!value) return;
  scanner.submitManualCode(value);
  setManualValue('');
  setShowManual(false);
};
```

6. **Remove** now-orphaned imports from `ScanScreen.tsx`: `OcrEngine`, `AutoCapture`, `CaptureResult` types (if no longer referenced), `CONFIG` (only if unused after — it IS still used? check; `CONFIG.ocr.maxWidth` moved to the hook, `CONFIG.match.confirmations` moved too — if nothing else uses CONFIG, drop it), `createConfirmer`, `allowCommit`, `createHybridOcrEngine`, `createCameraSource`, `useRoiViewport`, `recognizeFrameInOrder`, `recognizeFrameCodeNet`, `CodeNet`, `createAutoCapture`, `createScreenWakeLock`. **Keep**: `matchCode`? No — manual entry now goes through `scanner.submitManualCode`, so `matchCode` is no longer used in ScanScreen; remove it. Keep `checklist` (used by `handleMatches`? it uses `match.entry` not checklist directly — check; `radarServesFor` uses stores, not checklist; if checklist is unused, remove it). **Add** the import: `import { useScanner } from '../hooks/useScanner';`. Run the build to find every orphan (strict `noUnusedLocals`/`noUnusedParameters` will name them).

- [ ] **Step 4: Typecheck + tests**

Run: `npm run build`
Expected: PASS. If it fails, it will name an unused import or a missed reference — fix and re-run.
Run: `npm test`
Expected: PASS (no test targets ScanScreen's render directly).

- [ ] **Step 5: Verify the cardinal rule held (bench:pixel)**

Run: `npm run bench:pixel -- --split=val`
Compare `captures/bench-pixel-results.md` to `/tmp/bench-pixel-baseline.md`: VAL recall, per-frame FP, confirmed-sticker FP, and det+ocr latency must match the baseline (this is pure code-motion). If any metric moved, the extraction changed behavior — diff the hook against the original `ScanScreen` engine code and fix before committing.

- [ ] **Step 6: Commit**

```bash
git add src/ui/hooks/useScanner.ts src/ui/screens/ScanScreen.tsx
git commit -m "refactor(scan): extract the scan engine into useScanner; ScanScreen consumes it"
```

---

### Task 4: Extract the `<ScanShell>` chrome component; `ScanScreen` consumes it

Move the shared camera markup (mira, overlays, top-bar action group, manual sheet) into a presentational component with slots. **Behavior-preserving** for the album screen.

**Files:**
- Create: `src/ui/components/ScanShell.tsx`
- Modify: `src/ui/screens/ScanScreen.tsx` (render via `<ScanShell>`)

**Interfaces:**
- Consumes: `CameraState` from `../hooks/useScanner`; `pt` from i18n.
- Produces: `<ScanShell>` accepting the props below; it owns the manual-sheet open/value via the controlled `manualOpen`/`setManualOpen` + local input state, and renders the slots `topLeft`, `finishAction`, `overlay`, `bottom`, `manualExtra`.

- [ ] **Step 1: Create the component**

```tsx
// src/ui/components/ScanShell.tsx
import { useState } from 'preact/hooks';
import type { ComponentChildren, RefObject } from 'preact';
import { pt } from '../../i18n/pt';
import type { CameraState } from '../hooks/useScanner';

export interface ScanShellProps {
  pageTitle: string;
  pageSubtitle: string;
  /** sr-only assertive announcement of each scan result. */
  announce: string;
  /** Hint under the mira when idle (differs per screen); the "reading" hint is shared. */
  holdStillText: string;

  cameraState: CameraState;
  ocrReady: boolean;
  ocrFailed: boolean;
  ocrProgress: number;
  reading: boolean;
  facing: 'user' | 'environment';
  videoLayerRef: RefObject<HTMLDivElement>;
  onFlip: () => void;
  onRetry: () => void;

  /** Manual-entry sheet — controlled by the screen (one source of truth for "open"). */
  manualOpen: boolean;
  setManualOpen: (open: boolean) => void;
  onManualSubmit: (value: string) => void;

  /** Optional extra root class (e.g. 'conferir-screen'). */
  rootClass?: string;
  /** ?debug tap-to-capture handler on the camera area (undefined = none). */
  onCamClick?: () => void;
  /** ?debug / ?record readouts (empty/false = hidden). */
  debugBeat?: string;
  debugText?: string;
  recCount?: number;
  recording?: boolean;

  // ---- slots ----
  /** cam-top, left side: counters, or back + counters. */
  topLeft?: ComponentChildren;
  /** cam-top actions, before the manual/flip icons: the "Terminar" pill (or nothing). */
  finishAction?: ComponentChildren;
  /** A full-camera overlay panel above cam-bottom (e.g. the multi-sticker panel). */
  overlay?: ComponentChildren;
  /** cam-bottom dock: verdict + screen-specific content. */
  bottom?: ComponentChildren;
  /** Extra control inside the manual sheet (e.g. ScanScreen's "Colar lista"). */
  manualExtra?: ComponentChildren;
}

export function ScanShell({
  pageTitle,
  pageSubtitle,
  announce,
  holdStillText,
  cameraState,
  ocrReady,
  ocrFailed,
  ocrProgress,
  reading,
  facing,
  videoLayerRef,
  onFlip,
  onRetry,
  manualOpen,
  setManualOpen,
  onManualSubmit,
  rootClass,
  onCamClick,
  debugBeat,
  debugText,
  recCount,
  recording,
  topLeft,
  finishAction,
  overlay,
  bottom,
  manualExtra,
}: ScanShellProps) {
  const [manualValue, setManualValue] = useState('');

  const submit = (e: Event) => {
    e.preventDefault();
    const value = manualValue.trim();
    if (!value) return;
    onManualSubmit(value);
    setManualValue('');
    setManualOpen(false);
  };

  return (
    <div class={`screen scan-screen${rootClass ? ' ' + rootClass : ''}`}>
      <p class="sr-only" role="status" aria-live="assertive">
        {announce}
      </p>

      <div class="pagetab">
        <span class="pagetab-name">{pageTitle}</span>
        <span class="pagetab-pg">{pageSubtitle}</span>
      </div>

      <div class="cam" onClick={onCamClick}>
        <div class="cam-top">
          {topLeft}
          <div class="cam-top-actions">
            {finishAction}
            {cameraState !== 'denied' && (
              <>
                <button
                  class="cam-icon-btn"
                  onClick={() => setManualOpen(true)}
                  aria-label={pt.scan.manualEntry}
                  title={pt.scan.manualEntry}
                >
                  📝
                </button>
                <button
                  class="cam-icon-btn"
                  onClick={onFlip}
                  aria-label={pt.scan.flipCamera}
                  title={facing === 'user' ? pt.scan.cameraFront : pt.scan.cameraBack}
                >
                  🔄
                </button>
              </>
            )}
          </div>
        </div>

        {recording && (
          <div class="scan-rec" role="status">
            <span class="scan-rec-dot" aria-hidden="true" />
            Gravando · {recCount}
          </div>
        )}

        {debugBeat !== undefined && (
          <div class="debug-box">
            {debugBeat || 'iniciando…'}
            {debugText ? ` · ${debugText}` : ''}
          </div>
        )}

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
            {ocrReady && !bottom && (
              <span class={reading ? 'hint reading' : 'hint'}>
                <span class="pulse" aria-hidden="true" />
                {reading ? pt.scan.reading : holdStillText}
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
            <button class="miss-action" type="button" onClick={() => setManualOpen(true)}>
              📝 {pt.scan.manualOpen}
            </button>
          </div>
        )}
        {cameraState === 'denied' && (
          <div class="scan-overlay scan-denied">
            <div class="scan-denied-emoji">📷</div>
            <h2>{pt.scan.cameraDenied}</h2>
            <p>{pt.scan.cameraDeniedHint}</p>
            <button class="btn btn-primary" onClick={onRetry}>
              {pt.scan.retry}
            </button>
          </div>
        )}

        {overlay}

        <div class="cam-bottom">{bottom}</div>
      </div>

      {manualOpen && (
        <div class="manual-sheet">
          <form class="manual-form" onSubmit={submit}>
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
              <button class="btn btn-ghost" type="button" onClick={() => setManualOpen(false)}>
                {pt.scan.manualCancel}
              </button>
              <button class="btn btn-primary" type="submit">
                {pt.scan.manualConfirm}
              </button>
            </div>
            {manualExtra}
          </form>
        </div>
      )}
    </div>
  );
}
```

> Note: the idle hint is hidden when `bottom` is truthy (a verdict/dock is docked). In ScanScreen today the hint hides on `verdict || multi`; passing the verdict/recent dock as `bottom` reproduces that. The multi-sticker `<MultiResult>` goes in the `overlay` slot so it still sits as a full-camera panel above the dock.

- [ ] **Step 2: Render `ScanScreen` through `<ScanShell>`**

Replace `ScanScreen`'s returned JSX (the whole `<div class="screen scan-screen"> … </div>` plus the trailing `{showImport && …}`) with:

```tsx
return (
  <>
    <ScanShell
      pageTitle={pt.scan.pageTitle}
      pageSubtitle={pt.scan.pageSubtitle}
      announce={announce}
      holdStillText={pt.scan.holdStill}
      cameraState={scanner.cameraState}
      ocrReady={scanner.ocrReady}
      ocrFailed={scanner.ocrFailed}
      ocrProgress={scanner.ocrProgress}
      reading={scanner.reading}
      facing={scanner.facing}
      videoLayerRef={scanner.videoLayerRef}
      onFlip={scanner.flipCamera}
      onRetry={scanner.retryCamera}
      manualOpen={showManual}
      setManualOpen={setShowManual}
      onManualSubmit={(v) => scanner.submitManualCode(v)}
      onCamClick={DEBUG ? scanner.captureNow : undefined}
      debugBeat={DEBUG ? scanner.debug.beat : undefined}
      debugText={DEBUG ? scanner.debug.text : undefined}
      recCount={scanner.debug.recCount}
      recording={RECORD}
      topLeft={
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
      }
      finishAction={
        !session.isEmpty() && (
          <button class="finish-pill" onClick={onFinish}>
            {pt.scan.finish}
          </button>
        )
      }
      overlay={multi && <MultiResult items={multi} />}
      bottom={
        <>
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
            <Verdict state={verdict} onManual={() => setShowManual(true)} onWrong={handleWrong} />
          )}
        </>
      }
      manualExtra={
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
      }
    />
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
  </>
);
```

> The `bottom` slot is truthy whenever `recent.length > 0 || (verdict && !multi)`. To exactly preserve the "hint hides while a verdict/multi is up" behavior, ScanShell hides the hint when `bottom` is truthy — and the album bottom is empty only when there is no recent strip and no verdict, matching today.

- [ ] **Step 3: Clean imports + typecheck**

Add `import { ScanShell } from '../components/ScanShell';`. Remove any now-unused imports the build flags. `pt.scan.holdStill`, `pt.scan.reading`, `pt.scan.slotLabel`, the manual-sheet strings, the overlay strings are now referenced inside `ScanShell`, so ScanScreen may no longer reference some `pt.scan.*` keys directly — that's fine (`pt` is still imported and used).

Run: `npm run build`
Expected: PASS.

- [ ] **Step 4: Tests + bench**

Run: `npm test`
Expected: PASS.
Run: `npm run bench:pixel -- --split=val` and compare to `/tmp/bench-pixel-baseline.md` — metrics must hold (markup-only change; should be identical).

- [ ] **Step 5: Manual smoke (album scanner)**

Run `npm run dev`, open the app, go to Escanear. Confirm: camera preview shows in the mira, the "Mostre o verso…" hint appears, a scanned back produces a GUARDAR/REPETIDA verdict, the 📝 and 🔄 icons work, the Terminar pill appears after a scan and opens the report. (If no Pixel/sticker handy, at least confirm the screen renders with the camera and the manual-entry sheet commits a code.)

- [ ] **Step 6: Commit**

```bash
git add src/ui/components/ScanShell.tsx src/ui/screens/ScanScreen.tsx
git commit -m "refactor(scan): extract shared <ScanShell> chrome; ScanScreen renders through it"
```

---

### Task 5: `ConferirReportScreen` (the Terminar finish step) + i18n

A new ephemeral screen, symmetric to `ReportScreen`: review which scanned stickers you actually took → save to collection, plus share the whole pile back to the friend. Does NOT auto-navigate after save. Standalone here (wired in Task 6).

**Files:**
- Create: `src/ui/screens/ConferirReportScreen.tsx`
- Modify: `src/i18n/pt.ts` (add finish-step strings under `conferir`)
- Test: `src/ui/screens/ConferirReportScreen.test.ts`

**Interfaces:**
- Consumes: `PileReport` from `src/domain/pileSession.ts`; `CollectionStore` from `src/types.ts`; `PileShareSheet` from `src/ui/components/PileShareSheet`; `pt`.
- Produces: `ConferirReportScreen` (props `{ report: PileReport; collection: CollectionStore; name?: string; onBack: () => void }`).

- [ ] **Step 1: Add the i18n strings**

In `src/i18n/pt.ts`, inside the `conferir:` object (after `reviewCancel: 'Agora não',` on line 133), add:

```ts
    // The "Terminar" finish step (a screen, like the album's report): review what you took + share back.
    finishTitle: 'Terminar a troca',
    finishPileCount: 'na pilha',
    finishTakeCount: 'pra você',
    takenEmpty: 'Você não precisa de nenhuma dessa pilha — mas ainda dá pra mandar a lista pro amigo.',
```

- [ ] **Step 2: Write the failing test**

```ts
// src/ui/screens/ConferirReportScreen.test.ts
import { describe, expect, it } from 'vitest';
import { pt } from '../../i18n/pt';

// The finish step reuses the review modal's pluralized save label; assert the new strings exist
// and the save label agrees in number (the cardinal idiom: never overstate what was saved).
describe('conferir finish-step strings', () => {
  it('has the finish-step labels', () => {
    expect(pt.conferir.finishTitle).toBe('Terminar a troca');
    expect(pt.conferir.takenEmpty.length).toBeGreaterThan(0);
  });

  it('pluralizes the save label by count', () => {
    expect(pt.conferir.reviewSave(0)).toBe('Salvar na coleção');
    expect(pt.conferir.reviewSave(1)).toBe('Salvar 1 na coleção');
    expect(pt.conferir.reviewSave(3)).toBe('Salvar 3 na coleção');
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run src/ui/screens/ConferirReportScreen.test.ts`
Expected: FAIL — `pt.conferir.finishTitle` is `undefined` until Step 1 is saved (if you did Step 1 first, the `finishTitle`/`takenEmpty` assertions pass but the file still needs to exist; the failing signal here is the missing strings or, if added, this test passes — in that case proceed, the screen itself is verified by build + manual).

- [ ] **Step 4: Create the screen**

```tsx
// src/ui/screens/ConferirReportScreen.tsx
import { useState } from 'preact/hooks';
import type { CollectionStore } from '../../types';
import type { PileReport } from '../../domain/pileSession';
import { pt } from '../../i18n/pt';
import { PileShareSheet } from '../components/PileShareSheet';

interface ConferirReportScreenProps {
  report: PileReport;
  collection: CollectionStore;
  /** Sender's name for the share message (already sanitized; undefined = anonymous). */
  name?: string;
  onBack: () => void;
}

/**
 * The Conferir finish step ("Terminar"), symmetric to the album's ReportScreen. Two goal-appropriate
 * actions on one screen: (1) review which scanned stickers you actually TOOK in the trade → mark them
 * owned (preserving the cardinal rule: only what you physically have), and (2) share the friend's whole
 * pile back to them. Unlike ReportScreen it does NOT auto-navigate after saving — you may save AND then
 * share — so saving shows inline success and the share stays available; the only exit is "Voltar".
 */
export function ConferirReportScreen({ report, collection, name, onBack }: ConferirReportScreenProps) {
  const { taken, wholePile } = report;
  // Take-mine rows default checked; the user un-checks any they didn't actually take.
  const [checked, setChecked] = useState<Set<string>>(() => new Set(taken.map((e) => e.code)));
  // What was actually saved this session — excluded from the share (you took those dupes).
  const [savedTaken, setSavedTaken] = useState<Set<string>>(() => new Set());
  const [savedMsg, setSavedMsg] = useState<string | null>(null);
  const [shareOpen, setShareOpen] = useState(false);

  const toggle = (code: string) =>
    setChecked((prev) => {
      const next = new Set(prev);
      next.has(code) ? next.delete(code) : next.add(code);
      return next;
    });

  const save = () => {
    const codes = [...checked];
    if (codes.length === 0) return;
    collection.setOwned(codes, true);
    setSavedTaken((s) => new Set([...s, ...codes]));
    setSavedMsg(pt.conferir.saved(codes.length));
  };

  return (
    <div class="screen report-screen conferir-report-screen">
      <header class="report-header">
        <h1>{pt.conferir.finishTitle}</h1>
        <div class="report-totals">
          <div class="total-card">
            <b>{wholePile.length}</b>
            <span>{pt.conferir.finishPileCount}</span>
          </div>
          <div class="total-card total-keep">
            <b>{taken.length}</b>
            <span>{pt.conferir.finishTakeCount}</span>
          </div>
        </div>
      </header>

      <section class="report-section">
        <div class="report-section-head">
          <h2>{pt.conferir.reviewTitle}</h2>
        </div>
        <p class="report-sub">{pt.conferir.reviewSub}</p>
        {taken.length === 0 ? (
          <p class="report-empty">{pt.conferir.takenEmpty}</p>
        ) : (
          <ul class="report-list">
            {taken.map((e) => {
              const isChecked = checked.has(e.code);
              return (
                <li key={e.code}>
                  <label class={`report-row ${isChecked ? 'is-checked' : ''}`}>
                    <input type="checkbox" checked={isChecked} onChange={() => toggle(e.code)} />
                    <span class="report-check" aria-hidden="true" />
                    <span class="report-code">{e.display}</span>
                    <span class="report-team">{e.teamName}</span>
                  </label>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <div class="report-footer">
        {savedMsg && (
          <div class="conferir-notice" role="status" aria-live="polite">
            {savedMsg}
          </div>
        )}
        {taken.length > 0 && (
          <button class="btn btn-primary btn-block" disabled={checked.size === 0} onClick={save}>
            {pt.conferir.reviewSave(checked.size)}
          </button>
        )}
        {wholePile.length > 0 && (
          <button class="btn btn-secondary btn-block" onClick={() => setShareOpen(true)}>
            {pt.pile.shareCta}
          </button>
        )}
        <button class="btn btn-ghost btn-block" onClick={onBack}>
          {pt.conferir.back}
        </button>
      </div>

      {shareOpen && (
        <PileShareSheet
          pile={wholePile}
          taken={[...savedTaken]}
          name={name}
          onClose={() => setShareOpen(false)}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 5: Typecheck + tests**

Run: `npm run build`
Expected: PASS (the new screen is an exported-but-not-yet-imported component — allowed; an unused export is fine, only unused locals/imports fail).
Run: `npx vitest run src/ui/screens/ConferirReportScreen.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/ui/screens/ConferirReportScreen.tsx src/ui/screens/ConferirReportScreen.test.ts src/i18n/pt.ts
git commit -m "feat(conferir): add ConferirReportScreen finish step (review takes + share back)"
```

---

### Task 6: Thin live `ConferirScreen` + wire `app.tsx`

Rewrite `ConferirScreen` as a thin live-only screen consuming `useScanner` + `<ScanShell>`, with a "Terminar" pill and the pile state lifted to `app.tsx`. Wire the `pileSession` accumulator, the `pileReport` state, the `conferir-report` render branch, and `finishConferir`. This is one atomic change (the prop change forces the app wiring).

**Files:**
- Rewrite: `src/ui/screens/ConferirScreen.tsx`
- Modify: `src/app.tsx`

**Interfaces:**
- Consumes: `useScanner`, `ScanShell`, `ConferirVerdict`/`ConferirVerdictState`, `friendsNeeding`/`huntVerdict` from friendMatch, `PileSession` from pileSession, `pt`, `CONFIG`? no.
- Produces: `ConferirScreen` props become `{ collection: CollectionStore; friendLists: FriendListsStore; settings: SettingsStore; pileSession: PileSession; onFinish: () => void; onBack: () => void }`.

- [ ] **Step 1: Rewrite `ConferirScreen.tsx`**

Replace the entire file with:

```tsx
import { useEffect, useState } from 'preact/hooks';
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
  let flashKey = 0;

  // READ-ONLY result handling: compute a verdict, record into the pile, persist nothing here.
  const handleMatch = (matches: MatchResult[]) => {
    flashKey += 1;
    const key = flashKey;
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

  // flashKey is a render-local counter; reset it across renders via a ref-free closure is fine because
  // each committed read sets a fresh verdict with its own incremented key through state below.
  // (Verdict re-animation relies only on the key CHANGING, and setVerdict triggers a render.)
  useEffect(() => {
    // No screen-local timers/audio here (unlike ScanScreen) — nothing to clean up.
  }, []);

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
```

> The `flashKey` counter: today `ConferirScreen` uses a `flashCounter` ref. A render-local `let` resets each render, which would break the "re-animate on identical repeat" key. **Use a ref instead** to match the original — replace `let flashKey = 0;` with `const flashCounterRef = useRef(0);` (add `useRef` to the import) and `flashCounterRef.current += 1; const key = flashCounterRef.current;`. Remove the empty `useEffect`. (The empty-effect block above is illustrative only — delete it.)

- [ ] **Step 2: Fix the flashKey ref + drop the illustrative effect**

Apply the note: import `useRef`, use `const flashCounterRef = useRef(0);` and `flashCounterRef.current += 1;`, and delete the empty `useEffect`. Final import line:

```ts
import { useRef, useState } from 'preact/hooks';
```

(`useEffect` is no longer used in this file — do not import it.)

- [ ] **Step 3: Wire `app.tsx`**

In `src/app.tsx`:

1. Add imports:
```ts
import { createPileSession } from './domain/pileSession';
import type { PileReport } from './domain/pileSession';
import { ConferirReportScreen } from './ui/screens/ConferirReportScreen';
import { sanitizeName } from './domain/name';
```
(`sanitizeName` — confirm the path; `ConferirScreen` imported it from `../../domain/name`, so from `app.tsx` it is `./domain/name`.)

2. Inside `App()`, after `const session = useMemo(loadSession, []);` (~line 116), add:
```ts
// Conferir's pile accumulator (mirrors `session`): in-memory, read-only over the collection.
const pileSession = useMemo(createPileSession, []);
const [pileReport, setPileReport] = useState<PileReport | null>(null);
```

3. Add the finish handler near `finishSession` (~line 175):
```ts
/** Build the Conferir pile report and move to its finish step (Terminar). */
const finishConferir = () => {
  setPileReport(pileSession.finish());
  setScreen('conferir-report');
};
```

4. Change the `conferir` render branch (lines 240–247) to pass the new props:
```tsx
{screen === 'conferir' && (
  <ConferirScreen
    collection={collection}
    friendLists={friendLists}
    settings={settings}
    pileSession={pileSession}
    onFinish={finishConferir}
    onBack={() => setScreen('trade')}
  />
)}

{screen === 'conferir-report' && pileReport && (
  <ConferirReportScreen
    report={pileReport}
    collection={collection}
    name={sanitizeName(settings.get().name) || undefined}
    onBack={() => {
      setPileReport(null);
      setScreen('trade');
    }}
  />
)}
```

5. Reset the pile when ENTERING a fresh Conferir session, so each trade starts clean. In the `TradeScreen` render (~line 234), change:
```tsx
onConferir={() => {
  pileSession.reset();
  setScreen('conferir');
}}
```
And in the `Onboarding` `onComplete` (~line 289), reset there too before routing to conferir:
```tsx
onComplete={(result) => {
  settings.set({ onboarded: true, ...(result.name ? { name: result.name } : {}) });
  if (result.start === 'conferir') pileSession.reset();
  setScreen(result.start === 'conferir' ? 'conferir' : 'scan');
}}
```

- [ ] **Step 4: Typecheck + tests**

Run: `npm run build`
Expected: PASS. The build will flag any leftover unused import in the rewritten `ConferirScreen` (e.g. the old `createConfirmer`, `allowCommit`, `createCameraSource`, `PileShareSheet`, `sanitizeName`, `matchCode`, `CONFIG`, `recognize*`, `createAutoCapture`, `createScreenWakeLock`, `ConferirVerdict` is kept) — the full rewrite in Step 1 already dropped them; confirm none remain.
Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Manual smoke (Conferir flow)**

`npm run dev` → Trocar → "Conferir figurinhas do amigo". Confirm: live scanning shows PEGA!/JÁ TENHO verdicts, the "pra você"/"pros amigos" chips increment, the **Terminar** pill appears after the first scan. Tap Terminar → the finish screen shows the "Pegou quais?" list (take-mine, checked), "Salvar N na coleção" marks them owned (inline "salvas!" notice, no auto-navigate), "Mandar a pilha pro amigo" opens the share sheet, "Voltar" returns to Trocar. Re-enter Conferir → counters start at 0 (pile reset on entry).

- [ ] **Step 6: Commit**

```bash
git add src/ui/screens/ConferirScreen.tsx src/app.tsx
git commit -m "feat(conferir): thin live scanner + Terminar step (shared engine/chrome, lifted pile)"
```

---

### Task 7: CHANGELOG + final full verification

**Files:**
- Modify: `CHANGELOG.md`

- [ ] **Step 1: Update the CHANGELOG**

Add an entry under the current unreleased/top section (match the existing pt-BR style and heading format already in the file):

```markdown
- Scanners unificados: Escanear e Conferir agora compartilham o mesmo motor (`useScanner`) e a mesma
  moldura de câmera (`ScanShell`). O Conferir ganhou um passo **"Terminar"** (revisar o que você pegou
  → salvar na coleção, e mandar a pilha pro amigo), igual ao fluxo do Escanear.
```

- [ ] **Step 2: Full build + tests**

Run: `npm run build && npm test`
Expected: both PASS.

- [ ] **Step 3: Final bench:pixel on the TEST split**

Run: `npm run bench:pixel -- --split=test`
Expected: recall, per-frame FP, **confirmed-sticker FP (~0)**, and det+ocr latency consistent with the album scanner's behavior before this work (the engine is unchanged logic, only relocated). Record the numbers in the commit message if any reviewer asks for the cardinal-rule evidence.

- [ ] **Step 4: Commit**

```bash
git add CHANGELOG.md
git commit -m "docs(changelog): unified scanners + Conferir 'Terminar' step"
```

---

## Self-Review

**Spec coverage:**
- Shared `useScanner` engine → Task 3. ✓
- Shared `<ScanShell>` chrome → Task 4. ✓
- `createPileSession` accumulator (in-memory, mirrors session) → Task 1. ✓
- `ConferirReportScreen` finish step (review takes + share, no auto-navigate) → Task 5. ✓
- Conferir live screen → pure scanning + Terminar pill; inline Salvar/Share removed → Task 6. ✓
- `conferir-report` ephemeral route (shares `trocar` slug, omitted from reverse, Nav→trade) → Task 2. ✓
- `app.tsx` wiring (pileSession + pileReport + finishConferir + reset-on-enter) → Task 6. ✓
- Verdict components stay separate → preserved (Verdict in ScanScreen, ConferirVerdict in ConferirScreen). ✓
- Dev `CaptureScreen` untouched → not referenced by any task. ✓
- Verification gate (build + test + bench:pixel; baseline before refactor) → Tasks 3, 7. ✓
- CHANGELOG + pt-BR → Task 7. ✓

**Placeholder scan:** No TBD/TODO. Every code step shows complete code; the engine body in Task 3 is the full lifted implementation, not a reference. The one "illustrative" empty effect in Task 6 Step 1 is explicitly deleted in Step 2.

**Type consistency:** `add(entry, kind): boolean` is consistent across Task 1 (definition), its test, and Task 6 (`if (pileSession.add(...)) bumpTally(...)`). `PileReport` = `{ taken: ChecklistEntry[]; wholePile: string[] }` is consistent across Tasks 1, 5, 6. `CameraState` is exported from `useScanner` and imported by `ScanShell` (Task 4) — same name. `Scanner` return fields (`videoLayerRef`, `cameraState`, `ocrReady`, `ocrFailed`, `ocrProgress`, `facing`, `reading`, `flipCamera`, `retryCamera`, `submitManualCode`, `captureNow`, `debug`) are consumed exactly by ScanScreen (Task 4) and ConferirScreen (Task 6). `ConferirScreen` prop set (`collection`, `friendLists`, `settings`, `pileSession`, `onFinish`, `onBack`) matches the `app.tsx` render in Task 6.

**Risk note:** Tasks 3–4 touch the cardinal 0-FP hot path. They are pure code-motion, gated by the `bench:pixel` baseline captured in Task 3 Step 1. If a metric regresses, stop and diff against the original before committing.
