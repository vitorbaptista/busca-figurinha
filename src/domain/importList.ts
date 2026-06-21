// Importing a sticker list pasted from another World Cup 2026 album app. A lean strategy layer over
// the existing trade-list parser: each ImportStrategy says how well it recognizes a given text
// (detect) and how to parse it; parseImport runs the best match, falling back to the format-agnostic
// `common` strategy. Add a per-app strategy later by pushing one onto `defaultStrategies` — only when
// a real format actually breaks the common parser.

import type { Checklist } from '../types';
import { parseTradeListDetailed } from './tradeList';

export interface ImportResult {
  /** Recognized canonical codes, deduped, in album order. */
  codes: string[];
  /** `${teamCode}${number}` tokens whose team is known but whose code isn't in this album (the
   *  994-vs-992 album mismatch), in appearance order — surfaced so the import preview can show how
   *  many were skipped and the user can trust the count. */
  unrecognized: string[];
  /** Name of the strategy that parsed the text (for debugging/telemetry). */
  strategy: string;
}

export interface ImportStrategy {
  name: string;
  /** Confidence in [0, 1] that this strategy fits the text. The common fallback returns a low
   *  baseline so any app-specific strategy that actually recognizes the format wins. */
  detect(text: string): number;
  parse(text: string, checklist: Checklist): ImportResult;
}

const COMMON_BASELINE = 0.1;

/** Format-agnostic fallback: the robust trade-list parser, which already handles the emoji/country
 *  layout and loose pastes by validating every token against the checklist. */
export const commonStrategy: ImportStrategy = {
  name: 'common',
  detect: () => COMMON_BASELINE,
  parse(text, checklist) {
    const { codes, unrecognized } = parseTradeListDetailed(text, checklist);
    return { codes, unrecognized, strategy: 'common' };
  },
};

/** The strategies parseImport tries, highest detect() wins. Push an app-specific strategy here to
 *  support a format the common parser can't handle. */
export const defaultStrategies: ImportStrategy[] = [commonStrategy];

/** Parse a pasted sticker list into recognized codes + a count of what was skipped, choosing the
 *  strategy that best recognizes the text. Ties (and an all-zero field) keep the earliest strategy,
 *  so the common fallback — listed first in defaultStrategies with a non-zero baseline — handles
 *  anything no app-specific strategy claims. */
export function parseImport(
  text: string,
  checklist: Checklist,
  strategies: ImportStrategy[] = defaultStrategies,
): ImportResult {
  let best = strategies[0];
  let bestScore = best.detect(text);
  for (const strategy of strategies.slice(1)) {
    const score = strategy.detect(text);
    if (score > bestScore) {
      best = strategy;
      bestScore = score;
    }
  }
  return best.parse(text, checklist);
}
