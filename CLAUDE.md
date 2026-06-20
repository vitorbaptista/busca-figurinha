# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Working principles

Behavioral guidelines to reduce common LLM coding mistakes. These bias toward caution over speed —
for trivial tasks, use judgment. They reinforce the project-specific invariants below; where they
conflict, the project rules win.

1. **Think before coding.** State assumptions explicitly; if uncertain, ask. If multiple
   interpretations exist, present them — don't pick silently. If a simpler approach exists, say so.
   If something is unclear, stop and name what's confusing.
2. **Simplicity first.** Minimum code that solves the problem, nothing speculative — no unrequested
   features, abstractions for single-use code, configurability, or error handling for impossible
   scenarios. If 200 lines could be 50, rewrite it. (But never "simplify" away the documented
   invariants below — those are load-bearing.)
3. **Surgical changes.** Touch only what you must. Don't "improve" adjacent code, refactor what
   isn't broken, or reformat — match existing style even if you'd do it differently (this repo
   already asks you to match surrounding comment density and naming). Remove only the
   imports/variables YOUR changes orphaned; flag pre-existing dead code, don't delete it. Every
   changed line should trace to the request.
4. **Goal-driven execution.** Turn tasks into verifiable goals ("fix the bug" → "write a test that
   reproduces it, then make it pass"). For multi-step work, state a brief plan with a verify step
   per item. Remember the cardinal gate here: **0 false positives** and `npm run build` (typecheck)
   must hold.

## What this is

A Portuguese (pt-BR) PWA that scans the **backs** of Panini World Cup 2026 album stickers
through the phone camera and instantly tells the user **GUARDAR** (keep — they need it) or
**REPETIDA** (discard — already owned). It runs 100% on-device: Preact + TypeScript + Vite,
a **hybrid recognizer** (a pure-JS glyph matcher first, `tesseract.js` only as fallback),
`idb-keyval` for storage. No backend, no login, offline after first load. Target users include
kids/teens on low-end phones, so performance and simplicity are priorities. **Reads ~85 ms/pass on
a Pixel** (down from ~465 ms) — see "Hard-won lessons" before you optimize further.

**Every user-facing text must be in pt-BR** — the README, CHANGELOG, and anything that appears in
the app itself. This does NOT apply to code, code comments, or this CLAUDE.md file.

## Commands

```bash
npm run dev          # dev server; also serves the OCR harness (/ocr-test.html) and dev fixtures
npm run build        # tsc --noEmit THEN vite build — the typecheck is part of the build
npm test             # vitest run (all tests)
npm run test:watch   # vitest watch
npm run typecheck    # tsc --noEmit only

npx vitest run src/domain/matching.test.ts   # a single test file
npx vitest run -t "restores a dropped THIN letter"   # a single test by name
```

There is **no linter** (no ESLint/Prettier). `tsc` is the only static gate, and the tsconfig is
strict: **`noUnusedLocals` + `noUnusedParameters` mean an unused variable or import fails
`npm run build`.** Match the surrounding comment density and naming when editing. **Keep
`CHANGELOG.md` updated** when you ship something notable.

## Architecture: the scan pipeline is the whole app

Everything important is the live camera → "KEEP/DISCARD" loop. The other screens (collection,
report, settings) are conventional. Reading these files in order explains the system:

1. **`src/ocr/frameSource.ts`** — wraps `getUserMedia` + a hidden `<video>`; `drawTo(canvas)` gives
   the raw (un-mirrored) frame. Front camera (`facingMode: 'user'`) is the default.
2. **`src/ocr/autoCapture.ts`** — hands-free trigger. Samples a tiny 160px frame-diff; when a
   sticker lands and holds **still**, it fires a **burst** of frames (`onCapture` returns `true` to
   stop the burst), then `locks` until motion re-arms. This is why scanning needs no taps.
3. **`src/ui/screens/ScanScreen.tsx`** — orchestrates it all. `recognizeCanvas` runs
   `recognizeFrameInOrder`, feeds results to the confirmer, and `handleMatches` drives
   flash/beep/haptic/session. OCR-init and the camera live in **separate effects** so flipping
   cameras restarts only the stream. A debug **heartbeat** (autoCapture `onTick`) shows the loop
   phase; a **commit cooldown** (`minRecaptureMs`) + the confirmer kill bogus rapid re-reads.
4. **`src/ocr/recognize.ts`** — THE one recognition strategy (shared by live + both benches, so they
   can't drift). `findCodeBoxes → codeCropSource (LAZY prep — flip crop built only if needed) →
   two-phase OCR best-box-first, stop on first checklist match`. **Two-phase**: glyph matcher reads
   ALL crops first; tesseract runs ONLY if no glyph read resolves a code → a sharp frame pays ZERO
   tesseract. `recognizeFrameInOrder` is also where the live `onCapture` commits.
5. **`src/ocr/locate.ts`** — finds the dark code pill(s) by SHAPE, not color: downscale → local
   adaptive threshold (integral-image box blur) → connected components → geometry gate (`scoreBox`).
   `codeCropSource`/`codeCropCandidates` make an upright + 180°-flip crop; `prepForOcr` upscales,
   binarizes light-text→black, flood-clears the margin, applies the **sparse-ink gate**.
   `CONFIG.detect.roiTopFraction` restricts detection to a bottom band of the **actual frame**.
6. **`src/ocr/hybridEngine.ts` + `glyphEngine.ts` + `engine.ts`** — the OCR backends. `hybridEngine`
   exposes `recognizeFast` (pure-JS `glyphEngine`: glyph segmentation + atlas nearest-neighbour) and
   `recognizeSlow` (`tesseract.js` pool of 2, crops never stacked). `CONFIG.ocr.hybridFastConf` is
   the glyph-accept gate.
7. **`src/domain/matching.ts`** — noisy OCR text → checklist entry (conservative; never invents).
8. **`src/domain/confirm.ts`** — multi-frame agreement before a result is committed.

`src/config.ts` holds every tunable in one place — adjust there, not inline. Knobs that matter most:
`detect.roiTopFraction` (bottom-band ROI), `ocr.hybridFastConf` (glyph accept), `match.confirmations`
(0-FP guard), `capture.{minRecaptureMs, stabilityMs, sampleIntervalMs}` (loop speed/felt latency).

## Non-obvious invariants — do not "simplify" these away

- **Per-crop OCR, never stacked.** Stacking crops into one image confuses Tesseract's layout
  analysis and drops thin glyphs (`CIV` → `CV`). Each crop gets its own `recognize` call.
- **Thin-letter recovery is the core correctness trick.** Tesseract cannot read this font's thin
  `I`, so `CIV 12` reads as `CV 12`. Because the engine only ever drops *thin* strokes (never a bold
  letter), `matchCode` restores a single dropped/added thin letter (`I/J/L/T`) when the result is
  **unique** — so `CV12`→`CIV12` is safe even though `CPV12` exists (reaching it would need a bold
  `P`). A garbled-but-*present* char (`C1V12`) stays ambiguous → `unknown`. See `matching.test.ts`.
- **Matching never guesses.** A miss is acceptable; a confidently wrong code is not (it costs a real
  trade). Corrections require a single unambiguous candidate; ties resolve to `unknown`.
- **Multi-frame confirmation.** The live burst only commits a code after the confirmer sees it on
  `≥ CONFIG.match.confirmations` frames, so a one-off blur that misreads one valid code as another
  can't post. The burst keeps reading until a frame adds no new confirmation, so co-present stickers
  aren't dropped when one confirms first.
- **Sparse-ink gate (`MAX_INK_FRACTION` in `locate.ts`).** A real code is a few sparse glyphs; any
  crop with more ink after the margin is cleared is a photo or fine print and gets blanked so OCR
  returns instantly. This is what keeps a busy multi-sticker frame fast.
- **Camera frames are not mirrored** by `getUserMedia` (mirroring is only a display choice), so the
  OCR canvas reads correctly for the front camera with no flip.
- **URL-hash routing has one writer, and it's `replaceState`.** `src/ui/routing.ts`'s `sectionUrl`
  is the SOLE place the address bar is written; `app.tsx` calls it from a single `useEffect`. Don't
  add a second `history.replaceState`/`pushState`/`location.hash =` site — two writers with
  different URL shapes fight (this is why the old `clearTradeQuery` was folded in; the `?t=`
  friend-link strip rides the same effect via its `dropQuery` arg). Use `replaceState`, **never**
  `pushState`/`location.hash =`: tab switches must NOT pile up history (Back exits the app), and
  `replaceState` doesn't fire `hashchange`, so there's no sync loop — there is deliberately **no
  `hashchange` listener**. `sectionUrl` must keep `location.pathname` (the GH-Pages base path) and
  `location.search` (the `?debug`/`?capture`/`?record` flags). The **`report` screen is ephemeral**
  (built from an already-cleared session) so it can't be deep-linked: it writes `#escanear` and is
  absent from the reverse map, so `#report` never parses back. Keep `routing.ts` pure (no `location`
  access) so it unit-tests in node — see `routing.test.ts`.

## Hard-won lessons (read before "optimizing")

- **Capture sharpness beats OCR speed.** The real-world blocker was the FRONT camera producing
  soft/motion-blurred frames, not latency — a blurry pill reads no better at 50 ms than 130 ms. What
  made real stickers read is the **screen fill-light** (white screen as a ring light; `.scan-frame`
  box-shadow `#fff` + `object-fit:contain`). Check capture quality before tuning the recognizer.
- **The benches can't validate use-case tuning.** The recorded video is blurry and NOT bottom-framed,
  so a non-zero `roiTopFraction`, the fill-light, single-radius detection, etc. all *look* like
  regressions on `npm run bench` while helping the real use-case. Validate those **live on the Pixel**;
  use the benches only for non-use-case-specific changes.
- **Latency is CPU-load-sensitive; headless ≠ device.** Never run two benches at once (corrupts both).
  Headless desktop Chrome is ~2.3× faster than the Pixel for wasm OCR; the glyph matcher is ~32 ms/crop
  ON DEVICE (not free). Always do back-to-back A/B on the same machine, on a quiet machine.
- **0 false positives is the cardinal rule, and the fast path CAN misread** one frame as a *different*
  real code → confirmation (`confirmations ≥ 2`) + the commit cooldown are the guard, NOT a crutch.
- **Live test over adb:** `adb screencap` is black while the camera preview is live (secure surface),
  and CDP isn't exposed — you CANNOT watch live reads. Observe via captured frames
  (`captures/pixel-*.jpg`, gitignored) + the user. Run the bench on the phone via `adb reverse` (load
  `bench.html?latency`/`?latencysharp`, it POSTs results to `captures/bench-results.md`).
- **Don't churn when blocked on a human action** (unlock phone, show a sticker, confirm an order) —
  say so once and wait, rather than re-emitting status.

## Benchmarks

`npm run bench` (accuracy: robustness + static + video, **0 FP must hold**), `npm run bench -- --latency`
(speed over real video frames), `npm run bench -- --latency-sharp` (the sharp single-sticker use-case).
`scripts/bench.mjs` drives headless Chrome. ROI/use-case changes tank these by construction — see above.

### Labeled real-Pixel-frame dataset + `bench:pixel` — CHECK HERE FIRST for real use-case accuracy

There is a **manually-verified dataset of real Pixel capture frames** under `captures/datasets/`.
It lives in an artifacts dir (NOT `src/`) — a code search won't surface it and it's easy to miss (it
was, for a whole session). **Before measuring accuracy on the real use-case, look here** — it has real
device frames *with negatives* for false-positive testing, which `npm run bench`'s synthetic/centre-
framed set and any one-off recorded video do not.

- **Canonical set:** `captures/datasets/combined-live-20260616-20260617/` — 374 frames (216 confirmed
  stickers + 157 not-sticker negatives), `train`/`val`/`test` split.
- **Ground truth = `ground_truth_verification.csv`**, NOT the manifest's `ground_truth_code` (zeroed):
  `status=confirmed` + `verified_code` ⇒ positive; `status=not_sticker` ⇒ negative. `dataset_manifest.csv`
  carries paths + splits.
- **Frame layout:** each `raw/<session>/debug/frame-N/` holds `frame.png` (full frame), `frame.pgm.gz`
  (grayscale), `crop0..N.png` (detected crops).
- **Grow it:** `?record` mode (separate from `?debug`) auto-saves every frame the scanner reads to
  `captures/` as sequential `rec-NNNN.jpg` — scan a batch on the Pixel, then label + fold into a dataset.

**`npm run bench:pixel`** — the REAL-FRAME accuracy benchmark + the source of truth for use-case
tuning (recall/FP/latency) that the synthetic bench above can't validate. It runs the EXACT live
pipeline (detection → crops → the recognizer two-phase, or the codeNet ensemble via `--engine=ensemble`
→ matching + the multi-frame confirmer) over the dataset above. Reports, per split (train/val/test) and
overall: **recall, positive precision, per-frame FP rate, confirmed/held-sticker FP** (the shipped
guard — must stay ~0), **latency** (det+ocr median/p95), and a **per-miss failure-stage table**
(det:0boxes / crop:0ink / ocr:misread / ocr:nomatch / ocr:blank). Output →
`captures/bench-pixel-results.md`. Tune on TRAIN, validate on VAL, report final on TEST only. Sweep
ROI/gates/engine without rebuilding via forwarded params, e.g.
`npm run bench:pixel -- --split=test --engine=ensemble --roiRect=0.18,0.32,0.82,0.58 --maxBoxes=2`.
`src/dev/benchPixel.ts` + `bench-pixel.html` are dev-only (build input pinned to `index.html`); the
dataset dir is overridable via `PIXEL_DATASET=`. Running change→effect log: `docs/web-ocr-accuracy.md`.

NOTE on ROI: `CONFIG.detect.roiRect` (normalized `{left,top,right,bottom}`) restricts detection to a
rectangle (a strip in the upper-middle, where a front-camera capture actually holds the sticker) and
takes precedence over `roiTopFraction`. It is now the **default** — on this dataset the old band
`roiTopFraction=0.67` (bottom third) read **0% recall** (it points below the pill). A rect ROI must be
re-validated live (the shipping reticle position has to match it).

## Data flow & state

`src/types.ts` is the central contract — every module implements/consumes interfaces there. State
lives in small reactive stores with `subscribe()` (`src/state/collection.ts`, `src/state/settings.ts`)
wired into Preact via `src/ui/hooks.ts`. A **scan session** (`src/domain/session.ts`) is a
read-only accumulator: scanning records nothing into the collection. Only the **report screen**
commits the user's selected keepers into `collection` (persisted to IndexedDB). The 980-sticker
album is built in `src/data/checklist.ts`; UI strings are in `src/i18n/pt.ts`.

**Section routing lives in the URL hash** (`src/ui/routing.ts`). The active `screen` (the union in
`src/ui/Nav.tsx`) is mirrored to a pt-BR hash slug (`scan↔#escanear`, `collection↔#colecao`,
`trade↔#trocar`, `settings↔#ajustes`, `repeats↔#repetidas`) so a refresh or a shared link restores
the section. `app.tsx` seeds the initial `screen` from `location.hash` (`screenFromHash`) and one
`useEffect` writes the URL on every screen change via `sectionUrl(...)` — see the invariant below
for the rules that keep this correct.

## Dev tooling (dev-only, excluded from the build)

- **`ocr-test.html` + `src/dev/ocrTest.ts`** run the real `locate → crop → recognizeMany → match`
  pipeline on saved frames and POST results to `captures/ocr-results.txt` (read the file, don't
  scrape the DOM). The `vite.config.ts` plugin (apply: `'serve'`) serves these test frames from
  **`dev-fixtures/`** at `/samples/*` and accepts `/__capture` + `/__log`. `?debug` on the app adds a
  raw-read readout and tap-to-capture. `build.rollupOptions.input` is pinned to `index.html`, so none
  of this ships.
- **node-canvas is unusable** for testing the pipeline (it mis-renders after a canvas resize) — use
  the browser harness as the source of truth.

## Gotchas

- The default branch is **`main`**, which matches the push trigger in `.github/workflows/deploy.yml`.
  The build there uses `GH_PAGES=1`, which sets the `/busca-figurinha/` base path in `vite.config.ts`.
- PNG app icons are generated from `public/icons/icon.svg` via `node scripts/gen-icons.mjs` (needs
  `npm i -D sharp`); the SVG is the source of truth.
