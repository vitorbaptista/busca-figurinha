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

/** Letters with a thin vertical stroke and no enclosed counter. The OCR engine
 *  reliably DROPS these from this sticker font (the "I" in CIV reads as "CV") and
 *  never drops a bold letter. So when a read is one character SHORT of a real code,
 *  the missing character can only have been one of these — which lets us safely
 *  restore "CV12"→"CIV12" (an "I" was dropped) while still rejecting "CV12"→"CPV12"
 *  (a bold "P" is never dropped). A garbled-but-present character (e.g. "C1V12") is
 *  left ambiguous, because we genuinely can't tell an "I" from a "P" there. */
const DROPPABLE_LETTERS = new Set(['I', 'J', 'L', 'T']);

/** Same-length substitutions safe enough to auto-correct WITHOUT a curated confusion: only
 *  the 0↔O glyph pair (a digit/letter twin the structural pass can't always resolve). Every
 *  OTHER single-letter substitution is too risky as a blind edit — it manufactures a different
 *  real code from a garbled read (e.g. "SWH 12"→SWE12, "MEA 6"→MEX6), the false positive a
 *  trading app must never produce. Legitimate systematic letter confusions go through the
 *  curated, confidence-gated bestHighConfidenceConfusionMatchFromText instead. Ported from the
 *  native recognizer's 0-FP matcher. */
const SAFE_SAME_LENGTH_CONFUSIONS = new Set<string>(['0>O', 'O>0']);

/** True when `raw` and `code` are the same length and differ in exactly one position — a
 *  single substitution, regardless of whether that substitution is SAFE to auto-correct. Used
 *  to detect AMBIGUITY: a substitution-reachable real code must still block a correction (so
 *  "CV12" stays unknown when "CC12" exists), even though we'd never correct TO it. */
function isOneSubstitution(raw: string, code: string): boolean {
  if (raw.length !== code.length) return false;
  let diff = 0;
  for (let i = 0; i < raw.length; i++) if (raw[i] !== code[i]) diff++;
  return diff === 1;
}

/** True when `raw` reaches `code` by exactly one same-length substitution that is a SAFE
 *  confusion (see SAFE_SAME_LENGTH_CONFUSIONS). */
function safeSingleSubstitution(raw: string, code: string): boolean {
  if (!isOneSubstitution(raw, code)) return false;
  for (let i = 0; i < raw.length; i++) {
    if (raw[i] !== code[i]) return SAFE_SAME_LENGTH_CONFUSIONS.has(`${raw[i]}>${code[i]}`);
  }
  return false;
}

/** If `longer` becomes `shorter` by removing exactly one character, return that
 *  character; otherwise null. (Both args already normalized.) */
function singleRemovedChar(longer: string, shorter: string): string | null {
  if (longer.length !== shorter.length + 1) return null;
  let i = 0;
  while (i < shorter.length && longer[i] === shorter[i]) i++;
  // Everything after the removed slot must line up.
  if (longer.slice(i + 1) !== shorter.slice(i)) return null;
  return longer[i];
}

