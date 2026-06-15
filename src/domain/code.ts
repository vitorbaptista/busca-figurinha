// Pure helpers for the printed sticker codes (e.g. "CIV 12", "FWC 1", "00").
// No app state here — just string normalization, parsing and edit distance.

import type { ParsedCode } from '../types';

/** Uppercase and strip everything except A-Z and 0-9. "civ 12" -> "CIV12". */
export function normalizeCode(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/**
 * Insert a single space between a leading-letters prefix and a trailing-digits
 * suffix. "CIV12" -> "CIV 12", "FWC1" -> "FWC 1". Codes that are all letters or
 * all digits (e.g. "00") are returned unchanged.
 */
export function toDisplay(code: string): string {
  const match = /^([A-Z]+)(\d+)$/.exec(code);
  if (!match) return code;
  return `${match[1]} ${match[2]}`;
}

/**
 * Normalize then split into a letter prefix + trailing integer.
 * "CIV12" -> { teamCode: "CIV", number: 12, canonical: "CIV12" }.
 * "00"    -> { teamCode: "",    number: 0,  canonical: "00" }.
 * Returns null when there are no trailing digits to read a number from.
 */
export function parseCode(raw: string): ParsedCode | null {
  const canonical = normalizeCode(raw);
  const match = /^([A-Z]*)(\d+)$/.exec(canonical);
  if (!match) return null;
  return {
    teamCode: match[1],
    number: parseInt(match[2], 10),
    canonical,
  };
}

/** Standard Levenshtein edit distance (insert/delete/substitute = 1). */
export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  // Single rolling row of distances; prev[j] is the cost to the previous column.
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const curr = [i];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        prev[j] + 1, // deletion
        curr[j - 1] + 1, // insertion
        prev[j - 1] + cost, // substitution
      );
    }
    prev = curr;
  }
  return prev[b.length];
}
