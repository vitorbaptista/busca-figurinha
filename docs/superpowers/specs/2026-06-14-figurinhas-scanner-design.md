# Figurinhas Scanner — Design Spec

- **Date:** 2026-06-14
- **Status:** Draft for review
- **Working name:** *Troca Figurinhas* (placeholder, renameable)

## Summary

A static, client-side **Progressive Web App** that helps a collector sort World Cup
2026 Panini stickers for trading. The user mounts a phone on a tripod, camera facing
down, and shows each sticker's **back**. The app reads the printed code (e.g. `CIV 12`,
`EGY 4`) with on-device OCR, compares it to the user's collection, and flashes a big
green ("você precisa") or red ("você já tem") result — fully hands-free. Scanning is a
**session**: at the end it produces a report of the stickers the user needs, which the
user checks off after negotiating a trade. Only confirmed-acquired stickers are added to
the collection. All data stays on the device.

## Goals

- Identify a sticker in well under a couple of seconds, hands-free, from its back code.
- Tell the user instantly whether they **need** it or **already have** it.
- Produce an end-of-session report of needed stickers, with checkboxes to confirm which
  were actually acquired in a trade.
- Let the user seed and edit their collection via a checklist.
- Work offline, with no backend and no login. Data local to the device, with backup.
- Be usable on **small, low-end phones** by **children and teenagers**.

## Non-goals (v1)

- Front-of-sticker image recognition.
- Accounts, cloud sync, multi-device sync, or any server.
- A persistent trade marketplace / spares inventory screen (the session report covers the
  immediate trade need). May come later.
- Tracking how many duplicate copies the user holds (no spare counting).

## Users & hard constraints

- **Primary users: children and teenagers.** Minimal reading; big, obvious controls;
  bold color/icon feedback; forgiving and undoable; destructive actions gated.
- **Small screens.** Must work down to ~320 px wide (cheap Androids, iPhone SE). No
  horizontal scroll; touch targets ≥ 48 px; large fonts; high contrast.
- **Low-end performance.** OCR must stay responsive on budget Android hardware:
  aggressive downscaling/cropping, lazy-loaded and cached OCR engine, and a manual
  type-in fallback when OCR struggles.
- **Portuguese (BR)** interface, simple vocabulary.

## Core concepts & terminology

- **Sticker / figurinha** — one album item, identified by a unique **code**.
- **Code** — team abbreviation + number printed on the back, e.g. `CIV 12`. Observed
  format from samples: three uppercase letters + a number. Parsing is kept flexible
  (`[A-Z]{2,4}\s?\d{1,3}`) and reconciled against the master checklist.
- **Collection** — the set of codes the user **owns** (has in their album).
- **Needed** — a checklist code not in the collection.
- **Session** — one continuous scanning run. Read-only against the collection.
- **Keeper** — a scanned code that the user needs (candidate to acquire).
- **Report** — end-of-session summary: keepers (checkable) + repeats (collapsed).

## Identification: back-code OCR

The back of every sticker shows the code in a rounded box (top-right), high-contrast
text in a clean printed font — ideal for OCR. The pipeline:

1. Capture a camera frame; downscale to ~640 px wide.
2. Convert to grayscale and apply a threshold to maximize text contrast.
3. Run OCR (Tesseract.js) with a character whitelist of `A–Z0–9` (no lowercase).
4. Regex-extract candidate code tokens.
5. Normalize (strip spaces, uppercase) and **fuzzy-match** to the master checklist
   (Levenshtein distance ≤ 1) to autocorrect misreads.
6. Accept the best match above a confidence threshold; otherwise show "tente de novo"
   with an obvious **manual type-in** fallback.

An on-screen alignment guide encourages users to drop the sticker roughly centered and
upright, improving accuracy without requiring precise placement.

## User flows

### First run (onboarding)
A short, friendly, mostly-visual walkthrough: how to position the phone on a tripod, how
to show the back of the sticker, and that the screen flashes green/red. Skippable;
re-openable from Ajustes. Prompts for camera permission in context.

### Seed the collection
Open **Coleção**. Teams are listed as expandable sections; tapping a number toggles
owned/needed. A progress bar shows `owned / total`. Search jumps to a code. This is a
one-time setup that can be edited anytime.

### Scan session
Open **Escanear**. Camera fills the screen. The user shows stickers one by one:
- A stable-frame detector waits until the sticker is steady, runs OCR, matches the code.
- The whole screen flashes **🟢 GUARDAR — <team>** (needed) or **🔴 REPETIDA — <team>**
  (already owned), with the code shown large. No sound by default (optional toggle).
- The result locks until the sticker leaves the frame, preventing double-reads.
- Live counters show "X novas · Y repetidas" for the session.
- Unreadable codes flash a neutral "tente de novo" and can be typed in manually.

### Session report & confirm
Tapping "Terminar" opens the **Relatório**:
- Totals: scanned count, keepers count.
- **Para guardar (você precisa)** — deduplicated keepers, each with a checkbox.
- **Repetidas (você já tem)** — collapsed list.
- A "selecionar todas/nenhuma" control; keepers default to **selected**.
- "Adicionar marcadas à coleção" marks the checked keepers as owned. Unchecked keepers
  remain needed. This is the only path (besides the checklist) that changes the
  collection.

