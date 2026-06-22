import { describe, expect, it } from 'vitest';
import { createPileSession } from './pileSession';
import type { ChecklistEntry } from '../types';

// Minimal entry — `type` is cast so the test doesn't depend on the StickerType union's literals.
const entry = (code: string): ChecklistEntry => ({
  code,
  display: code,
  teamCode: 'T',
  teamName: 'Time',
  number: 1,
  type: 'team' as ChecklistEntry['type'],
});

describe('createPileSession', () => {
  it('dedupes reads by code in the whole pile and reports newness', () => {
    const s = createPileSession();
    expect(s.add(entry('A1'), 'take-mine')).toBe(true);
    expect(s.add(entry('A1'), 'take-mine')).toBe(false); // re-read of the same sticker
    expect(s.add(entry('B2'), 'skip')).toBe(true);
    expect(s.wholePile()).toEqual(['A1', 'B2']);
  });

  it('separates take-mine, take-friends and skip', () => {
    const s = createPileSession();
    s.add(entry('A1'), 'take-mine');
    s.add(entry('B2'), 'take-friends');
    s.add(entry('C3'), 'skip');
    expect(s.takenForMe()).toEqual(['A1']);
    expect(s.takenForFriends()).toEqual(['B2']);
    expect(s.wholePile()).toEqual(['A1', 'B2', 'C3']);
  });

  it('finish() returns the take-mine entries and the whole pile', () => {
    const s = createPileSession();
    s.add(entry('A1'), 'take-mine');
    s.add(entry('B2'), 'skip');
    const r = s.finish();
    expect(r.taken.map((e) => e.code)).toEqual(['A1']);
    expect(r.wholePile).toEqual(['A1', 'B2']);
  });

  it('finish() does NOT clear (unlike session.finish) — reset() is explicit', () => {
    const s = createPileSession();
    s.add(entry('A1'), 'take-mine');
    s.finish();
    expect(s.wholePile()).toEqual(['A1']);
    s.reset();
    expect(s.wholePile()).toEqual([]);
    expect(s.finish().taken).toEqual([]);
  });
});
