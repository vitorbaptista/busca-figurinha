# Changelog

Notable changes to the sticker scanner. Newest first. No formal releases yet (deploys on push to
`main`), so entries are grouped by date. Keep this updated when you ship something notable.

## 2026-06-15 — GitHub Pages deployment

### Added
- **GitHub Pages deploy** is live at http://vitorbaptista.com/busca-figurinha/ — enabled the Pages
  site (GitHub Actions source); the existing `deploy.yml` workflow auto-deploys on push to `main`.

### Fixed
- **Vite base path** corrected to `/busca-figurinha/` (was `/figurinhas-app/`, which didn't match the
  repo name and broke asset loading under the Pages subpath).

### Changed
- **CI runners**: `actions/checkout` + `actions/setup-node` bumped to v5, Node 24 LTS; opted the
  Pages actions into the Node 24 runtime to clear the Node 20 deprecation warnings.

## 2026-06-15 — Real-world speed + correctness pass

The scanner went from a slow, often-unreadable prototype to ~85 ms/pass on a Pixel, reading real
stickers reliably, with 0 false positives.

### Added
- **Hybrid two-phase recognizer** (`hybridEngine.ts`, `glyphEngine.ts` + glyph atlas, `recognize.ts`):
  a pure-JS glyph matcher reads all crops first; `tesseract.js` runs only as fallback. A sharp frame
  pays zero tesseract → **~85 ms/pass on-device** (was ~465 ms).
- **Screen fill-light** — white background + reticle so the front-facing screen lights the sticker.
  This is what actually made real (blurry) stickers readable; the gating issue was capture quality.
- **Bottom-third detection ROI** (`CONFIG.detect.roiTopFraction`) on the real camera frame, with a
  full-frame preview (`object-fit:contain`) so the reticle matches what's detected.
- **Latency benchmark**: `npm run bench -- --latency` and `--latency-sharp`.
- **Capture-loop heartbeat** (debug readout) so the loop's state is visible.
- **CHANGELOG.md** + expanded `CLAUDE.md` ("Hard-won lessons").

### Changed
- **Collection screen**: every country always expanded (no accordion), ordered by **World Cup group
  A→L** (album order, not alphabetical) with "Grupo X" headers.
- **Lazy crop prep** + **box[0]-first** early-stop in `recognize.ts` (skip the flip crop / lower-ranked
  crops when the pill resolves).
- Tighter capture cadence (`stabilityMs` 250→130, `sampleIntervalMs` 120→60).

### Fixed
- **False positives**: the fast glyph path occasionally misread one frame as a different real code.
  Restored 2-frame confirmation (`match.confirmations`) + added a commit cooldown
  (`capture.minRecaptureMs`) so only one code commits per sticker hold.
