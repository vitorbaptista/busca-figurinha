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
  -vf fps=1 -q:v 3 data/raw/stickers/frames/f%03d.jpg

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

## Baseline (first run — the number to beat)

| metric | result |
|---|---|
| **Static recall** | **4 / 8 (50%)** |
| **Static false positives** | **0** |
| **Video session recall** | **0 / 6** |
| Video false confirmations | 0 |

Per case:

- `CIV12.jpg` (close-up) → **CIV12** ✓
- `EGY4.jpg` (close-up) → **EGY4** ✓
- `RSA17_EGY5_CIV12_RSA19_EGY4_AUT4.jpg` (sharp, 6 stickers, mixed rotation) → **RSA17, RSA19** only
  (2/6). Missed CIV12 (reads `CV2` — lost the `1` too), EGY4, EGY5, AUT4.
- Video (720×1280, front camera, 26 frames) → **0/6**; pills only ever read as fragments
  (`L P | 4 1`, `V | Y LY`, …) even on frames where a human reads the code easily.

## Known failure modes (what to attack)

1. **Small / distant / front-camera pills** — the whole video flow yields only fragments. This is the
   biggest real-world gap (the front camera is the default).
2. **Rotated / perspective-tilted pills** — the 6-sticker photo has 90°/180°/skewed backs; 4 of 6 miss.
3. **Thin strokes under blur** — `CIV 12` → `CV2` (drops `I` *and* `1`); a 3-char token is too short to
   correct safely. The thin-letter recovery in matching only restores letters, not dropped digits.
4. **Stylized glyphs** — the font's `Y` reads as `V` (`EGY 4` prints as `EGV 4`).
