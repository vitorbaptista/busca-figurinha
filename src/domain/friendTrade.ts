import type { TradePayload } from './tradeList';

// Pure helpers for the friend-match (cold-receiver) screen. All the screen's load-bearing logic lives
// here so it can be unit-tested (the repo has no component testing). 0-FP rule: the share-back is built
// ONLY from what the receiver tapped (shareBackPayload), never from matchTrades.

/** Toggle a code in a selection set, returning a NEW Set. A new instance is required so Preact's
 *  Object.is bail-out doesn't skip the re-render — mutating in place would freeze the chips. */
export function toggleCode(set: Set<string>, code: string): Set<string> {
  const next = new Set(set);
  if (!next.delete(code)) next.add(code);
  return next;
}

/** The live scoreboard, from session state only (never matchTrades). p = stickers you'd get ("Você
 *  pega"), d = stickers you'd give ("Você dá"), total = p + d ("Dá pra trocar N"). twoWay once you
 *  have something to give; canRespond once anything is selected (a one-way wishlist is shareable). */
export function tradeScore(
  want: Set<string>,
  have: Set<string>,
): { p: number; d: number; total: number; twoWay: boolean; canRespond: boolean } {
  const p = want.size;
  const d = have.size;
  return { p, d, total: p + d, twoWay: d > 0, canRespond: p + d > 0 };
}

/** The receiver's share-back payload, built ONLY from taps: have→repeats (what I give), want→missing
 *  (what I want). `missing` is a TARGETED reply — only the friend's spares I tapped, NOT my full
 *  ~900-code wishlist. Dedupes; a blank name is dropped. */
export function shareBackPayload(
  have: Iterable<string>,
  want: Iterable<string>,
  name?: string,
): TradePayload {
  const payload: TradePayload = { repeats: [...new Set(have)], missing: [...new Set(want)] };
  const trimmed = name?.trim();
  if (trimmed) payload.name = trimmed;
  return payload;
}

/** On load, pre-mark "tenho" for the friend's needs the user already holds as a spare (repeats ∩
 *  friend.missing), so a returning user's chips and scoreboard agree from the first paint. Pass the
 *  owned-intersected repeat set (myRepeatCodes). */
export function prefilledHave(friendMissing: Iterable<string>, myRepeats: Set<string>): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const code of friendMissing) {
    if (myRepeats.has(code) && !seen.has(code)) {
      seen.add(code);
      out.push(code);
    }
  }
  return out;
}

/** A friend link with neither spares nor needs carries nothing to compare (a name-only link, or an
 *  album-complete sharer). readShareLink returns non-null for a name-only payload, so the screen must
 *  detect emptiness here rather than relying on null. */
export function isEmptyFriendLink(friend: TradePayload): boolean {
  return friend.repeats.length === 0 && friend.missing.length === 0;
}

/** A stable key for the friend's list (order-independent, name-independent) so a draft of in-progress
 *  taps is only restored for the SAME link, not a different friend's. */
export function friendDraftKey(friend: TradePayload): string {
  const canon = `${[...friend.repeats].sort().join(',')}|${[...friend.missing].sort().join(',')}`;
  // djb2 → base36; collisions are harmless here (worst case: restore a same-list draft).
  let hash = 5381;
  for (let i = 0; i < canon.length; i++) hash = ((hash << 5) + hash + canon.charCodeAt(i)) >>> 0;
  return hash.toString(36);
}

interface Draft {
  key: string;
  have: string[];
  want: string[];
}

/** Serialize the in-progress selections (+ the link key) for a localStorage draft that survives a
 *  low-end-Android WebView remount mid-flow. */
export function serializeDraft(key: string, have: Set<string>, want: Set<string>): string {
  return JSON.stringify({ key, have: [...have], want: [...want] });
}

/** Parse a stored draft back; returns null for missing/garbage input (never throws). */
export function parseDraft(raw: string | null): Draft | null {
  if (!raw) return null;
  try {
    const data = JSON.parse(raw) as Partial<Draft>;
    if (typeof data.key !== 'string' || !Array.isArray(data.have) || !Array.isArray(data.want)) {
      return null;
    }
    return { key: data.key, have: data.have, want: data.want };
  } catch {
    return null;
  }
}
