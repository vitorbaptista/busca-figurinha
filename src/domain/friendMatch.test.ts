import { describe, expect, it } from 'vitest';
import { friendCanReceive, givableTo, normalizeName, type FriendList } from './friendMatch';

function friend(over: Partial<FriendList>): FriendList {
  return { id: 'x', name: 'X', needs: [], source: 'link', archived: false, updatedAt: 0, ...over };
}

describe('friendCanReceive', () => {
  const joao = friend({ id: 'a', name: 'João', needs: ['MEX3', 'BRA7'] });
  const maria = friend({ id: 'b', name: 'Maria', needs: ['MEX3', 'ARG4'] });

  it('returns friends who need a code I can GIVE (the code is one of my spares)', () => {
    const myRepeats = new Set(['MEX3']);
    expect(friendCanReceive({ code: 'MEX3', myRepeatCodes: myRepeats, friends: [joao, maria] }).map((f) => f.id)).toEqual([
      'a',
      'b',
    ]);
  });

  it('returns [] when the code is NOT a spare of mine — even if a friend needs it (the 0-FP gate)', () => {
    // I scanned MEX3 but it is NOT in my repeats (I need it too / just got it) → I cannot give it.
    expect(friendCanReceive({ code: 'MEX3', myRepeatCodes: new Set(), friends: [joao, maria] })).toEqual([]);
    expect(friendCanReceive({ code: 'BRA7', myRepeatCodes: new Set(['MEX3']), friends: [joao] })).toEqual([]);
  });

  it('excludes archived friends', () => {
    const archived = friend({ id: 'c', name: 'Pedro', needs: ['MEX3'], archived: true });
    expect(
      friendCanReceive({ code: 'MEX3', myRepeatCodes: new Set(['MEX3']), friends: [archived, joao] }).map((f) => f.id),
    ).toEqual(['a']);
  });

  it('returns [] when no active friend needs the code', () => {
    expect(friendCanReceive({ code: 'FRA9', myRepeatCodes: new Set(['FRA9']), friends: [joao, maria] })).toEqual([]);
  });
});

describe('givableTo', () => {
  it('is the friend needs I actually have as spares', () => {
    const joao = friend({ needs: ['MEX3', 'BRA7', 'ARG4'] });
    expect(givableTo(joao, new Set(['MEX3', 'ARG4', 'FRA9'])).sort()).toEqual(['ARG4', 'MEX3']);
  });

  it('is empty when I have none of their needs', () => {
    expect(givableTo(friend({ needs: ['MEX3'] }), new Set(['BRA7']))).toEqual([]);
  });
});

describe('normalizeName', () => {
  it('lowercases, strips accents, trims and collapses whitespace (for match-by-name)', () => {
    expect(normalizeName('  João  ')).toBe('joao');
    expect(normalizeName('JOÃO')).toBe('joao');
    expect(normalizeName('Maria  das   Couves')).toBe('maria das couves');
  });
});
