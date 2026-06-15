// Turns noisy OCR text into checklist matches. The camera reads the back of a
// sticker, OCR returns messy multi-line text, and we fish out the printed code
// and snap it to a real album entry (allowing a tiny edit-distance correction).

import type { Checklist, MatchResult } from '../types';
import { CONFIG } from '../config';
import { levenshtein, normalizeCode } from './code';

/**
 * Pull candidate code tokens out of arbitrary OCR text. Matches letter+number
 * codes like "CIV 12" / "EGY4" plus the standalone "0"/"00" logo sticker.
 * Tokens are normalized and deduped, preserving first-seen order.
 */
export function extractCodes(text: string): string[] {
  const tokens: string[] = [];
  // Word-boundary anchored so we don't absorb trailing letters of an adjacent
  // word + the next number (e.g. "WORLD CUP 2026" must NOT yield "CUP202", and
  // "panini 00" must NOT yield "NINI00"). The logo sticker is the literal "00".
  const codeRe = /\b[A-Z]{2,4}\s?\d{1,3}\b/gi;
  const logoRe = /\b00\b/g;

  for (const m of text.matchAll(codeRe)) tokens.push(m[0]);
  for (const m of text.matchAll(logoRe)) tokens.push(m[0]);

  const seen = new Set<string>();
  const out: string[] = [];
  for (const token of tokens) {
    const code = normalizeCode(token);
    if (code && !seen.has(code)) {
      seen.add(code);
      out.push(code);
    }
  }
  return out;
}

/**
 * Match a single raw token against the checklist. Exact lookup first; otherwise
 * the nearest code within `maxDistance` edits. Among equally-near candidates we
 * prefer one of the same length as the raw token, then the first in list order.
 */
export function matchCode(
  raw: string,
  list: Checklist,
  maxDistance: number = CONFIG.match.maxDistance,
): MatchResult {
  const normalized = normalizeCode(raw);

  const exact = list.byCode.get(normalized);
  if (exact) return { raw: normalized, status: 'exact', entry: exact, distance: 0 };

  let bestEntry = null as MatchResult['entry'];
  let bestDistance = Infinity;
  let bestSameLength = false;

  for (const entry of list.entries) {
    const distance = levenshtein(normalized, entry.code);
    if (distance > maxDistance) continue;

    const sameLength = entry.code.length === normalized.length;
    // Strictly-closer wins; on a tie, a same-length candidate beats a different
    // length. Equal-priority ties keep the earlier list entry (no replacement).
    const better =
      distance < bestDistance || (distance === bestDistance && sameLength && !bestSameLength);
    if (better) {
      bestEntry = entry;
      bestDistance = distance;
      bestSameLength = sameLength;
    }
  }

  if (bestEntry) return { raw: normalized, status: 'corrected', entry: bestEntry, distance: bestDistance };
  return { raw: normalized, status: 'unknown', entry: null, distance: -1 };
}

/**
 * Best match across every code found in a block of OCR text. Returns null when
 * no candidate tokens are present. An exact hit always wins; otherwise the
 * smallest-distance correction; otherwise the first token's unknown result.
 */
export function bestMatchFromText(
  text: string,
  list: Checklist,
  maxDistance: number = CONFIG.match.maxDistance,
): MatchResult | null {
  const codes = extractCodes(text);
  if (codes.length === 0) return null;

  let best: MatchResult | null = null;
  for (const code of codes) {
    const result = matchCode(code, list, maxDistance);
    if (result.status === 'exact') return result;

    if (best === null) {
      best = result;
      continue;
    }
    // Prefer a real correction over the placeholder unknown, then the closer one.
    if (best.status === 'unknown' && result.status === 'corrected') best = result;
    else if (result.status === 'corrected' && result.distance < best.distance) best = result;
  }
  return best;
}
