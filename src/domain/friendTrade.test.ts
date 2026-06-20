import { describe, expect, it } from 'vitest';
import {
  toggleCode,
  tradeScore,
  shareBackPayload,
  prefilledHave,
  isEmptyFriendLink,
  friendDraftKey,
  serializeDraft,
  parseDraft,
} from './friendTrade';
import type { TradePayload } from './tradeList';

describe('toggleCode', () => {
  it('returns a NEW set with the code added (does not mutate the input)', () => {
    const before = new Set(['MEX3']);
    const after = toggleCode(before, 'BRA7');
    expect(after).not.toBe(before); // new instance → Preact re-renders
    expect([...after].sort()).toEqual(['BRA7', 'MEX3']);
    expect([...before]).toEqual(['MEX3']); // input untouched
  });

  it('removes the code when already present', () => {
    const after = toggleCode(new Set(['MEX3', 'BRA7']), 'MEX3');
    expect([...after]).toEqual(['BRA7']);
  });
});

describe('tradeScore', () => {
  it('counts wanted as p and have-to-give as d, total = p + d (the "trocar N" number)', () => {
    const score = tradeScore(new Set(['BRA7', 'BRA14', 'MEX3']), new Set(['ARG4', 'FRA9']));
    expect(score.p).toBe(3);
    expect(score.d).toBe(2);
    expect(score.total).toBe(5); // mockup: "Dá pra trocar 5" = 3 + 2
    expect(score.twoWay).toBe(true);
    expect(score.canRespond).toBe(true);
  });

  it('is receive-only (not two-way) when nothing is offered, but can still respond (wishlist)', () => {
    const score = tradeScore(new Set(['BRA7']), new Set());
    expect(score.p).toBe(1);
    expect(score.d).toBe(0);
    expect(score.twoWay).toBe(false);
    expect(score.canRespond).toBe(true);
  });

  it('cannot respond when nothing is selected at all', () => {
    expect(tradeScore(new Set(), new Set()).canRespond).toBe(false);
  });
});

describe('shareBackPayload', () => {
  it('maps have→repeats and want→missing — built ONLY from taps, never matchTrades', () => {
    const p = shareBackPayload(['ARG4', 'FRA9'], ['BRA7', 'MEX3']);
    expect(p.repeats.sort()).toEqual(['ARG4', 'FRA9']);
    expect(p.missing.sort()).toEqual(['BRA7', 'MEX3']);
  });

  it("missing is the targeted reply (only what was tapped), NOT the user's full wishlist", () => {
    // Even though a real user is missing ~900 codes, the share-back only advertises the tapped wants.
    const p = shareBackPayload([], ['BRA7']);
    expect(p.missing).toEqual(['BRA7']);
    expect(p.repeats).toEqual([]);
  });

  it('dedupes and omits name unless given', () => {
    const p = shareBackPayload(['ARG4', 'ARG4'], ['BRA7', 'BRA7'], '  ');
    expect(p.repeats).toEqual(['ARG4']);
    expect(p.missing).toEqual(['BRA7']);
    expect(p.name).toBeUndefined(); // blank name dropped
    expect(shareBackPayload([], [], 'Léo').name).toBe('Léo');
  });
});

describe('prefilledHave', () => {
  it("pre-marks friend's needs the user already holds as a spare (repeats ∩ friend.missing)", () => {
    const have = prefilledHave(['ARG4', 'FRA9', 'JPN2'], new Set(['ARG4', 'FRA9', 'BRA7']));
    expect(have.sort()).toEqual(['ARG4', 'FRA9']); // JPN2 not a repeat; BRA7 not needed by friend
  });

  it('returns nothing when the user has no matching spares', () => {
    expect(prefilledHave(['ARG4'], new Set(['BRA7']))).toEqual([]);
  });
});

describe('isEmptyFriendLink', () => {
  it('is empty when the friend shared neither spares nor needs', () => {
    expect(isEmptyFriendLink({ repeats: [], missing: [] })).toBe(true);
  });

  it('is empty for a name-only link (readShareLink returns non-null for those)', () => {
    expect(isEmptyFriendLink({ repeats: [], missing: [], name: 'João' })).toBe(true);
  });

  it('is not empty when there is anything to compare', () => {
    expect(isEmptyFriendLink({ repeats: ['MEX3'], missing: [] })).toBe(false);
    expect(isEmptyFriendLink({ repeats: [], missing: ['BRA7'] })).toBe(false);
  });
});

describe('friendDraftKey', () => {
  it('is stable for the same lists regardless of order, and ignores name', () => {
    const a: TradePayload = { repeats: ['MEX3', 'BRA7'], missing: ['ARG4'], name: 'Léo' };
    const b: TradePayload = { repeats: ['BRA7', 'MEX3'], missing: ['ARG4'] };
    expect(friendDraftKey(a)).toBe(friendDraftKey(b));
  });

  it('differs when the lists differ', () => {
    expect(friendDraftKey({ repeats: ['MEX3'], missing: [] })).not.toBe(
      friendDraftKey({ repeats: ['MEX4'], missing: [] }),
    );
  });
});

describe('serializeDraft / parseDraft', () => {
  it('round-trips the key + selections', () => {
    const raw = serializeDraft('k1', new Set(['ARG4']), new Set(['BRA7', 'MEX3']));
    const parsed = parseDraft(raw);
    expect(parsed).toEqual({ key: 'k1', have: ['ARG4'], want: ['BRA7', 'MEX3'] });
  });

  it('returns null for missing or garbage input', () => {
    expect(parseDraft(null)).toBeNull();
    expect(parseDraft('not json')).toBeNull();
    expect(parseDraft('{"key":"k1"}')).toBeNull(); // missing arrays
    expect(parseDraft('[]')).toBeNull();
  });
});