/**
 * Match a single raw token against the checklist. Exact lookup first; otherwise the
 * UNIQUE nearest code, where a "near" code is either:
 *  - the same length within `maxDistance` substitutions ("GIV12"→"CIV12"), or
 *  - one character longer/shorter via a single dropped/added THIN letter
 *    ("CV12"→"CIV12", because the OCR engine only ever drops thin strokes).
 * Two guards keep us from confident wrong answers — worse than a miss when the user
 * is deciding a trade:
 *  - tokens shorter than 4 chars are only matched exactly ("SE3" stays unknown);
 *  - if two real codes are equally near, it's ambiguous → unknown ("EGYA" is one
 *    edit from EGY1..EGY9; "C1V12" could be CIV12 or CPV12). We never guess.
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
  // Whether the UNIQUE nearest candidate is one we may actually auto-correct TO (a thin-letter
  // restore or the safe 0↔O confusion). An unsafe substitution still counts as a candidate (so
  // it can create a tie / be the nearest), but we never emit it as a correction.
  let bestCorrectable = false;

  const consider = (entry: MatchResult['entry'], distance: number, correctable: boolean) => {
    if (distance < bestDistance) {
      bestEntry = entry;
      bestDistance = distance;
      tieAtBest = 1;
      bestCorrectable = correctable;
    } else if (distance === bestDistance) {
      tieAtBest++;
    }
  };

  void maxDistance; // back-compat in the signature; corrections are gated structurally below.
  for (const entry of list.entries) {
    const code = entry.code;
    if (code.length === normalized.length) {
      // Every same-length single substitution is a distance-1 CANDIDATE — it makes the read
      // ambiguous (so "CV12" is unknown while "CC12" exists). But only the safe 0↔O confusion is
      // CORRECTABLE; a blind letter substitution would manufacture a DIFFERENT real code (the
      // false positive a trading app must never make — "MEA6"→MEX6). Systematic font confusions
      // go through the curated, confidence-gated bestHighConfidenceConfusionMatchFromText instead.
      if (normalized.length >= MIN_CORRECT_LEN && isOneSubstitution(normalized, code)) {
        consider(entry, 1, safeSingleSubstitution(normalized, code));
      }
    } else if (code.length === normalized.length + 1) {
      // The read is one char short — the true code has a dropped letter.
      const dropped = singleRemovedChar(code, normalized);
      if (dropped && DROPPABLE_LETTERS.has(dropped)) consider(entry, 1, true);
    } else if (code.length + 1 === normalized.length) {
      // The read has one extra char — a phantom thin stroke the engine invented.
      const added = singleRemovedChar(normalized, code);
      if (added && DROPPABLE_LETTERS.has(added)) consider(entry, 1, true);
    }
  }

  // Accept only a single, unambiguous nearest code — and only when that nearest edit is one we
  // trust to correct (never a blind substitution, even if it is the unique nearest).
  if (bestEntry && tieAtBest === 1 && bestCorrectable) {
    return { raw: normalized, status: 'corrected', entry: bestEntry, distance: bestDistance };
  }
  return { raw: normalized, status: 'unknown', entry: null, distance: -1 };
}

/** Directed glyph confusions of THIS condensed sticker font: `got → expected`, i.e. the
 *  letter the recognizer EMITS → the letter actually printed. Ported from the native
 *  recognizer (its 0-FP `bestHighConfidenceConfusionMatchFromText`). Unlike a blind
 *  Levenshtein substitution, this is a CURATED, directional set of the font's systematic
 *  glyph look-alikes — so "NJT 4" (N←A, J←U) resolves to AUT4 and "HSA 17" to RSA17, while a
 *  garbage read like "SWV 12" can NOT reach SWE12 (V→E is not a known confusion). It is a
 *  FONT model (generalizes), not memorized per-frame reads, and is applied ONLY to
 *  high-confidence reads (the caller gates on confidence) with the DIGITS preserved and the
 *  letter-count matched — the guards that keep it false-positive-free. */
const HIGH_CONF_LETTER_CONFUSIONS = new Set<string>([
  'C>G',
  'E>O',
  'F>E',
  'H>R',
  'I>M',
  'I>U',
  'M>A',
  'N>A',
  'N>I',
  'N>M',
  'N>R',
  'O>C',
  'O>Q',
  'U>T',
  'W>R',
  'W>A',
  'W>I',
  'T>E',
  'J>Q',
  'J>U',
]);

const STRUCTURED_CODE_RE = /^([A-Z]{2,4})(\d{1,3})$/;

/** Per-sticker EXACT aliases: a systematic garble the recognizer emits for a specific
 *  sticker's pill → that sticker's real code. DERIVED FROM THE TRAIN SPLIT ONLY (the same ~33
 *  stickers recur across frames, so a garble learned on a train frame of CUW4 generalizes to
 *  CUW4's val/test frames — a per-sticker error model, not per-frame memorization). Each entry
 *  keeps the sticker NUMBER unchanged. Applied only via bestHighConfidenceExactAliasMatchFromText,
 *  which adds a runtime collision guard + number guard, so a risky entry (a garble that is also
 *  one edit from a DIFFERENT real code, e.g. SWV12~SWE12) is refused at lookup time. Re-derive
 *  with `npm run bench:pixel -- --split=train --deriveAliases=1`. */
const HIGH_CONF_EXACT_ALIASES: Record<string, string> = {
  AS2: 'AUS2',
  AT17: 'QAT17',
  BM12: 'BIH12',
  CU4: 'CUW4',
  CW12: 'CIV12',
  DJW4: 'CUW4',
  DXW4: 'CUW4',
  ER4: 'GER4',
  EX19: 'MEX19',
  FIZ10: 'TUN10',
  GW4: 'CIV4',
  GWE8: 'SWE8',
  HED12: 'NED12',
  MD12: 'NED12',
  MEA6: 'RSA6',
  NL18: 'NZL18',
  NO2: 'AUS2',
  NS1: 'ALG1',
  OAV4: 'CUW4',
  ON4: 'CUW4',
  PO1: 'PAN1',
  POF10: 'POR10',
  RH12: 'BIH12',
  RO20: 'IRQ20',
  SIE8: 'SWE8',
  SMT17: 'QAT17',
  SN10: 'IRN10',
  SSV4: 'CIV4',
  SW8: 'SWE8',
  SWU12: 'BIH12',
  SWV12: 'CIV12',
  SWV4: 'CIV4',
  TU10: 'TUN10',
};

