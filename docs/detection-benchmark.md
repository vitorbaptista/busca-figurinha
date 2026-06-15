# Sticker detection accuracy benchmark

A reproducible yardstick for how well the **production** pipeline (`findCodeBoxes →
codeCropCandidates → recognizeMany → bestMatchFromText`, plus the multi-frame confirmer
for video) recovers sticker codes — so any change to detection/OCR/matching can be measured,
not guessed.

## Ground truth

The labeled dataset lives in `data/raw/stickers/` (committed). **The filename is the label:**
`RSA17_EGY5_CIV12_RSA19_EGY4_AUT4.jpg` expects those six codes; video frames inherit the labels
of the `.mp4` they were extracted from. Drop a new labeled image in that folder and the benchmark
picks it up automatically — no code change.

## How to run

```bash
# 1. Extract video frames once (derived from the committed .mp4; gitignored).
ffmpeg -y -i data/raw/stickers/EGY4_AUT4_RSA19_RSA17_CIV12_EGY5.mp4 \
  -vf fps=3 -q:v 3 data/raw/stickers/frames/f%03d.jpg

# 2. Start the dev server and open the benchmark page.
npm run dev          # serves the dataset at /dataset/* and the page at /bench.html
#   → open http://localhost:5173/bench.html   (drive it with the chrome MCP if headless)

# 3. Read the report.
cat captures/bench-results.md
```

The page runs the whole pipeline in the browser (canvas + tesseract.js — node can't, see CLAUDE.md)
and POSTs a Markdown report to `captures/bench-results.md` (gitignored). It's dev-only and excluded
from the production build. **Timing is unreliable** in a long-lived browser (wasm state accumulates),
but the **accuracy numbers are deterministic** — re-navigate for a clean run.

## Metrics

- **Static recall** = of the codes printed in each photo, how many resolved (single frame each).
  The deterministic headline.
- **False positives** = codes reported that aren't present. **Must stay 0** — a wrong code is worse
  than a miss because it costs a real trade. Never relax the conservative matching to inflate recall.
- **Video session recall** = simulating the real front-camera flow, how many of the six the
  multi-frame confirmer commits. The report's `<details>` lists per-frame reads for diagnosis.

## Progress

| metric | first run | after deskew |
|---|---|---|
| **Robustness recall** (readable variants) | 17/22 (77%) | **22/22 (100%)** ✅ |
| Static recall | 4/8 (50%) | 4/8 (50%) |
| Video session recall | 0/6 | 0/6 |
| **False positives** | 0 | **0** ✅ |

The deskew commit (estimate each pill's lean from its pixel moments, de-rotate the crop before
OCR) took the readable-variant robustness to 100% at zero false positives — off-axis tilt,
blur, noise, downscale, darkness and JPEG all pass now. Video frames at 3fps.

## Remaining gaps (what to attack)

1. **Small / soft pills** — the sharp 6-sticker photo still reads only 2/6 (RSA17, RSA19): the
   four small/tilted pills read as fragments, and CIV reads `CV2` (loses both `I` and `1`). The
   720×1280 front-camera **video is 0/6** — nothing reads on any frame, so it's an image-detail
   wall, not a sampling one. Likely needs sharper/larger crops for small pills (the crop is
   upscaled to a fixed height; a tiny pill loses detail) and stroke-aware prep.
2. **Thin strokes under blur/scale** — `CIV 12` → `CV2`; a 3-char token is too short to correct
   safely. The thin-letter recovery only restores dropped *letters*, not digits.
3. **Stylized glyphs** — the font's `Y` reads as `V` (`EGY 4` prints as `EGV 4`).

Invariant for all of the above: **false positives must stay 0** — never invent a code to lift recall.
