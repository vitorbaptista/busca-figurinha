# Back navigates between sections (GH #73) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the browser **Back** button return to the previously-viewed section instead of exiting the app.

**Architecture:** The app mirrors the active `screen` into the URL hash from a single `useEffect` in `app.tsx`. Today it always `replaceState`s, so no history entries accumulate and Back leaves the app. Change it so the **first** sync after load still `replaceState`s (canonicalize the hash / strip a consumed `?t=` with no phantom entry), but every **later** in-app section change `pushState`s — giving the Back button a section to return to. A new `popstate` listener maps the restored hash → `screen`; because the popstate handler lands on exactly the URL the writer would produce, the writer's equality check writes nothing, so there is no history loop. The replace/push/none decision is extracted into a pure `nextHistoryStep(loc, screen, dropQuery, isFirstSync)` in `routing.ts` so it unit-tests in node like the rest of routing.

**Tech Stack:** Preact + TypeScript, Vite, vitest (jsdom). No new deps.

## Global Constraints

- **pt-BR** for every user-facing string (CHANGELOG entry). Code/comments/CLAUDE.md are English.
- `npm run build` (tsc `--noEmit` is strict: `noUnusedLocals`/`noUnusedParameters`) + `npm test` must pass.
- **0 false positives** cardinal rule — unaffected here (no OCR/recognizer change) but must still hold.
- Routing invariants: **one** history writer (the `app.tsx` effect), `sectionUrl` keeps `pathname` + `search`, `routing.ts` stays pure (no `location` access), **never** assign `location.hash =`, **no** `hashchange` listener. `report`/`conferir` stay ephemeral (absent from the reverse map).

---

### Task 1: Pure `nextHistoryStep` decision function + tests

**Files:**
- Modify: `src/ui/routing.ts` (add `nextHistoryStep`)
- Test: `src/ui/routing.test.ts` (add a `describe('nextHistoryStep')`)

**Interfaces:**
- Consumes: existing `sectionUrl(loc, screen, dropQuery)`, `hashFromScreen`, type `Screen`.
- Produces: `nextHistoryStep(loc: { pathname: string; search: string; hash: string }, screen: Screen, dropQuery: boolean, isFirstSync: boolean): { action: 'push' | 'replace' | 'none'; url: string }`
  - `url = sectionUrl(loc, screen, dropQuery)`.
  - `action='none'` when `url` already equals `loc.pathname + loc.search + loc.hash` (already there — a Back/Forward the popstate handler just synced, or an already-canonical load).
  - else `action='replace'` when `isFirstSync` (canonicalize in place, no phantom entry), `action='push'` otherwise (a real in-app navigation — Back returns here).

- [ ] **Step 1: Write the failing tests** — append to `src/ui/routing.test.ts`:

```ts
describe('nextHistoryStep', () => {
  const loc = (hash: string, search = '') => ({ pathname: '/', search, hash });

  it('replaces (no phantom entry) on the first sync when the hash is not yet canonical', () => {
    expect(nextHistoryStep(loc(''), 'scan', false, true)).toEqual({
      action: 'replace',
      url: '/#escanear',
    });
  });

  it('does nothing when the URL already matches (e.g. a Back/Forward just synced it)', () => {
    expect(nextHistoryStep(loc('#trocar'), 'trade', false, false)).toEqual({
      action: 'none',
      url: '/#trocar',
    });
  });

  it('pushes on a later in-app navigation so Back returns to the previous section', () => {
    expect(nextHistoryStep(loc('#escanear'), 'trade', false, false)).toEqual({
      action: 'push',
      url: '/#trocar',
    });
  });

  it('replaces to strip a consumed ?t= friend link on the first sync without a phantom entry', () => {
    expect(nextHistoryStep(loc('#trocar', '?t=ABC'), 'trade', true, true)).toEqual({
      action: 'replace',
      url: '/#trocar',
    });
  });

  it('is a no-op once the friend query is already stripped', () => {
    expect(nextHistoryStep(loc('#trocar'), 'trade', true, false)).toEqual({
      action: 'none',
      url: '/#trocar',
    });
  });
});
```

