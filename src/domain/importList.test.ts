import { describe, expect, it } from 'vitest';
import { checklist } from '../data/checklist';
import {
  commonStrategy,
  defaultStrategies,
  parseImport,
  type ImportStrategy,
} from './importList';

// A real share text from another World Cup 2026 album app (the "Faltam 277" missing list). Every
// team code lines up 1:1 with our album and every number is in range, so the whole list resolves.
const SAMPLE = `🏆 *Copa 2026* — *❌ Faltam 277* — 717/994 (72%)

🌟 Introdução:
FWC3, FWC7, FWC8, FWC14

🇲🇽 México:
MEX2, MEX4, MEX11, MEX12, MEX13, MEX14, MEX18

🇿🇦 África do Sul:
RSA4, RSA10, RSA17

🇨🇿 República Tcheca:
CZE4, CZE9, CZE13, CZE14, CZE16, CZE17, CZE19, CZE20

🇨🇦 Canadá:
CAN3, CAN15

🇧🇷 Brasil:
BRA14, BRA19

🇬🇧 Inglaterra:
ENG3, ENG7, ENG13, ENG14, ENG17, ENG18, ENG20

🇫🇷 França:
FRA1, FRA2, FRA3, FRA5, FRA7, FRA8, FRA9, FRA11, FRA13, FRA15, FRA16, FRA19

🥤 Coca:
CC4, CC10

Bora trocar? 📲`;

describe('parseImport', () => {
  it('parses a full real list from another app via the common strategy', () => {
    const result = parseImport(SAMPLE, checklist);

    expect(result.strategy).toBe('common');
    expect(result.unrecognized).toEqual([]);
    // Spot-check codes from each section made it in.
    for (const code of ['FWC3', 'MEX2', 'RSA4', 'ENG20', 'FRA19', 'CC4']) {
      expect(result.codes).toContain(code);
    }
    // Album order: group A (MEX) before group I (FRA) before the specials (FWC) before Coca (CC).
    expect(result.codes.indexOf('MEX2')).toBeLessThan(result.codes.indexOf('FRA1'));
    expect(result.codes.indexOf('ENG20')).toBeLessThan(result.codes.indexOf('FWC3'));
    expect(result.codes.indexOf('FWC3')).toBeLessThan(result.codes.indexOf('CC4'));
    // Deduped count matches the unique codes listed in SAMPLE.
    expect(result.codes).toHaveLength(new Set(result.codes).size);
    expect(result.codes).toHaveLength(4 + 7 + 3 + 8 + 2 + 2 + 7 + 12 + 2);
  });

  it('reports known-team tokens outside this album as unrecognized, never as codes', () => {
    const result = parseImport('MEX2, MEX25, FWC20, CC15', checklist);

    expect(result.codes).toEqual(['MEX2']);
    expect(result.unrecognized).toEqual(['MEX25', 'FWC20', 'CC15']);
  });

  it('handles loose pasted lists, glued codes, FWC0 and standalone 00', () => {
    const result = parseImport('MEX 3, 6, 10\nCIV12\nFWC 1\nFWC0\n00', checklist);

    expect(result.codes).toEqual(['MEX3', 'MEX6', 'MEX10', 'CIV12', '00', 'FWC1']);
    expect(result.unrecognized).toEqual([]);
  });

  it('returns an empty common result for garbage or empty text', () => {
    expect(parseImport('', checklist)).toEqual({ codes: [], unrecognized: [], strategy: 'common' });
    expect(parseImport('oi, bora trocar? 2026', checklist)).toEqual({
      codes: [],
      unrecognized: [],
      strategy: 'common',
    });
  });

  it('picks the strategy with the highest detect score, breaking ties toward the common fallback', () => {
    const winner: ImportStrategy = {
      name: 'winner',
      detect: () => 1,
      parse: () => ({ codes: ['MEX1'], unrecognized: [], strategy: 'winner' }),
    };
    const loser: ImportStrategy = {
      name: 'loser',
      detect: () => 0,
      parse: () => ({ codes: ['BRA1'], unrecognized: [], strategy: 'loser' }),
    };

    // A confident strategy wins over the common fallback.
    expect(parseImport('whatever', checklist, [commonStrategy, winner]).strategy).toBe('winner');
    // A zero-confidence strategy loses to the common fallback (baseline > 0).
    expect(parseImport('MEX2', checklist, [loser, commonStrategy]).strategy).toBe('common');
  });
});

describe('commonStrategy and defaultStrategies', () => {
  it('ships only the common strategy, as a low-baseline fallback', () => {
    expect(defaultStrategies).toEqual([commonStrategy]);
    expect(commonStrategy.name).toBe('common');
    expect(commonStrategy.detect(SAMPLE)).toBeGreaterThan(0);
    expect(commonStrategy.detect(SAMPLE)).toBeLessThan(1);
  });
});
