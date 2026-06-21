import { describe, expect, it } from 'vitest';
import {
  friendCanReceive,
  friendGiveBreakdown,
  friendsNeeding,
  givableTo,
  huntVerdict,
  needsDiff,
  normalizeName,
  radarFriendNames,
  type FriendList,
} from './friendMatch';

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

describe('friendGiveBreakdown', () => {
  it('splits a friend needs into what I can give now vs what they still need', () => {
    const joao = friend({ needs: ['MEX3', 'BRA7', 'ARG4'] });
    const b = friendGiveBreakdown(joao, new Set(['MEX3', 'ARG4', 'FRA9']));
    expect(b.canGive.slice().sort()).toEqual(['ARG4', 'MEX3']);
    expect(b.stillNeeds).toEqual(['BRA7']);
  });

  it('preserves friend needs order in stillNeeds and never repeats a code across buckets', () => {
    const joao = friend({ needs: ['MEX3', 'BRA7', 'ARG4'] });
    const b = friendGiveBreakdown(joao, new Set(['BRA7']));
    expect(b.canGive).toEqual(['BRA7']);
    expect(b.stillNeeds).toEqual(['MEX3', 'ARG4']);
  });

  it('is all-stillNeeds when I have no spares for them', () => {
    const joao = friend({ needs: ['MEX3', 'BRA7'] });
    expect(friendGiveBreakdown(joao, new Set())).toEqual({ canGive: [], stillNeeds: ['MEX3', 'BRA7'] });
  });
});

describe('radarFriendNames', () => {
  const joao = friend({ id: 'a', name: 'João', needs: ['MEX3', 'BRA7'] });
  const maria = friend({ id: 'b', name: 'Maria', needs: ['MEX3'] });

  it('names the active saved friends who need a scanned code that is one of my spares', () => {
    expect(radarFriendNames('MEX3', new Set(['MEX3']), [joao, maria])).toEqual(['João', 'Maria']);
  });

  it('is empty when the scanned code is NOT my spare (the 0-FP gate — I might own only one)', () => {
    expect(radarFriendNames('MEX3', new Set(), [joao, maria])).toEqual([]);
    expect(radarFriendNames('BRA7', new Set(['MEX3']), [joao])).toEqual([]);
  });

  it('skips archived friends', () => {
    const ana = friend({ id: 'c', name: 'Ana', needs: ['MEX3'], archived: true });
    expect(radarFriendNames('MEX3', new Set(['MEX3']), [ana, joao])).toEqual(['João']);
  });
});

describe('needsDiff', () => {
  it('reports what a friend found (old needs gone) + what they still need', () => {
    const d = needsDiff(['MEX3', 'BRA7', 'ARG4'], ['BRA7', 'ARG4']);
    expect(d.found).toEqual(['MEX3']);
    expect(d.stillNeeds).toEqual(['BRA7', 'ARG4']);
  });

  it('found stays empty when the friend only added needs', () => {
    const d = needsDiff(['MEX3'], ['MEX3', 'FRA9']);
    expect(d.found).toEqual([]);
    expect(d.stillNeeds).toEqual(['MEX3', 'FRA9']);
  });

  it('is empty-found when the list is unchanged', () => {
    expect(needsDiff(['MEX3'], ['MEX3'])).toEqual({ found: [], stillNeeds: ['MEX3'] });
  });

  it('treats a first-time save (no old needs) as nothing found', () => {
    expect(needsDiff([], ['MEX3', 'BRA7'])).toEqual({ found: [], stillNeeds: ['MEX3', 'BRA7'] });
  });
});

describe('normalizeName', () => {
  it('lowercases, strips accents, trims and collapses whitespace (for match-by-name)', () => {
    expect(normalizeName('  João  ')).toBe('joao');
    expect(normalizeName('JOÃO')).toBe('joao');
    expect(normalizeName('Maria  das   Couves')).toBe('maria das couves');
  });
});

describe('friendsNeeding (Conferir — NOT spare-gated, unlike radarFriendNames)', () => {
  const joao = friend({ id: 'a', name: 'João', needs: ['MEX3', 'BRA7'] });
  const maria = friend({ id: 'b', name: 'Maria', needs: ['MEX3'] });

  it('names every active friend whose list includes the code — regardless of whether I own/spare it', () => {
    // The whole point: I am scanning THEIR sticker, so my own spares are irrelevant here.
    expect(friendsNeeding('MEX3', [joao, maria])).toEqual(['João', 'Maria']);
    expect(friendsNeeding('BRA7', [joao, maria])).toEqual(['João']);
  });

  it('is empty when no active friend needs the code', () => {
    expect(friendsNeeding('FRA9', [joao, maria])).toEqual([]);
  });

  it('skips archived friends', () => {
    const ana = friend({ id: 'c', name: 'Ana', needs: ['MEX3'], archived: true });
    expect(friendsNeeding('MEX3', [ana, joao])).toEqual(['João']);
  });
});

describe('huntVerdict', () => {
  it("I don't own it → take it for me (mine wins; friends are secondary)", () => {
    expect(huntVerdict({ owned: false, friendNames: [] })).toEqual({
      kind: 'take-mine',
      take: true,
      forMe: true,
      forFriends: [],
    });
    expect(huntVerdict({ owned: false, friendNames: ['João'] })).toEqual({
      kind: 'take-mine',
      take: true,
      forMe: true,
      forFriends: ['João'],
    });
  });

  it('I own it but a friend needs it → take it for the friend', () => {
    expect(huntVerdict({ owned: true, friendNames: ['João', 'Maria'] })).toEqual({
      kind: 'take-friends',
      take: true,
      forMe: false,
      forFriends: ['João', 'Maria'],
    });
  });

  it('I own it and nobody needs it → skip', () => {
    expect(huntVerdict({ owned: true, friendNames: [] })).toEqual({
      kind: 'skip',
      take: false,
      forMe: false,
      forFriends: [],
    });
  });
});
