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
  // Conferir is a camera launched from Trocar — ephemeral like `report`: it shares the Trocar slug and
  // is absent from the reverse map below, so a refresh restores to Trocar (don't relaunch a camera cold).
  conferir: 'trocar',
};

// Reverse map for parsing a hash back to a screen. `report` + `conferir` are omitted (never targets).
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
