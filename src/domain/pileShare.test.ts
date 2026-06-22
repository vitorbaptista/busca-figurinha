import { describe, expect, it } from 'vitest';
import { checklist } from '../data/checklist';
import { buildPileLink, readPilePayload, pileShareTextFor } from './pileShare';
import { buildShareLink } from './share';

// Real album codes, so the round-trip can't be a no-op against an empty set.
const pile = checklist.entries.slice(0, 4).map((e) => e.code);
const taken = pile.slice(0, 2); // the first two were taken in the trade
const notTaken = pile.slice(2);

describe('pileShare round-trip', () => {
  it('owned = the whole pile; repeats = only the not-taken ones', () => {
    const link = buildPileLink('https://x.test/app/', pile, taken, checklist, 'João');
    expect(link).toContain('p=');
    const back = readPilePayload(link, checklist);
    expect(back).not.toBeNull();
    // Everything scanned enters the friend's álbum.
    expect(new Set(back!.ownedCodes)).toEqual(new Set(pile));
    // Only the ones you did NOT take become the friend's repetidas (you took the others' dupes).
    expect(new Set(back!.repeatCodes)).toEqual(new Set(notTaken));
    expect(back!.name).toBe('João');
  });

  it('with nothing taken, every sticker is owned AND a repeat', () => {
    const link = buildPileLink('https://x.test/app/', pile, [], checklist);
    const back = readPilePayload(link, checklist);
    expect(back).not.toBeNull();
    expect(new Set(back!.ownedCodes)).toEqual(new Set(pile));
    expect(new Set(back!.repeatCodes)).toEqual(new Set(pile));
    expect(back!.name).toBeUndefined();
  });

  it('with everything taken, all owned but no repeats remain', () => {
    const link = buildPileLink('https://x.test/app/', pile, pile, checklist);
    const back = readPilePayload(link, checklist);
    expect(back).not.toBeNull();
    expect(new Set(back!.ownedCodes)).toEqual(new Set(pile));
    expect(back!.repeatCodes).toEqual([]);
  });

  it('returns null for garbage / no p value', () => {
    expect(readPilePayload('https://x.test/app/#trocar', checklist)).toBeNull();
    expect(readPilePayload('?p=@@@notbase64@@@', checklist)).toBeNull();
    expect(readPilePayload('', checklist)).toBeNull();
  });

  it('is isolated from the trade ?t= link (a ?t= link is not read as a pile)', () => {
    const tradeLink = buildShareLink(
      'https://x.test/app/',
      { repeats: pile, missing: [] },
      checklist,
    );
    expect(readPilePayload(tradeLink, checklist)).toBeNull();
  });

  it('keeps the human-readable message and link in sync (count = whole pile)', () => {
    const { link, text } = pileShareTextFor(pile, taken, checklist, 'João');
    expect(text).toContain(link);
    expect(text).toContain(String(pile.length));
  });
});
