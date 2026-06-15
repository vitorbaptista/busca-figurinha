# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A Portuguese (pt-BR) PWA that scans the **backs** of Panini World Cup 2026 album stickers
through the phone camera and instantly tells the user **GUARDAR** (keep — they need it) or
**REPETIDA** (discard — already owned). It runs 100% on-device: Preact + TypeScript + Vite,
`tesseract.js` for OCR, `idb-keyval` for storage. No backend, no login, offline after first load.
Target users include kids/teens on low-end phones, so performance and simplicity are priorities.

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
`npm run build`.** Match the surrounding comment density and naming when editing.

## Architecture: the scan pipeline is the whole app

Everything important is the live camera → "KEEP/DISCARD" loop. The other screens (collection,
report, settings) are conventional. Reading these files in order explains the system:

1. **`src/ocr/frameSource.ts`** — wraps `getUserMedia` + a hidden `<video>`; `drawTo(canvas)` gives
   the raw (un-mirrored) frame. Front camera (`facingMode: 'user'`) is the default.
2. **`src/ocr/autoCapture.ts`** — hands-free trigger. Samples a tiny 160px frame-diff; when a
   sticker lands and holds **still**, it fires a **burst** of frames (`onCapture` returns `true` to
   stop the burst), then `locks` until motion re-arms. This is why scanning needs no taps.
3. **`src/ui/screens/ScanScreen.tsx`** — orchestrates it all. `recognizeCanvas(canvas, {confirm, silent})`
   is the core: `findCodeBoxes → codeCropCandidates → ocr.recognizeMany → bestMatchFromText`, feeds
   results to the confirmer, and `handleMatches` drives flash/beep/haptic/session. OCR-init and the
   camera live in **separate effects** so flipping cameras restarts only the stream, not the engine.
4. **`src/ocr/locate.ts`** — finds the dark code pill(s) by SHAPE, not color: downscale → local
   adaptive threshold (integral-image box blur) → connected components → geometry gate (`scoreBox`).
   `codeCropCandidates` makes an upright + a 180°-rotated crop per box; `prepForOcr` upscales,
   binarizes light-text→black, flood-clears the card margin, and applies the **sparse-ink gate**.
5. **`src/ocr/engine.ts`** — a small `tesseract.js` worker pool (`createScheduler`, capped at 2).
   `recognizeMany` OCRs each crop **individually** — crops are deliberately NOT stacked.
6. **`src/domain/matching.ts`** — turns noisy OCR text into a checklist entry.
7. **`src/domain/confirm.ts`** — multi-frame agreement before a result is committed.

`src/config.ts` holds every tunable (capture thresholds, burst size, OCR width, match distance,
confirmation count) in one place — adjust there, not inline.

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

## Data flow & state

`src/types.ts` is the central contract — every module implements/consumes interfaces there. State
lives in small reactive stores with `subscribe()` (`src/state/collection.ts`, `src/state/settings.ts`)
wired into Preact via `src/ui/hooks.ts`. A **scan session** (`src/domain/session.ts`) is a
read-only accumulator: scanning records nothing into the collection. Only the **report screen**
commits the user's selected keepers into `collection` (persisted to IndexedDB). The 980-sticker
album is built in `src/data/checklist.ts`; UI strings are in `src/i18n/pt.ts`.

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
  The build there uses `GH_PAGES=1`, which sets the `/figurinhas-app/` base path in `vite.config.ts`.
- PNG app icons are generated from `public/icons/icon.svg` via `node scripts/gen-icons.mjs` (needs
  `npm i -D sharp`); the SVG is the source of truth.
