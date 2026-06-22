import { describe, expect, it } from 'vitest';
import { checklist } from '../data/checklist';
import { buildPileLink, readPilePayload, pileShareTextFor } from './pileShare';
import { buildShareLink } from './share';

// Real album codes, so the round-trip can't be a no-op against an empty set.
const sample = checklist.entries.slice(0, 3).map((e) => e.code);

describe('pileShare round-trip', () => {
  it('encodes codes into a ?p= link and reads them back', () => {
    const link = buildPileLink('https://x.test/app/', sample, checklist, 'João');
    expect(link).toContain('p=');
    const back = readPilePayload(link, checklist);
    expect(back).not.toBeNull();
    expect(new Set(back!.codes)).toEqual(new Set(sample));
    expect(back!.name).toBe('João');
  });

  it('round-trips without a name', () => {
    const link = buildPileLink('https://x.test/app/', sample, checklist);
    const back = readPilePayload(link, checklist);
    expect(back).not.toBeNull();
    expect(new Set(back!.codes)).toEqual(new Set(sample));
    expect(back!.name).toBeUndefined();
  });

  it('returns null for garbage / no p value', () => {
    expect(readPilePayload('https://x.test/app/#trocar', checklist)).toBeNull();
    expect(readPilePayload('?p=@@@notbase64@@@', checklist)).toBeNull();
    expect(readPilePayload('', checklist)).toBeNull();
  });

  it('is isolated from the trade ?t= link (a ?t= link is not read as a pile)', () => {
    const tradeLink = buildShareLink(
      'https://x.test/app/',
      { repeats: sample, missing: [] },
      checklist,
    );
    expect(readPilePayload(tradeLink, checklist)).toBeNull();
  });

  it('keeps the human-readable message and link in sync', () => {
    const { link, text } = pileShareTextFor(sample, checklist, 'João');
    expect(text).toContain(link);
    expect(text).toContain(String(sample.length));
  });
});
