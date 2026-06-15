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

The robustness set grew from 11 to **50 readable variants** (full rotation sweep ±15/30/45/60/75,
skew, combined). Numbers below are on the set in use at each step.

| metric | first run (11) | deskew (11) | small-pill (11) | **moment-detect (50)** |
|---|---|---|---|---|
| **Robustness** (readable variants) | 17/22 (77%) | 22/22 (100%) | 22/22 (100%) | **46/50 (92%)** |
| Static recall | 4/8 | 4/8 | 5/8 | **6/8** |
| Video session recall | 0/6 | 0/6 | 1/6 | **1/6** |
| **False positives** | 0 | 0 | 0 | **0** ✅ |

Detection is now **rotation-invariant**: `scoreBox` gates on the component's pixel-moment geometry
(rotation-invariant AR/fill) instead of the axis-aligned bounding box — a pill at any in-plane angle
is found — and the crop is de-rotated ONCE by its moment angle (**2 crops/box**, fast). Deskew →
small-pill (adaptive crop height + dual-radius) → moment-detect, all at **0 false positives**.

## Remaining gaps

1. **CIV12 under combined stress** — the 4 robustness misses (rot-30, rot-75, skew+, blur+rot+25)
   are all CIV12, whose thin `I`/`1` degrade below readability when de-rotation resample stacks with
   blur/skew. These are **safe misses** (read `CV2`/`G 12`, below the matcher's correction threshold
   → never a wrong code) and are beyond realistic handheld use. Closing them would need stroke-aware
   prep or a font-specific recogniser — weigh against complexity (see `ocr-approach-decision`).
2. **Static 2 misses & video 1/6** — the multi-sticker photo's hardest rotated pills and the 720p
   front-camera video are **capture-limited**: the pill competes with the PANINI bar / legal text,
   and the video is soft. The real lever is sharper capture — the front-camera focus-lock (verify
   on the Pixel via `/focus-probe.html`) and the higher-res STILL frames the live app grabs.
3. **Stylized glyphs** — the font's `Y` reads as `V` (`EGY 4` prints as `EGV 4`).

Invariant for all of the above: **false positives must stay 0** — never invent a code to lift recall.
