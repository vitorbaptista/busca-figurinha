# URL-hash Section Routing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist the active section in the URL hash so a refresh or shared link (`…/#trocar`) restores the section, without piling up browser-history entries.

**Architecture:** A pure `src/ui/routing.ts` maps `Screen ↔ hash slug`. `src/app.tsx` seeds its initial `screen` from `location.hash` and writes the hash on every screen change via `history.replaceState` (preserving pathname + search). No router library; no `hashchange` listener.

**Tech Stack:** Preact + TypeScript + Vite, vitest for tests.

## Global Constraints

- **0 false positives / typecheck gate:** `npm run build` runs `tsc --noEmit` then `vite build`; strict `noUnusedLocals` + `noUnusedParameters` — an unused import/var fails the build.
- **No linter:** match surrounding comment density and naming. No ESLint/Prettier.
- **pt-BR for all user-facing text** (CHANGELOG included). Code/comments stay in English.
- **Slug map (pt-BR):** `scan→escanear` (default + empty/unknown), `collection→colecao`, `trade→trocar`, `settings→ajustes`, `repeats→repetidas`, `report→escanear` (ephemeral, writes escanear).
- **`Screen` type** is defined and exported from `src/ui/Nav.tsx`: `'scan' | 'report' | 'collection' | 'trade' | 'repeats' | 'settings'`.

---

### Task 1: Pure routing module

**Files:**
- Create: `src/ui/routing.ts`
- Test: `src/ui/routing.test.ts`

