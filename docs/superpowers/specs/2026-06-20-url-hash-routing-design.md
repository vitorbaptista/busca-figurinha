# URL-hash section routing — design

**Date:** 2026-06-20
**Status:** Approved

## Problem

The app tracks the active section in an in-memory `screen` state (`src/app.tsx`). Nothing is
written to the URL, so a page refresh always drops the user back on the default Escanear screen,
and there is no way to link/bookmark a specific section. The user wants refresh-persistence and
shareable per-section links using URL hashes (e.g. `#trocar`).

## Goal

Persist the active section in the URL hash so that:

1. Refreshing the page restores the section the user was on.
2. Each section has a stable, shareable link (`…/#trocar`, `…/#colecao`, …).
3. Switching tabs does **not** pile up browser-history entries — the phone/browser Back button
   exits the app rather than cycling through previously-visited tabs.

## Approach

Hash-based routing, implemented by hand (no router library — the app has 6 screens).

Alternatives considered and rejected:
- **Path-based (`/trocar`)** — would require SPA 404-fallback / rewrite rules; breaks on GitHub
  Pages without extra config.
- **Query param (`?screen=trocar`)** — uglier and conceptually collides with the existing `?t=`
  share-link param.

## Slug mapping (pt-BR, matching the nav labels)

| Screen       | Hash          | Notes                                  |
|--------------|---------------|----------------------------------------|
| `scan`       | `#escanear`   | default; also the empty/unknown hash   |
| `collection` | `#colecao`    |                                        |
| `trade`      | `#trocar`     |                                        |
| `settings`   | `#ajustes`    |                                        |
| `repeats`    | `#repetidas`  | sub-screen of Trocar                   |
| `report`     | writes `#escanear` | ephemeral — see below             |

### The `report` exception

The report screen is built from an in-memory finished session that is wiped on finish; it cannot
be reconstructed on refresh. So while on `report` the hash stays `#escanear` (the Nav already
highlights Escanear for report — report lives "inside" the scan flow). Refreshing on a report
lands the user on a clean Escanear. No data is lost: reaching report means the session was already
committed/cleared.

## Mechanism

New pure module `src/ui/routing.ts`:

- `hashFromScreen(screen: Screen): string` — slug for a screen (`report` → `escanear`).
- `screenFromHash(hash: string): Screen` — parse a hash to a screen; unknown/empty → `scan`.

Both are pure string functions (no `location` access), so they unit-test in node without jsdom.

In `src/app.tsx`:

- Initial `screen` state reads `location.hash` via `screenFromHash`. The existing `?t=`
  friend-payload still takes precedence (→ `trade`, which is consistently `#trocar`).
- One `useEffect` writes the hash on every `screen` change via `history.replaceState`, preserving
  `location.pathname` + `location.search` so the GitHub-Pages base path and the `?t=`/`?debug`/
  `?capture` flags survive. `replaceState` adds no history entry (the chosen Back behavior) and
  does **not** fire `hashchange`, so there is no sync loop.

### Deliberate omission

No `hashchange` listener. The requirement is refresh/link persistence, handled by the initial
read; with `replaceState` there are no tab history entries for Back/Forward to cross. Consequence:
manually editing the hash in the URL bar of an already-open page won't live-reroute (a refresh
will). This keeps the implementation minimal.

## Testing

- `src/ui/routing.test.ts` (vitest): each slug round-trips, unknown/empty hash → `scan`,
  `report` → `escanear`.
- `npm run build` typecheck must pass (strict `noUnusedLocals`/`noUnusedParameters`).

## Files

- New: `src/ui/routing.ts`, `src/ui/routing.test.ts`
- Edit: `src/app.tsx` (initial state from hash + sync effect)
- Edit: `CHANGELOG.md` (pt-BR entry)