### Backup
**Ajustes** → Export writes a JSON file (collection + settings). Import restores it.
Reset is gated behind a confirmation.

## Screens

All screens use a large bottom navigation with icons + short labels. Layouts are
single-column, reflow to ≥320 px, and use large type and ≥48 px targets.

1. **Escanear** — full-bleed camera, alignment guide, full-screen green/red flash with
   code + team, live session counters, big "Terminar" button.
2. **Relatório** — totals; checkable keeper list; collapsed repeats; "Adicionar marcadas".
3. **Coleção** — team accordions, tap-to-toggle owned, progress bar, search.
4. **Ajustes** — export/import, language, sound toggle (default off), re-open onboarding,
   reset (gated).

## Data model (all local)

- **Checklist** (baked-in static data): array of
  `{ code: string, team: string, teamCode: string, number: number, name: string, type: string }`.
- **Collection** (IndexedDB): a set of owned `code` strings.
- **Active session** (localStorage, auto-saved): ordered scan results
  `{ code, ownedAtScan: boolean, ts }`, survives accidental reloads.
- **Settings** (localStorage): `{ language, sound: boolean, onboarded: boolean }`.

## Master checklist data

Populated during implementation by **researching the official Panini FIFA World Cup
2026 (Brazil edition) checklist** from multiple sources, cross-checked against the two
real sample images (`CIV12`, `EGY4`). Stored in a single editable data file
(`src/data/checklist.ts` or `.json`) so it can be corrected easily. The app degrades
gracefully on a scanned code absent from the checklist (treats it as unknown and lets the
user accept or retry). Exact totals and any special sections (badges, legends, intro
pages, foils) are resolved during research; the data shape above accommodates a `type`
field for non-player stickers.

## Tech stack

- **Vite + TypeScript + Preact** + plain CSS (tiny bundle, fast on low-end devices).
- **Tesseract.js** (WASM OCR), `tessdata_fast` Latin/eng model, lazy-loaded and cached
  by the service worker; charset whitelist `A–Z0–9`; sparse-text page-seg mode.
- **idb-keyval** (or equivalent thin IndexedDB wrapper) for the collection.
- **Vitest** for unit tests (matching/fuzzy/parsing logic).
- **PWA**: web manifest + service worker (offline + installable; caches OCR assets).

## Auto-capture logic

A `requestAnimationFrame` loop computes a cheap frame-difference metric on a downscaled
canvas. When the frame is **steady** (difference below a threshold for ~300–400 ms) and
contains enough content, it triggers one OCR pass. After a result, capture is **locked**
until the frame changes significantly (sticker removed), so each sticker reads once.

## Matching / fuzzy logic

Extract tokens via `[A-Z]{2,4}\s?\d{1,3}`, normalize, then pick the checklist entry with
the smallest Levenshtein distance. Accept if distance ≤ 1 and OCR confidence is adequate;
otherwise prompt retry / manual entry. Unit-tested against known good and corrupted reads
(e.g. `C1V12` → `CIV12`, `EGY 4` → `EGY4`).

## Accessibility & kid-friendly design

- Color is reinforced with large icons/words (🟢 GUARDAR / 🔴 REPETIDA), not color alone.
- Large type, high contrast (WCAG AA), ≥48 px targets, single-column layouts.
- Forgiving: confirming acquired keepers is explicit; collection edits are reversible;
  reset is gated. No silent data loss; active session auto-saved.
- Minimal text; friendly, simple Portuguese.

## Performance budget (low-end Android)

- Initial app shell loads fast; OCR engine + model lazy-loaded with a one-time progress
  screen, then cached for offline reuse.
- OCR runs on a ~640 px downscaled, thresholded frame to keep each pass quick.
- Target: a steady sticker resolves to a flash within ~1–2 s on budget hardware. Manual
  type-in is always available as a fast fallback.

## Testing strategy

- **Vitest** unit tests for parsing, fuzzy-matching, and collection/session state logic.
- **OCR fixtures**: the two real sample images (`CIV12`, `EGY4`) as regression fixtures;
  expanded as the user supplies more sample backs.
- **Manual device testing** for camera, auto-capture, flash timing, and small-screen
  layout on a real low-end phone.

## Deployment

Static build deployed to **GitHub Pages** (HTTPS required for camera) via a GitHub
Actions workflow. Vite `base` path configured for the repo subpath. Host-agnostic — no
server-side code.

## Risks & mitigations

1. **OCR accuracy on phones / cheap hardware** → crop + threshold, charset whitelist,
   fuzzy-match to checklist, confidence gate, manual type-in fallback; tuned against real
   samples.
2. **Checklist correctness / late album additions** → research multiple sources, keep
   data in one editable file, degrade gracefully on unknown codes.
3. **Tesseract size/speed on low-end** → `tessdata_fast`, lazy-load + service-worker
   cache, downscaled OCR region, one-time loading screen.
4. **Camera/orientation variance** → alignment guide; tolerant whole-frame OCR + regex
   extraction; retry/manual fallback.

## Out of scope (v1) / possible future

- Persistent spares/trade-list screen and duplicate counting.
- Front-of-sticker recognition.
- Accounts and cloud sync.
- Multiple collection profiles per device.

## Open questions (resolved during implementation)

- Exact total sticker count and any special-section code schemes (from checklist
  research).
- Final app name and icon.