**Interfaces:**
- Consumes: `Screen` type from `src/ui/Nav.tsx`.
- Produces:
  - `hashFromScreen(screen: Screen): string` — returns the bare slug (no `#`), with `report → 'escanear'`.
  - `screenFromHash(hash: string): Screen` — accepts a raw hash (`'#trocar'`, `'trocar'`, or `''`); returns the matching screen; unknown/empty → `'scan'`. Never returns `'report'`.
  - `sectionUrl(loc: { pathname: string; search: string }, screen: Screen, dropQuery: boolean): string` — the canonical address-bar URL for a section: keeps `pathname` (GH-Pages base survives), sets the hash from `screen`, and keeps `search` UNLESS `dropQuery` (used once after a `?t=` friend link is consumed, so a reload doesn't re-open the list). Pure → unit-testable in node. This is the single source of truth for the URL, so the app needs only one `replaceState` site (no dual-effect ordering hazard).

- [ ] **Step 1: Write the failing test**

Create `src/ui/routing.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { hashFromScreen, screenFromHash } from './routing';

describe('screenFromHash', () => {
  it('maps each known slug to its screen', () => {
    expect(screenFromHash('#escanear')).toBe('scan');
    expect(screenFromHash('#colecao')).toBe('collection');
    expect(screenFromHash('#trocar')).toBe('trade');
    expect(screenFromHash('#ajustes')).toBe('settings');
    expect(screenFromHash('#repetidas')).toBe('repeats');
  });

  it('tolerates a missing leading #', () => {
    expect(screenFromHash('trocar')).toBe('trade');
  });

  it('falls back to scan for empty or unknown hashes', () => {
    expect(screenFromHash('')).toBe('scan');
    expect(screenFromHash('#')).toBe('scan');
    expect(screenFromHash('#report')).toBe('scan');
    expect(screenFromHash('#lixo')).toBe('scan');
  });
});

describe('hashFromScreen', () => {
  it('maps each screen to its slug', () => {
    expect(hashFromScreen('scan')).toBe('escanear');
    expect(hashFromScreen('collection')).toBe('colecao');
    expect(hashFromScreen('trade')).toBe('trocar');
    expect(hashFromScreen('settings')).toBe('ajustes');
    expect(hashFromScreen('repeats')).toBe('repetidas');
  });

  it('writes the escanear slug for the ephemeral report screen', () => {
    expect(hashFromScreen('report')).toBe('escanear');
  });

  it('round-trips every routable screen', () => {
    for (const s of ['scan', 'collection', 'trade', 'settings', 'repeats'] as const) {
      expect(screenFromHash('#' + hashFromScreen(s))).toBe(s);
    }
  });
});

describe('sectionUrl', () => {
  it('keeps the path + query and sets the hash', () => {
    expect(sectionUrl({ pathname: '/busca-figurinha/', search: '' }, 'trade', false)).toBe(
      '/busca-figurinha/#trocar',
    );
  });

  it('preserves dev/query flags when not dropping the query', () => {
    expect(sectionUrl({ pathname: '/', search: '?debug' }, 'collection', false)).toBe(
      '/?debug#colecao',
    );
  });

  it('drops the query when a friend ?t= link was consumed', () => {
    expect(sectionUrl({ pathname: '/app/', search: '?t=ABC' }, 'trade', true)).toBe('/app/#trocar');
  });

  it('writes the escanear slug for the ephemeral report screen', () => {
    expect(sectionUrl({ pathname: '/', search: '' }, 'report', false)).toBe('/#escanear');
  });
});
```

> Update the import line at the top of the test file to include `sectionUrl`:
> `import { hashFromScreen, screenFromHash, sectionUrl } from './routing';`

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/ui/routing.test.ts`
Expected: FAIL — cannot resolve `./routing` (module not created yet).

- [ ] **Step 3: Write minimal implementation**

Create `src/ui/routing.ts`:

```ts
import type { Screen } from './Nav';

// Section ↔ URL-hash slug map (pt-BR, matching the nav labels). The hash persists the active
// section across refreshes and makes each section linkable (…/#trocar). `report` is ephemeral
// (built from a finished, already-cleared session) so it can't be restored on refresh — it shares
// the Escanear slug, the tab it lives "inside" (see Nav).
const SLUGS: Record<Screen, string> = {
  scan: 'escanear',
  report: 'escanear',
  collection: 'colecao',
  trade: 'trocar',
  settings: 'ajustes',
  repeats: 'repetidas',
};

// Reverse map for parsing a hash back to a screen. `report` is omitted so it's never a target.
const SCREENS: Record<string, Screen> = {
  escanear: 'scan',
  colecao: 'collection',
  trocar: 'trade',
  ajustes: 'settings',
  repetidas: 'repeats',
};

/** Bare slug (no `#`) for a screen; `report` writes the Escanear slug. */
export function hashFromScreen(screen: Screen): string {
  return SLUGS[screen];
}

/** Parse a raw hash (`'#trocar'`, `'trocar'`, or `''`) to a screen; unknown/empty → `'scan'`. */
export function screenFromHash(hash: string): Screen {
  return SCREENS[hash.replace(/^#/, '')] ?? 'scan';
}

/**
 * Canonical address-bar URL for a section. Keeps `pathname` (so the GitHub-Pages base path
 * survives) and `search` (so the ?debug/?capture/?record flags survive), and sets the hash from
 * the screen. `dropQuery` clears the query — used once after a `?t=` friend link is consumed so a
 * reload/back doesn't re-open the friend's list. Single source of truth: the app writes the URL
 * only here, so there's no dual-`replaceState` ordering hazard.
 */
export function sectionUrl(
  loc: { pathname: string; search: string },
  screen: Screen,
  dropQuery: boolean,
): string {
  const search = dropQuery ? '' : loc.search;
  return `${loc.pathname}${search}#${hashFromScreen(screen)}`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/ui/routing.test.ts`
Expected: PASS (all cases).

- [ ] **Step 5: Commit**

```bash
git add src/ui/routing.ts src/ui/routing.test.ts
git commit -m "feat(routing): pure Screen<->hash slug map + URL builder"
```

---

### Task 2: Wire routing into the app + CHANGELOG

**Files:**
- Modify: `src/app.tsx` (remove `clearTradeQuery`; seed initial `screen` from hash; replace the friend-clear effect with one URL-sync effect)
- Modify: `CHANGELOG.md` (new dated section at top, pt-BR)

**Interfaces:**
- Consumes: `screenFromHash`, `sectionUrl` from `src/ui/routing.ts` (Task 1).

> **Why merge instead of just adding an effect:** the existing `clearTradeQuery` effect and a new
> hash-writer would both call `history.replaceState` with different URL shapes (one drops `search`,
> one keeps it); correctness would depend on effect source-ordering. Folding both into one
> `sectionUrl`-driven effect removes that hazard — one writer owns the URL.

- [ ] **Step 1: Import the routing helpers**

In `src/app.tsx`, add to the import block (near the `Nav` import on line 11):

```ts
import { screenFromHash, sectionUrl } from './ui/routing';
```

- [ ] **Step 2: Remove the now-redundant `clearTradeQuery` helper**

In `src/app.tsx`, delete the whole helper + its doc comment (currently lines 66-71):

```ts
/** Strip the ?t= payload from the address bar after we've read it, so a reload/back doesn't
 *  re-open the friend's list and the URL stays clean to share. */
function clearTradeQuery(): void {
  if (typeof history === 'undefined' || typeof location === 'undefined') return;
  history.replaceState(history.state, '', `${location.origin}${location.pathname}${location.hash}`);
}
```

Its job (strip `?t=`) is absorbed by the URL-sync effect in Step 4. Leaving it would fail the
`noUnusedLocals` typecheck once its caller is removed.

- [ ] **Step 3: Seed initial screen from the hash**

In `src/app.tsx`, change the initial `screen` state (currently line 94):

```ts
  const [screen, setScreen] = useState<Screen>(() => (initialFriendPayload ? 'trade' : 'scan'));
```

to read the hash when there's no incoming friend payload:

```ts
  const [screen, setScreen] = useState<Screen>(() =>
    initialFriendPayload ? 'trade' : screenFromHash(typeof location === 'undefined' ? '' : location.hash),
  );
```

- [ ] **Step 4: Replace the friend-clear effect with one URL-sync effect**

In `src/app.tsx`, replace the existing effect (currently lines 101-103):

```ts
  useEffect(() => {
    if (initialFriendPayload) clearTradeQuery();
  }, [initialFriendPayload]);
```

with:

```ts
  // Mirror the active section into the URL hash so a refresh/shared link restores it, and (once a
  // ?t= friend link has been read into state) strip that query so a reload doesn't re-open the
  // list. replaceState (not assigning location.hash) adds no history entry — switching tabs doesn't
  // pile up Back steps — and doesn't fire `hashchange`, so there's no sync loop. sectionUrl keeps
  // pathname (GH-Pages base) + the ?debug/?capture flags.
  useEffect(() => {
    if (typeof history === 'undefined' || typeof location === 'undefined') return;
    history.replaceState(history.state, '', sectionUrl(location, screen, !!initialFriendPayload));
  }, [screen]);
```

- [ ] **Step 5: Typecheck + run the full test suite**

Run: `npm run build`
Expected: PASS (tsc clean, vite build succeeds).

Run: `npm test`
Expected: PASS (existing suite + new routing tests).

- [ ] **Step 6: Update CHANGELOG.md**

In `CHANGELOG.md`, insert a new distinct H2 at the very top of the entries — at line 6, immediately
above the existing `## 2026-06-20 — Escanear: tela sem rolagem…` entry. The file already stacks
multiple same-date H2s newest-first, so a third `## 2026-06-20` heading is correct here:

```markdown
## 2026-06-20 — Links por seção (#trocar, #colecao…)

### Added
- **A seção atual agora fica no endereço (hash da URL).** Atualizar a página volta para a mesma
  seção em vez de cair sempre no "Escanear", e dá pra abrir/compartilhar um link direto de cada
  seção: `#escanear`, `#colecao`, `#trocar`, `#ajustes` e `#repetidas`. Trocar de aba não enche o
  histórico do navegador (o "Voltar" sai do app, não fica preso pulando entre abas). A tela de
  relatório é momentânea, então ao atualizar nela você volta para o "Escanear".
```

- [ ] **Step 7: Commit**

```bash
git add src/app.tsx CHANGELOG.md
git commit -m "feat(routing): persist active section in the URL hash"
```

---

## Self-Review

- **Spec coverage:** refresh-persistence (Task 2 Step 3) ✓; shareable per-section links (Task 1 slug map + Step 3) ✓; no Back-button pile-up (Task 2 Step 4, replaceState) ✓; report exception (Task 1 SLUGS + tests) ✓; preserve `?t=`/base path (Task 1 `sectionUrl` + Task 2 Step 4) ✓; friend `?t=` stripped on consume (Task 1 `sectionUrl` dropQuery + Task 2 Step 4) ✓; tests incl. friend-URL case (Task 1) ✓; CHANGELOG pt-BR (Task 2 Step 6) ✓.
- **Placeholder scan:** none.
- **Type consistency:** `screenFromHash`/`hashFromScreen`/`sectionUrl` names + signatures identical across Task 1 and Task 2; `Screen` sourced from `Nav.tsx` in both module and app. `clearTradeQuery` removal noted so `noUnusedLocals` stays green.
- **Review fixes folded in:** dual-`replaceState` ordering hazard (finding 3) resolved by the single `sectionUrl` writer; CHANGELOG heading pinned (finding 8).
