# Native Android Rewrite — Design Spec

- **Date:** 2026-06-16
- **Status:** Draft for review
- **App:** *Troca Figurinhas* — Panini World Cup 2026 sticker-back scanner
- **Supersedes (platform only):** `2026-06-14-figurinhas-scanner-design.md` (the PWA). The product,
  the OCR strategy, the 0-FP rule and the album data all carry over unchanged; only the runtime
  platform changes from PWA → native Android.

## 1. Why native, honestly

The PWA already reads ~85 ms/pass on a Pixel, and the project's own hard-won lessons say the
real-world blocker was **capture sharpness, not OCR latency** — a blurry pill reads no better at
50 ms than 130 ms, and what actually made real stickers readable was the screen fill-light, not a
faster recognizer. So this rewrite is justified *not* by "OCR is slow" but by the three things a
native app unlocks that a browser cannot:

1. **Real camera control.** CameraX + Camera2 interop give a near-focus lock, exposure/AF-region
   control, and direct frame access — directly attacking the documented true blocker (soft frames).
   `getUserMedia` exposes only a best-effort, frequently-ignored `focusDistance` hint.
2. **Zero per-frame RGBA readback.** CameraX delivers a `YUV_420_888` frame whose **Y (luma) plane
   *is* the grayscale** that `locate`/`prepForOcr` already compute. The PWA pays
   `drawImage → getImageData → grayscale` every frame; native skips all of it.
3. **Native compute, no wasm/JS tax.** `locate.ts` is pure typed-array math (integral-image box
   blur, connected components, pixel moments, Otsu, NMS); the glyph matcher is an L2-normalized
   dot-product NN. Both run as Kotlin primitive-array kernels, with an NDK/NEON seam for the hot
   loops if profiling demands it.

**Performance is paramount** is therefore interpreted as: maximize capture sharpness and minimize
per-frame compute/allocation — *and* preserve the cardinal rule of **0 false positives**.

## 2. Locked decisions

| # | Decision | Choice |
|---|---|---|
| D1 | v1 scope | **Full feature parity** (scan + collection + report + settings + onboarding + pt-BR + persistence) |
| D2 | Compute | **Kotlin-first**; add NDK/C++ (NEON) for a hot kernel only if on-device profiling proves it the bottleneck |
| D3 | OCR fallback engine | **Glyph-atlas matcher** (fast path) **+ Tesseract4Android fine-tuned on the font** (slow path), behind the existing `recognizeFast`/`recognizeSlow` seam |
| D4 | Repo | New **`android/`** Gradle project in this repo; the PWA stays as the live fallback + reference |
| D5 | Fallback sequencing | **Seam now, fine-tune as a tracked task.** v1 ships parity with the glyph matcher + the fallback seam wired and the accept floor high (miss > guess). The fine-tuned `.traineddata` lands afterward, trained on real soft-crop captures from the device. We do **not** ship an *untrained* Tesseract (it misreads this font and can emit confident garbage → FP risk). |

## 3. Stack & project setup

- **Language/UI:** Kotlin + **Jetpack Compose** (Material 3), single-activity.
- **Camera:** **CameraX** (`Preview` + `ImageAnalysis` with `STRATEGY_KEEP_ONLY_LATEST`) plus
  **`Camera2Interop`** for `CONTROL_AF_MODE` / `LENS_FOCUS_DISTANCE` (near-focus lock), AE/AF
  metering regions on the reticle, and steady exposure. The camera sits behind a `FrameSource`
  interface so a device with unreliable CameraX focus can drop to raw **Camera2**.
