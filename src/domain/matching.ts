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

/** Tokens shorter than this are too ambiguous to auto-correct (e.g. "SE3" could
 *  be many codes); we only accept them on an exact match. Real codes are 4+ chars. */
const MIN_CORRECT_LEN = 4;

/**
 * Match a single raw token against the checklist. Exact lookup first; otherwise the
 * UNIQUE nearest same-length code within `maxDistance` edits (a single-character
 * substitution, e.g. "GIV12"→"CIV12"). Two guards keep us from confident wrong
 * answers — worse than a miss for a trading app:
 *  - tokens shorter than 4 chars are only matched exactly ("SE3" stays unknown);
 *  - if two real codes are equally near, it's ambiguous → unknown ("CV12" is one
 *    edit from both CIV12 and CPV12; "EGYA" from EGY1..EGY9). We never guess.
 */
export function matchCode(
  raw: string,
  list: Checklist,
  maxDistance: number = CONFIG.match.maxDistance,
): MatchResult {
  const normalized = normalizeCode(raw);

  const exact = list.byCode.get(normalized);
  if (exact) return { raw: normalized, status: 'exact', entry: exact, distance: 0 };

  if (normalized.length < MIN_CORRECT_LEN) {
    return { raw: normalized, status: 'unknown', entry: null, distance: -1 };
  }

  let bestEntry = null as MatchResult['entry'];
  let bestDistance = Infinity;
  let tieAtBest = 0;

  for (const entry of list.entries) {
    if (entry.code.length !== normalized.length) continue; // substitutions only
    const distance = levenshtein(normalized, entry.code);
    if (distance > maxDistance) continue;
    if (distance < bestDistance) {
      bestEntry = entry;
      bestDistance = distance;
      tieAtBest = 1;
    } else if (distance === bestDistance) {
      tieAtBest++;
    }
  }

  // Accept only a single, unambiguous nearest code.
  if (bestEntry && tieAtBest === 1) {
    return { raw: normalized, status: 'corrected', entry: bestEntry, distance: bestDistance };
  }
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
 * Match a block of OCR text where each line is one located code-box crop. Each line
 * is matched on its own and long lines are skipped, so legal-text crops can't
 * contribute a spurious code substring. Returns one MatchResult per unique entry.
 */
export function matchLines(
  text: string,
  list: Checklist,
  maxDistance: number = CONFIG.match.maxDistance,
): MatchResult[] {
  const seen = new Set<string>();
  const results: MatchResult[] = [];
  for (const line of text.split('\n')) {
    const norm = normalizeCode(line);
    // A real code line is short; skip blank and long (legal-text) lines.
    if (norm.length < 2 || norm.length > 8) continue;
    const m = bestMatchFromText(line, list, maxDistance);
    if (m?.entry && !seen.has(m.entry.code)) {
      seen.add(m.entry.code);
      results.push(m);
    }
  }
  return results;
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