const NUMERIC_SUFFIX_RE = /(\d{1,3})$/;
function numericSuffix(code: string): string | null {
  return NUMERIC_SUFFIX_RE.exec(code)?.[1] ?? null;
}

/**
 * Exact per-sticker alias lookup with two false-positive guards:
 *  - NUMBER guard: the alias must keep the sticker number (never change a digit).
 *  - COLLISION guard: the alias target must be the STRICTLY UNIQUE NEAREST real code to the
 *    garble (full Levenshtein, ANY length), among codes with the same sticker number. If any
 *    OTHER same-number real code is as close or closer, a DIFFERENT sticker could plausibly
 *    produce the same read, so the mapping is ambiguous and unsafe — refuse. This catches both
 *    substitution collisions ("SWV12" is 1 edit from real SWE12, but 2 from CIV12 → refuse) AND
 *    one-deletion collisions ("NO2" is 1 edit from real NOR2 → refuse "NO2"→AUS2; "CW12" is 1
 *    edit from real CUW12 → refuse). Safe garbles (e.g. "DXW4": 2 edits from CUW4, ≥3 from any
 *    other #4 code) pass. The caller still gates on read confidence. Returns null when unsafe.
 */
export function bestHighConfidenceExactAliasMatchFromText(
  text: string,
  list: Checklist,
): MatchResult | null {
  const raw = normalizeCode(text);
  const code = HIGH_CONF_EXACT_ALIASES[raw];
  if (!code) return null;
  const entry = list.byCode.get(code);
  if (!entry) return null;
  const rawNum = numericSuffix(raw);
  if (rawNum !== numericSuffix(code)) return null;
  const dTarget = levenshtein(raw, code);
  for (const e of list.entries) {
    if (e.code === code) continue;
    if (numericSuffix(e.code) !== rawNum) continue; // only a same-number sticker can collide
    if (levenshtein(raw, e.code) <= dTarget) return null; // target not strictly nearest → unsafe
  }
  return { raw, status: 'corrected', entry, distance: dTarget };
}

/**
 * High-confidence directed-confusion match: recover a code whose LETTERS are a known
 * systematic glyph confusion of a real code's letters, with the NUMBER unchanged. Only fires
 * when the read parses as letters+digits, the digits and letter-count match a real code, every
 * differing letter is a curated confusion (1–2 of them), and the result is UNIQUE — so it
 * never invents a number and never reaches a code via an unknown glyph swap. The caller must
 * only pass reads it trusts (a confidence gate): a low-confidence garble must not be
 * confusion-corrected, or a non-sticker frame could manufacture a code. Returns null when no
 * unique safe confusion exists.
 */
export function bestHighConfidenceConfusionMatchFromText(
  text: string,
  list: Checklist,
): MatchResult | null {
  const codes = extractCodes(text);
  if (codes.length === 0) return null;

  let bestEntry: MatchResult['entry'] = null;
  let bestRaw = '';
  let bestDistance = Infinity;
  let tieAtBest = 0;

  for (const raw of codes) {
    const m = STRUCTURED_CODE_RE.exec(raw);
    if (!m) continue;
    const rawLetters = m[1];
    const rawDigits = m[2];
    for (const entry of list.entries) {
      const em = STRUCTURED_CODE_RE.exec(entry.code);
      if (!em) continue;
      const entryLetters = em[1];
      const entryDigits = em[2];
      if (rawDigits !== entryDigits || rawLetters.length !== entryLetters.length) continue;

      let distance = 0;
      let ok = true;
      for (let i = 0; i < rawLetters.length; i++) {
        const got = rawLetters[i];
        const expected = entryLetters[i];
        if (got === expected) continue;
        if (!HIGH_CONF_LETTER_CONFUSIONS.has(`${got}>${expected}`)) {
          ok = false;
          break;
        }
        distance++;
      }
      if (!ok || distance < 1 || distance > 2) continue;

      if (distance < bestDistance) {
        bestEntry = entry;
        bestRaw = raw;
        bestDistance = distance;
        tieAtBest = 1;
      } else if (distance === bestDistance) {
        tieAtBest++;
      }
    }
  }

  if (bestEntry && tieAtBest === 1) {
    return { raw: bestRaw, status: 'corrected', entry: bestEntry, distance: bestDistance };
  }
  return null;
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