- **Concurrency:** Kotlin coroutines. The recognize chain is serialized (one read at a time, like
  the PWA's `recognizeChainRef`) on a dedicated dispatcher; the per-frame diff runs on the analysis
  executor.
- **Compute:** Kotlin on primitive `IntArray`/`ByteArray`/`FloatArray`, reused across frames (no
  per-frame allocation in the hot loop). A **CMake/NDK 27** module is scaffolded but empty in v1;
  kernels move to C++/NEON only behind a profiled win.
- **Storage:** Jetpack **DataStore** (settings + owned-codes set + in-progress session) — small,
  reactive, no SQL needed for ≤980 short strings. (Room is an option if the owned set grows
  relational needs; not required for v1.)
- **Build:** Gradle wrapper, **AGP with JDK 21** (the shimmed JDK 26 is too new for AGP — pin 21 via
  mise/`org.gradle.java.home`). `minSdk 24`, `targetSdk 35`, `compileSdk 35`. Ship **arm64-v8a**
  primary (add `armeabi-v7a` only if a target device needs it).
- **Dev/test hardware:** develop against the installed **android-34 emulator**; validate
  capture-sharpness and use-case tuning **live on the Pixel over adb** (and ideally one low-end
  phone). Benches are advisory only (see §9).

## 4. Architecture: the scan pipeline is the whole app

Reading order mirrors the PWA's `CLAUDE.md`. The pipeline, per held sticker:

```
CameraX ImageAnalysis (YUV_420_888)
  └─ Y plane → small downscaled luma  ──► AutoCapture frame-diff (motion → hold → burst → lock)
       on hold, per burst frame:
       Y plane (full res, ROI bottom band)
         └─ Locate.findCodeBoxes  (integral-image adaptive threshold → CC → moment geometry gate → NMS)
              └─ codeCropSource    (de-rotate by moment angle; upright + 180° flip; lazy prep)
                   └─ prepForOcr   (upscale, unsharp, Otsu, border-flood, despeckle, sparse-ink gate)
                        └─ Recognizer (two-phase, best-box-first, stop-on-first-code):
                             phase 1: glyph matcher on every crop (accept ≥ hybridFastConf)
                             phase 2: Tesseract4Android on unsure crops only (if nothing resolved)
                                  └─ matchCode (Levenshtein ≤1 + thin-letter recovery; never guesses)
                                       └─ Confirmer (≥2 agreeing frames)
                                            └─ commitGate (cooldown; first-commit-only)
                                                 └─ UI: flash GUARDAR/REPETIDA + beep + haptic + session
```

### Module map (web → native)

| Web (TS) | Native (Kotlin) | Port character |
|---|---|---|
| `ocr/frameSource.ts` | `camera/CameraFrameSource.kt` (+ `FrameSource` iface) | rewrite (CameraX/Camera2); Y-plane direct, near-focus lock |
| `ocr/autoCapture.ts` | `scan/AutoCapture.kt` | 1:1 state machine; frame-diff on downscaled Y |
| `ocr/rotate.ts` | `ocr/Rotate.kt` | bilinear rotate/resample on arrays (or Android `Matrix`) |
| `ocr/locate.ts` | `ocr/Locate.kt` (+ `native/locate.cpp` seam) | mechanical port of array math |
| `ocr/glyphFeatures.ts` | `ocr/GlyphFeatures.kt` | mechanical (segmentation + feature vector) |
| `ocr/glyphEngine.ts` | `ocr/GlyphEngine.kt` | mechanical; **all FP gates preserved verbatim** |
| `ocr/glyphAtlas*.ts` | `ocr/Atlas.kt` + **pre-baked int8 asset** | build-time export of `buildAtlas()` (see §6) |
| `ocr/engine.ts` (tesseract.js) | `ocr/TesseractEngine.kt` (Tesseract4Android) | rewrite over a different binding |
| `ocr/hybridEngine.ts` | `ocr/Recognizer.kt` | 1:1 routing (`recognizeFast`/`recognizeSlow`/`fastConf`) |
| `ocr/recognize.ts` | `ocr/RecognizePipeline.kt` | 1:1 (rounds, two-phase, stop-on-first-code) |
| `domain/matching.ts` | `domain/Matching.kt` | **pure 1:1; tests port directly** |
| `domain/code.ts` | `domain/Code.kt` | pure 1:1 |
| `domain/confirm.ts` | `domain/Confirm.kt` | pure 1:1 |
| `domain/commitGate.ts` | `domain/CommitGate.kt` | pure 1:1 |
| `domain/session.ts` | `domain/Session.kt` | pure 1:1 (read-only accumulator) |
| `data/checklist.ts` | `data/Checklist.kt` (or `assets/checklist.json`) | data port (980 entries, WC groups A–L) |
| `state/collection.ts` | `data/CollectionRepository.kt` (DataStore, `StateFlow`) | rewrite over DataStore |
| `state/settings.ts` | `data/SettingsRepository.kt` (DataStore, `StateFlow`) | rewrite over DataStore |
| `i18n/pt.ts` | `res/values/strings.xml` (or `i18n/Pt.kt`) | data port; **all user text pt-BR** |
| `ui/screens/ScanScreen.tsx` | `ui/scan/ScanScreen.kt` (Compose) | rewrite (same orchestration) |
| `ui/screens/ReportScreen.tsx` | `ui/report/ReportScreen.kt` | rewrite |
| `ui/screens/CollectionScreen.tsx` | `ui/collection/CollectionScreen.kt` | rewrite |
| `ui/screens/SettingsScreen.tsx` | `ui/settings/SettingsScreen.kt` | rewrite |
| `ui/Onboarding.tsx`, `Nav.tsx`, components | Compose equivalents | rewrite |

## 5. The 0-FP contract (must survive the port intact)

The cardinal rule — **0 false positives** — is enforced by four independent layers, none of which is
optional. A confidently-wrong code costs a real trade; a miss is acceptable.

1. **Recognizer emits garbage, not plausible wrong codes, on doubt.** The glyph engine forces
   confidence 0 + an unmatchable sentinel on ambiguous digits (`DIGIT_MARGIN`, `DIGIT_STRONG`) and
   low-cosine noise glyphs (`MIN_GLYPH_COS`); whole-crop reject on any failing glyph.
2. **`matchCode` never guesses.** Exact lookup, else a *single unambiguous* nearest code
   (Levenshtein ≤1, or one dropped/added **thin** letter I/J/L/T); ties → `unknown`; sub-4-char
   tokens match only exactly.
3. **Multi-frame confirmation** (`CONFIG.match.confirmations ≥ 2`) — a transient one-frame misread
   never repeats, so it never commits. (Guards *transient* noise, not a *systematic* misread.)
4. **Commit cooldown** (`commitGate`) — a fresh hold committing sooner than `minRecaptureMs` is the
   same sticker re-triggering; gated. Co-present stickers in the *same* burst are exempt.

Because confirmation only guards transient noise, the v1 strategy keeps the **glyph accept floor
high** (miss > guess) so a *systematically* soft pill misses rather than committing a repeated
confident misread — until the fine-tuned Tesseract second opinion (D5) is in place.

## 6. The glyph atlas: pre-bake, don't render

The PWA renders the atlas at init via canvas `fillText` over a font stack, then featurizes. Native
keeps the *exact* feature space but **pre-bakes** the atlas to remove font-availability variance and
startup cost:

- A build-time export script runs the existing `buildAtlas()` once (Node/headless, reusing the TS),
  emitting every template's `Float32` feature vector **quantized to int8** (the pattern
  `glyphAtlasReal.ts` already uses), plus parallel label/isDigit arrays.