Also add `nextHistoryStep` to the import on line 2 of the test file.

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/ui/routing.test.ts`
Expected: FAIL — `nextHistoryStep is not a function` / not exported.

- [ ] **Step 3: Implement `nextHistoryStep`** in `src/ui/routing.ts` (after `sectionUrl`):

```ts
/**
 * Decide how to reflect a screen change into the address bar. Pure — the caller passes the current
 * URL and performs the `history` write — so it unit-tests in node like the rest of this module.
 * `replace` on the first sync after load canonicalizes the hash / strips a consumed `?t=` with no
 * phantom Back step; `push` on every later in-app navigation gives the browser Back button the prior
 * section to return to (GH #73); `none` when the URL already matches (a Back/Forward the popstate
 * handler just synced, so re-writing would re-trap Back).
 */
export function nextHistoryStep(
  loc: { pathname: string; search: string; hash: string },
  screen: Screen,
  dropQuery: boolean,
  isFirstSync: boolean,
): { action: 'push' | 'replace' | 'none'; url: string } {
  const url = sectionUrl(loc, screen, dropQuery);
  const current = `${loc.pathname}${loc.search}${loc.hash}`;
  if (url === current) return { action: 'none', url };
  return { action: isFirstSync ? 'replace' : 'push', url };
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run src/ui/routing.test.ts`
Expected: PASS (all old + 5 new).

- [ ] **Step 5: Commit**

```bash
git add src/ui/routing.ts src/ui/routing.test.ts
git commit -m "feat(routing): pure nextHistoryStep decides replace/push/none for the URL sync"
```

---

### Task 2: Wire push-on-nav + popstate Back into `app.tsx`

**Files:**
- Modify: `src/app.tsx` — import `useRef` and `nextHistoryStep`/`screenFromHash`; replace the URL-sync effect; add a `popstate` effect.

**Interfaces:**
- Consumes: `nextHistoryStep` (Task 1), existing `screenFromHash`, `setScreen`, `initialFriendPayload`.
- Produces: none (component wiring).

- [ ] **Step 1: Add `useRef` to the preact/hooks import** (line 1):

```ts
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
```

- [ ] **Step 2: Add `nextHistoryStep` to the routing import** (line 13):

```ts
import { nextHistoryStep, screenFromHash, sectionUrl } from './ui/routing';
```

(`sectionUrl` stays imported — still referenced by `nextHistoryStep`? No: `nextHistoryStep` is in routing.ts. After this edit `sectionUrl` is no longer used in `app.tsx`. Remove `sectionUrl` from this import to satisfy `noUnusedLocals` — final import is `import { nextHistoryStep, screenFromHash } from './ui/routing';`.)

- [ ] **Step 3: Add the first-sync ref** just below the `screen` state (after line 102):

```ts
  // The first URL sync after load canonicalizes in place (replaceState, no phantom Back step);
  // every later section change pushes so the browser Back button returns to the prior section.
  const firstUrlSync = useRef(true);
```

- [ ] **Step 4: Replace the URL-sync effect** (current lines 117–124) with the new comment + effect + a popstate listener:

```ts
  // Keep the active section and the URL hash in sync, two ways:
  //   • Section → URL: one writer. The first sync after load replaceState-canonicalizes the hash
  //     (and strips a consumed ?t= friend link) with no phantom history entry; every later in-app
  //     navigation pushState-s, so the browser Back button returns to the previous section (GH #73).
  //     sectionUrl keeps pathname (GH-Pages base) + the ?debug/?capture flags.
  //   • URL → section: a popstate listener maps a Back/Forward to the screen for the restored hash.
  //     It lands on exactly the URL the writer would produce, so nextHistoryStep returns 'none' and
  //     no second entry is written — there's no loop (push/replaceState don't fire `hashchange`, so
  //     there's still deliberately no `hashchange` listener).
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onPopState = () => setScreen(screenFromHash(location.hash));
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  useEffect(() => {
    if (typeof history === 'undefined' || typeof location === 'undefined') return;
    const step = nextHistoryStep(location, screen, !!initialFriendPayload, firstUrlSync.current);
    firstUrlSync.current = false;
    if (step.action === 'replace') history.replaceState(history.state, '', step.url);
    else if (step.action === 'push') history.pushState(history.state, '', step.url);
  }, [screen]);
```

- [ ] **Step 5: Verify the build + full test suite**

Run: `npm run build && npm test`
Expected: typecheck clean (no unused `sectionUrl`), all tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/app.tsx
git commit -m "feat(nav): browser Back returns to the previous section (closes #73)"
```

---

### Task 3: Update docs (CLAUDE.md invariant + CHANGELOG)

**Files:**
- Modify: `CLAUDE.md` — rewrite the "URL-hash routing has one writer" invariant to describe the new push/replace/popstate contract.
- Modify: `CHANGELOG.md` — add a pt-BR entry under a `## 2026-06-22` heading.

- [ ] **Step 1: Rewrite the routing invariant in `CLAUDE.md`** — replace the bullet starting "**URL-hash routing has one writer, and it's `replaceState`.**" with text that states: one writer still (the `app.tsx` effect, via `sectionUrl`/`nextHistoryStep`); first sync replaceState-canonicalizes, later navigations pushState (Back returns to the prior section, GH #73); a `popstate` listener syncs Back/Forward → screen and the writer's `none` branch prevents a loop; still never assign `location.hash =`, still no `hashchange` listener; `sectionUrl` keeps pathname + search; `report` ephemeral (Back from it lands on Escanear); `routing.ts` stays pure/node-tested.

- [ ] **Step 2: Add the CHANGELOG entry** at the top of the dated list (pt-BR):

```markdown
## 2026-06-22 — Voltar (Back) volta para a aba anterior, em vez de sair do app

### Changed
- **O botão "Voltar" do navegador/celular agora volta para a última aba que você abriu** (ex.: de
  "Trocar" para "Coleção"), em vez de fechar o app. Cada troca de aba vira um passo no histórico;
  quando você volta até o começo, aí sim o "Voltar" sai do app, como antes.
```

- [ ] **Step 3: Verify nothing else broke**

Run: `npm run build && npm test`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md CHANGELOG.md
git commit -m "docs: routing invariant + CHANGELOG for Back-navigates-sections (#73)"
```

---

## Manual verification (live, after merge-readiness)

Pure-node tests can't prove the real Back behavior. Sanity-check in a browser (dev server):
1. Load app → Escanear. Tap Coleção → Trocar. Press browser Back twice → returns Trocar → Coleção → Escanear (not exit). Back once more → exits app.
2. Reload on `#trocar` → lands on Trocar, Back exits (single entry, no phantom).
3. Open a `?t=` friend link → lands on Trocar, URL has no `?t=`, Back exits (no phantom entry from the strip).
4. Finish a scan → Resumo (report) → browser Back returns to the **previous section** and stays in the app (no blank screen). Report is ephemeral: it shares Escanear's slug and adds **no** history entry, so its own "Voltar" button is what returns to Escanear. Same for Conferir (launched from Trocar): its "Voltar" returns to Trocar; browser Back goes to the previous section.

## Review resolutions (folded in before implementation)

Two parallel plan-reviewers (correctness/invariants + simplicity/pt-BR) ran. Outcomes:

- **Keep the `nextHistoryStep` extraction** and the unused-`sectionUrl`-import removal — both endorsed (pure + node-testable decision logic; strict `noUnusedLocals` requires dropping the now-unused import). Final app.tsx import: `import { nextHistoryStep, screenFromHash } from './ui/routing';`.
- **pt-BR copy** fixed above: full "para" (not "pra") and "aba" used consistently (the app's vocabulary is tabs), per the simplicity reviewer.
- **Ephemeral `report`/`conferir` Back (correctness M1):** they share their parent's slug, so `nextHistoryStep` returns `none` → no separate entry → browser Back returns to the *previous section*, not always the parent. Deliberately **not** pushing duplicate-slug entries: that path needs the real screen in `history.state`, which reintroduces a blank-screen bug when the report is cleared on commit, plus a popstate stuck-flag hazard. This design is strictly better than today (Back stays in-app vs. exiting), and both screens keep their in-flow "Voltar" buttons. Documented honestly (manual step 4) — no overpromise.
- **Garbage-hash spurious push (correctness N3):** only reachable by hand-typing a malformed `#hash` in a desktop address bar; the product ships as an installed phone PWA with no editable address bar, so it's effectively unreachable. Not adding a second `history` writer to defend it (that would break the single-writer invariant). The pure design uses **no** popstate flag, so the related stuck-flag (N2) cannot occur.
- **Clear-friend / in-screen toggles not Back-reachable (correctness M2):** intentional — only section changes are history steps, not in-screen state changes (e.g. `onClearFriend`). The `?t=` strip still works (first-sync `replace`, no phantom).
- **CLAUDE.md invariant (correctness N4):** reword from "the SOLE place is `replaceState`" to "one writer *effect* that replaces on first sync and pushes on navigation, plus a `popstate` listener; the `none` branch (url===current) makes a Back/Forward sync write nothing → no loop." Reaffirm: still no `hashchange` listener, never assign `location.hash =`, `sectionUrl` keeps pathname+search, `routing.ts` stays pure. Note ephemeral Back behavior.
