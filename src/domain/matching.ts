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
 * Match a single raw token against the checklist. Exact lookup first; otherwise the
 * nearest SAME-LENGTH code within `maxDistance` edits — i.e. we only auto-correct
 * character substitutions (C→G, I→1), not insertions/deletions. That keeps good
 * fixes like "GIV12"→"CIV12" while refusing to snap a garbled short read like "SE3"
 * onto a real code ("SEN3"): for a trading app a confident wrong answer is worse
 * than a miss. Ties keep the first entry in list order.
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

  for (const entry of list.entries) {
    if (entry.code.length !== normalized.length) continue;
    const distance = levenshtein(normalized, entry.code);
    if (distance <= maxDistance && distance < bestDistance) {
      bestEntry = entry;
      bestDistance = distance;
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

/**
 * Match EVERY distinct code found in the text — for when several sticker backs are
 * in view at once. Returns one resolved MatchResult per unique album entry (exact
 * or corrected), in first-seen order. Unmatched noise tokens are dropped.
 */
export function matchAllFromText(
  text: string,
  list: Checklist,
  maxDistance: number = CONFIG.match.maxDistance,
): MatchResult[] {
  const seen = new Set<string>();
  const results: MatchResult[] = [];
  for (const code of extractCodes(text)) {
    const result = matchCode(code, list, maxDistance);
    if (!result.entry || seen.has(result.entry.code)) continue;
    seen.add(result.entry.code);
    results.push(result);
  }
  return results;
}