- Ship as a small binary **asset** (`assets/atlas.i8`) — order tens of KB. `Atlas.kt` loads + L2-
  re-normalizes into one flat `FloatArray` for the cache-friendly classify loop.
- `FEAT_LEN = GRID*GRID + GRID + GRID + ZONE*ZONE + 1 = 256 + 16 + 16 + 9 + 1 = 298`.

This makes the native atlas byte-identical to the PWA's, so glyph behavior (and the 0-FP gates that
depend on its scores) is preserved.

## 7. OCR fallback (Tesseract4Android), per the research

Full research report: `tasks/w7ib2iwzf.output` (7 agents). Ranked for *our* case — rare fallback,
short closed-set codes, thin custom font, 0-FP, low-end phones:

1. **Tesseract4Android, fine-tuned** ✅ — only mature drop-in Android OCR that can be *trained* on
   the thin I/J/L/T strokes **and** constrained by a custom unicharset (A–Z 0–9 space); native is
   ~3-5× faster than the wasm `tesseract.js` it replaces; **no NDK needed**; Bitmap-in API maps 1:1
   onto `recognizeSlow`.
2. PaddleOCR PP-OCRv4 rec-only (NCNN/TFLite), fine-tuned — smaller, but mandatory NDK/JNI + a
   self-owned training/CTC-decode pipeline.
