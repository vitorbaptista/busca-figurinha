import { describe, expect, it } from 'vitest';
import { checklist } from '../data/checklist';
import { flagFor } from '../data/flags';
import {
  decodePayload,
  encodePayload,
  formatNeeds,
  formatTradeList,
  matchTrades,
  parseTradeList,
  type TradePayload,
} from './tradeList';

function codesOf(entries: { code: string }[]): string[] {
  return entries.map((entry) => entry.code);
}

describe('flagFor', () => {
  it('returns flags for teams and specials, and empty string for unknown codes', () => {
    expect(flagFor('MEX')).toBe('🇲🇽');
    expect(flagFor('civ')).toBe('🇨🇮');
    expect(flagFor('FWC')).toBe('⭐');
    expect(flagFor('ZZZ')).toBe('');
  });
});

describe('formatTradeList and parseTradeList', () => {
  it('formats by album group and round-trips through the parser', () => {
    const formatted = formatTradeList(
      ['CIV12', 'MEX20', 'FWC1', 'MEX3', 'MEX10', '00', 'MEX6', 'CIV12', 'ZZZ99'],
      checklist,
      { name: 'Ana', link: 'https://exemplo.com/app?t=abc' },
    );

    expect(formatted).toContain('🔁 Tenho 7 figurinhas repetidas da Copa 2026 pra trocar!');
    expect(formatted).toContain('Grupo A');
    expect(formatted).toContain('🇲🇽 México (MEX): 3, 6, 10, 20');
    expect(formatted).toContain('Grupo E');
    expect(formatted).toContain('🇨🇮 Costa do Marfim (CIV): 12');
    expect(formatted).toContain('Especiais');
    expect(formatted).toContain('⭐ Especiais (FWC): 00, 1');
    expect(formatted).toContain('https://exemplo.com/app?t=abc');

    expect(parseTradeList(formatted, checklist)).toEqual([
      'MEX3',
      'MEX6',
      'MEX10',
      'MEX20',
      'CIV12',
      '00',
      'FWC1',
    ]);
  });

  it('keeps an empty formatted list parseable', () => {
    const formatted = formatTradeList([], checklist);

    expect(formatted).toContain('Ainda não tenho repetidas pra trocar 🔁');
    expect(formatted).toContain('Nenhuma repetida informada.');
    expect(parseTradeList(formatted, checklist)).toEqual([]);
  });

  it('parses emoji format, loose lists, glued codes, FWC0 and standalone 00', () => {
    const pasted = [
      '🇲🇽 México (MEX): 3, 6, 10',
      'RSA 20',
      'CIV12 e CIV 12 de novo',
      'FWC 1',
      'FWC0',
      '00',
    ].join('\n');

    expect(parseTradeList(pasted, checklist)).toEqual([
      'MEX3',
      'MEX6',
      'MEX10',
      'RSA20',
      'CIV12',
      '00',
      'FWC1',
    ]);
  });

  it('ignores junk and does not invent out-of-range or unknown codes', () => {
    const pasted = [
      'Copa 2026',
      'MEX0, MEX21, CZE 21, ABC1',
      'MEX20 CIV99 CIV12 FWC0',
      'https://exemplo.com/app?t=MEX3',
    ].join('\n');

    expect(parseTradeList(pasted, checklist)).toEqual(['MEX20', 'CIV12', '00']);
  });
});

describe('formatNeeds', () => {
  it('lists needed codes inline in album order', () => {
    const line = formatNeeds(['CIV12', 'MEX3', 'MEX3', '00', 'ZZZ99'], checklist);
    // De-duped, junk dropped, album order: México (group A) before Costa do Marfim (E), '00' special last.
    expect(line).toBe('📍 Preciso (3): MEX3, CIV12, 00');
  });

  it('caps the spelled-out list and collapses the rest to +N', () => {
    const allCodes = checklist.entries.map((entry) => entry.code);
    const total = checklist.entries.length;
    const line = formatNeeds(allCodes, checklist, { cap: 3 });
    expect(line.startsWith(`📍 Preciso (${total}): `)).toBe(true);
    expect(line).toContain(`+${total - 3}`);
  });

  it('returns an empty string when nothing is needed', () => {
    expect(formatNeeds([], checklist)).toBe('');
    expect(formatNeeds(['ZZZ99'], checklist)).toBe('');
  });
});

describe('payload encoding', () => {
  it('round-trips repeats, missing and name exactly for canonical payloads', () => {
    const payload: TradePayload = {
      repeats: ['MEX3', 'RSA1', 'CIV12', '00', 'FWC19'],
      missing: ['MEX4', 'CAN2', 'BRA20', 'FWC1'],
      name: 'João 🔁',
    };

    const encoded = encodePayload(payload, checklist);

    expect(encoded).toMatch(/^1[A-Za-z0-9_-]+$/);
    expect(encoded).not.toContain('=');
    expect(decodePayload(encoded, checklist)).toEqual(payload);
  });

  it('is stable across input order, duplicates and FWC0 aliases', () => {
    const first = encodePayload({ repeats: ['CIV12', 'MEX3', 'MEX3'], missing: ['FWC1', 'FWC0'] }, checklist);
    const second = encodePayload({ repeats: ['MEX3', 'CIV12'], missing: ['00', 'FWC1'] }, checklist);

    expect(first).toBe(second);
    expect(decodePayload(first, checklist)).toEqual({
      repeats: ['MEX3', 'CIV12'],
      missing: ['00', 'FWC1'],
    });
  });

  it('keeps a full-album payload small', () => {
    const allCodes = checklist.entries.map((entry) => entry.code);
    const encoded = encodePayload({ repeats: allCodes, missing: allCodes }, checklist);
    const decoded = decodePayload(encoded, checklist);

    expect(encoded.length).toBeLessThan(400);
    expect(decoded.repeats).toHaveLength(checklist.entries.length);
    expect(decoded.missing).toHaveLength(checklist.entries.length);
  });

  it('returns empty sets for garbage payloads instead of throwing', () => {
    expect(decodePayload('garbage', checklist)).toEqual({ repeats: [], missing: [] });
    expect(decodePayload('1%%%%', checklist)).toEqual({ repeats: [], missing: [] });
  });
});

describe('matchTrades', () => {
  it('matches what I can get and what I can give in album order', () => {
    const result = matchTrades({
      me: {
        owned: ['MEX3', 'RSA1'],
        repeats: ['FWC1', 'CIV12', 'MEX4', 'ZZZ99'],
      },
      friend: {
        repeats: ['00', 'CIV12', 'MEX4', 'MEX3', 'NOPE'],
        missing: ['RSA1', 'FWC1', 'CIV12'],
      },
      checklist,
    });

    expect(codesOf(result.iCanGet)).toEqual(['MEX4', 'CIV12', '00']);
    expect(codesOf(result.iCanGive)).toEqual(['CIV12', 'FWC1']);
  });

  it('returns empty arrays for empty inputs', () => {
    const result = matchTrades({
      me: { owned: [], repeats: [] },
      friend: { repeats: [], missing: [] },
      checklist,
    });

    expect(result).toEqual({ iCanGet: [], iCanGive: [] });
  });
});
