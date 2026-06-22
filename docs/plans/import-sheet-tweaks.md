# Plan — "Importar a lista" tweaks

Three changes to the `ImportSheet` flow (`src/ui/components/ImportSheet.tsx` + `src/i18n/pt.ts`).

## 1. Remove the "Colar da área de transferência" button
- Delete the `📋 pasteClipboard` ghost button (ImportSheet.tsx:121-123).
- Delete the now-orphaned `pasteFromClipboard` function (ImportSheet.tsx:47-54) — `noUnusedLocals`
  would fail the build otherwise.
- Delete the `pasteClipboard` i18n key (pt.ts:226) — dead after the button is gone.
- The textarea stays; users paste with the OS paste gesture.

## 2. Live count on the "Carregar lista" button
- Parse the textarea reactively: `const parsed = useMemo(() => parseImport(text, checklist), [text])`.
  parseImport is cheap string/regex work (not OCR) → fine per keystroke.
- Reuse `parsed` in `load()` instead of re-parsing.
- Button:
  - `disabled={parsed.codes.length === 0}` (was `text.trim().length === 0`).
  - label: `parsed.codes.length === 0 ? pt.importList.load : pt.importList.loadCount(parsed.codes.length)`.
- New i18n: `loadCount: (n) => n === 1 ? 'Carregar 1 figurinha' : `Carregar ${n} figurinhas``.
  Keep `load: 'Carregar lista'` for the disabled/zero state.
- Net: gibberish (0 recognized) keeps the button disabled at "Carregar lista"; recognized count
  drives "Carregar N figurinha(s)". This is the honest "stickers detected" number (matches the
  preview's `reconhecidas`).

## 3. A "Preciso" import implies "I have all the others"
On confirm of the **need** bucket, in addition to the existing `wants` write, mark every *other*
album code as owned:
```
wants.setOwned(preview.newCodes, true);                 // existing
const needed = new Set(preview.result.codes);           // recognized canonical codes (all in checklist)
const others = checklist.entries.map(e => e.code).filter(c => !needed.has(c));
collection.setOwned(others, true);                      // "I have all others"
```
Decisions:
- **Additive, never un-owns the needed codes.** The wishlist is the source of truth for "missing";
  consumers already intersect `wants` with not-owned (types.ts:267 comment). Forcibly un-owning a
  previously-owned code would be destructive; the common onboarding path starts from an empty
  collection so it's consistent anyway. Mirrors the existing have-import's additive nature.
- **Never touches `repeats`** → cannot create a tradeable spare → the file's "0-FP by construction"
  invariant still holds. (This is user-asserted ownership via an explicit confirm step, not the
  recognizer guessing — so the cardinal 0-FP rule, which is about the recognizer, is not at risk.)
- **Honesty via the confirm + done screens** is the safeguard against an accidental mass-write:
  - Preview (need only): add a note `fillsAlbum(othersCount)` = "Vou marcar as outras N como suas
    no álbum." where `othersCount = checklist.total - parsed.codes.length`.
  - Confirm button (need): always enabled in the preview block (recognized > 0 there); label
    `add(result.codes.length)`. The have path keeps its `newCodes.length === 0` gate.
  - Done (need): `doneNeed(addedToWants, ownedOthers)` = "X foram pra lista do que você precisa.
    E marquei as outras N como suas." Store `owned` count on the `done` step.

### Type/structure touch-ups
- `Step` `done` variant: add `owned?: number`.
- `confirm(preview)` param: widen to the full preview step so it can read `preview.result.codes`.
- ImportSheet.tsx: add `useMemo` to the preact/hooks import.
- Update the file-header comment to document the new "need ⇒ have-the-rest" behavior.

## Out of scope / non-goals
- No change to the **have** bucket.
- No pruning of `wants` when a code becomes owned (existing tolerated inconsistency).
- No new tests for the component (none exist; `importList.test.ts` covers the parser and is untouched).

## Verify
- `npm run build` (tsc + vite) green.
- `npm test` green (parser tests unaffected).
- Manual reasoning: empty collection + "preciso BRA1,BRA2,BRA5" ⇒ wants={BRA1,BRA2,BRA5},
  collection = all 992 − 3 = 989 owned. Scanner would say REPETIDA for owned, GUARDAR for the 3.