3. Custom tiny CRNN (ONNX/TFLite) — most trainable, most work.
4. Glyph-only (no fallback) — simplest, but the project's own prior data shows template matching
   collapses on blur (4/6 → 1/6 video recall).
5. ML Kit Text Recognition v2 ❌ — trivial to integrate but **cannot be trained or whitelisted** to
   the thin font, so it fails in the exact regime the fallback exists for.
6. MediaPipe ❌ — disqualified (no OCR/text-recognition task exists).

**Latency cross-check (adversarial):** every favorable neural figure online is server/flagship
(PaddleOCR 7.6 ms/line = Xeon; "CRNN 10-18 ms" = flagship NPU+INT8). Normalized to a tiny crop on a
*low-end ARM CPU*, the neural speed edge shrinks to tens-to-low-hundreds of ms — so per-crop latency
stops differentiating a *rare* fallback, and integration effort + trainability + Kotlin bindings
(Tesseract's wins) decide it. The only directly comparable on-device number is the project's own
glyph matcher at ~32 ms/crop on a Pixel.

**Decision (D3 + D5):** glyph matcher default; Tesseract4Android fine-tuned `.traineddata` as the
gated fallback behind the unchanged seam; fine-tuning sequenced as a tracked task using real
device-captured soft crops. Training pipeline = `tesstrain` over synthetic renders of the font (with
blur/skew augmentation) **plus** real captured crops; gate with a mean/per-char confidence floor +
`matchCode` snap-to-checklist + the confirmer/cooldown.

## 8. Camera & sharpness (where the real win is)

- **Near-focus lock:** `Camera2Interop.Extender` sets `CONTROL_AF_MODE_OFF` +
  `LENS_FOCUS_DISTANCE` to the lens near limit (device-dependent; verify on the Pixel — some invert
  the range). Fallback to AF if manual focus is unsupported/softer on a device.
- **Screen fill-light:** a white Compose surface around the reticle acts as a ring light (the PWA's
  `.scan-frame` box-shadow `#fff` trick) — the single change that made real pills readable.
- **Bottom-band ROI:** `CONFIG.detect.roiTopFraction` on the *actual* frame; preview is full-frame
  so the reticle matches what's detected.
- **Risk acknowledged:** the research warns CameraX manual focus is often softer than autofocus for
  close-up small subjects on cheap phones, and manual exposure needs Camera2. The `FrameSource`
  seam + a per-device focus strategy (manual → AF-macro → Camera2) absorbs this. **Validated live.**

## 9. Testing & benchmarks

- **Unit (JVM, JUnit/Kotlin):** port `matching`, `code`, `confirm`, `commitGate`, `session` tests
  1:1 (they're pure) — these lock the 0-FP behavior. Port `autoCapture` frame-diff tests.
- **Golden-image (instrumented or JVM with a decoded bitmap):** `Locate` + glyph on saved real
  frames (`CIV12`, `EGY4`, the multi-up video frames) — assert located boxes + resolved codes;
  **0 FP must hold**.
- **On-device bench:** an APK/instrumented harness analog of `npm run bench --latency` /
  `--latency-sharp`: feed saved frames, measure detection vs recognition ms (median + p95), run on
  the Pixel and a low-end phone. Never two benches at once; never headless-only conclusions.
- **Fallback A/B (when training lands):** corpus = ~150-300 real crops the glyph fast path
  *rejected* (the only valid fallback test set) + ~30-50 garbled "trap" crops; acceptance bar =
  **hard 0 FP** on the full set before recall is even read; then maximize recall at acceptable p95.
- **Benches mislead by construction** for ROI/fill-light/focus changes (recorded video is blurry +
  not bottom-framed; headless ≈2.3× faster than the Pixel) — validate those **live**.

## 10. Data & state details

- **Checklist:** 48 teams × 20 + 20 "FWC" specials = **980**; codes = FIFA 3-letter + number; WC
  groups A–L for album-order display; team names pt-BR. Ported from `RAW_TEAMS` + group assignment.
- **Collection:** owned-code `Set<String>` in DataStore; reactive via `StateFlow`.
- **Settings:** `{ language, sound, onboarded, camera }` in DataStore.
- **Session:** read-only accumulator; auto-saved to DataStore so it survives process death; only the
  **Report** screen commits selected keepers into the collection.
- **Backup:** JSON export/import (`{ app, version, exportedAt, owned, settings }`), reset gated.

## 11. UI parity (Compose), kid-friendly

Five surfaces at parity: **Escanear** (full-bleed preview, reticle + fill-light, full-screen
green/red flash with code + team, live counters, recent strip, manual-entry fallback, camera flip,
debug heartbeat behind a flag), **Relatório** (totals, checkable keepers, collapsed repeats, "add
marked"), **Coleção** (teams grouped A–L, tap-to-toggle owned, progress, search), **Ajustes**
(export/import, sound toggle default off, re-open onboarding, gated reset), **Onboarding** (short
visual walkthrough, camera-permission in context). Constraints: ≥48dp targets, ≥320dp width, high
contrast (WCAG AA), big icons+words (not color alone), haptics, **all text pt-BR**.

## 12. Risks & mitigations

| Risk | Mitigation |
|---|---|
| CameraX manual focus soft on cheap phones | `FrameSource` seam → AF-macro → raw Camera2; validate live per device |
| Untrained Tesseract emits confident garbage (FP) | Don't ship it untrained; high accept floor (miss>guess) until fine-tuned `.traineddata` lands |
| Tesseract fine-tune is real upfront ML work | Tracked task (D5); synthetic + real crops; doesn't block feature parity |
| Benches mislead on use-case changes | Validate ROI/fill-light/focus **live on the Pixel**, not the bench |
| 0-FP regressions during the port | Port the pure-logic tests first; golden-image tests; FP trap set |
| APK size (Tesseract ~7-12 MB + model) | arm64-v8a only; `tessdata_fast`; consider on-demand model |
| JDK 26 too new for AGP | Pin JDK 21 (`org.gradle.java.home` / mise) |
| Glyph behavior drift vs PWA | Pre-baked atlas byte-identical to `buildAtlas()` output |

## 13. Internal build order (within full-parity v1)

Even though v1 ships full parity, the safe construction order is:

1. **Project scaffold** — `android/` Gradle, Compose, CameraX, JDK 21, CI lane; empty NDK seam.
2. **Pure domain port + tests** — `Code`, `Matching`, `Confirm`, `CommitGate`, `Session`, checklist;
   port vitest → JUnit. (Locks 0-FP logic before any pixels.)
3. **Recognizer core** — `GlyphFeatures`, `GlyphEngine`, atlas pre-bake + `Atlas.kt`, `Locate`,
   `Rotate`, `prepForOcr`; golden-image tests on saved frames.
4. **Camera + capture** — `CameraFrameSource` (CameraX/Camera2Interop, Y-plane), `AutoCapture`,
   `RecognizePipeline`; on-device bench.
5. **Scan screen** — orchestration (recognize chain, confirmer, commitGate, flash/beep/haptic),
   fill-light + reticle + ROI; **live tuning on the Pixel**.
6. **Remaining screens + state** — Collection, Report, Settings, Onboarding, Nav, DataStore repos,
   backup, session persistence.
7. **Fallback** — Tesseract4Android wired behind the seam (high floor); fine-tuned `.traineddata`
   as the tracked follow-up using captured soft crops; A/B; ship.
8. **Hardening** — accessibility, small-screen, APK size, 0-FP re-validation live.

## 14. Out of scope (v1)

Front-of-sticker recognition; accounts/cloud sync; spare-count/trade marketplace; iOS. (Same
non-goals as the PWA spec.) NDK kernels are deferred behind a profiled win (D2). PaddleOCR/CRNN
fallback is a possible future switch only if a live A/B beats fine-tuned Tesseract (§7).
