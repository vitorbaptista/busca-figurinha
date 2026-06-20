# Dataset capture (`?capture`)

A gated, in-app tool for growing the real-frame OCR dataset. Not part of the normal app — opened
with the `?capture` query param (same obscurity as `?debug`/`?record`; regular users never see it),
lazy-loaded so it never bloats the main bundle.

## Why
The labeled real-frame dataset (`captures/datasets/…`) is what `bench:pixel` and codeNet training
run on. Its honest held-out recall is limited mainly by **how few distinct stickers** it contains.
This tool lets the owner label frames *at the source* (you're holding the sticker, so you know the
truth) and blast through a big stack — breadth is what moves accuracy.

## Capture (on the Pixel)
1. Open `…/?capture`.
2. Type the sticker's **code** (autocompletes against the 992-code checklist).
3. Hold the sticker in the **gold window** (it's aligned to the real detection ROI, so the pill
   lands where the recognizer reads it), tap **Gravar**, and wave it ~3–5 s — vary angle, distance,
   tilt, lighting. Tap **Parar**.
4. Next code → repeat. Aim for **breadth**: ~10–15 frames each across **many distinct stickers**.
5. Flip the **negativo** toggle and grab some not-a-sticker frames (hands, table, packaging) for
   false-positive testing.
6. Tap **Exportar .bin** (export periodically so the bundle never gets huge). It downloads to
   `/sdcard/Download/figurinhas-capture-<ts>.bin`. Each export contains the *whole* on-device store,
   but that's fine — `fold-capture` dedupes by (code, timestamp), so folding overlapping bundles
   never double-counts or leaks. **Apagar tudo** (two taps) just frees on-device space.

Frames persist in IndexedDB, so a refresh mid-session is safe.

## Pull + fold (on the dev machine)
```bash
adb pull /sdcard/Download/figurinhas-capture-XXXX.bin captures/
node scripts/fold-capture.mjs --out=captures/datasets/<name> captures/figurinhas-capture-*.bin
PIXEL_DATASET=captures/datasets/<name> npm run bench:pixel -- --split=all --engine=ensemble
```
`fold-capture.mjs` writes the canonical dataset layout (`raw/<source>/debug/frame-N/frame.png`,
`ground_truth_verification.csv`, `dataset_manifest.csv`). It splits by contiguous frame **chunks**
within each code (default 3 frames/chunk): chunk 0 → `train` (so every code is trained), extra
chunks round-robin globally to ~70/15/15. Near-duplicate burst frames sit in one chunk → one split,
so there's no leakage — and val/test populate even from the natural one-Gravar-pass-per-code flow
(just capture ≥6 frames/code so a code reaches val/test). It warns if any split ends up empty. Then
retrain (`scripts/ml/train.cjs`) and re-bench.

## Notes
- Frames are full-resolution JPEGs (named `frame.png`; the browser bench decodes by content, so no
  Node image dependency). The bundle is a dependency-free container (manifest + concatenated JPEGs).
- The capture window uses `object-fit: contain` + the shared `useReticleAlignment` hook, so it
  matches `CONFIG.detect.roiRect`. If you change the ROI, the window follows automatically.
