import { describe, expect, it } from 'vitest';
import { checklist } from '../data/checklist';
import {
  commonStrategy,
  defaultStrategies,
  importPreview,
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

// A real receiver-flow share ("O amigo pode ajudar …"): spaced codes, each section header on its
// own line, and a "Saldo da troca" footer whose tallies (65/69) must NOT be read as sticker numbers.
const RECEIVER_SAMPLE = `🎁 O amigo pode ajudar o Antônio com 69 figurinhas

🌟 Especiais

⭐ FWC 8, 14

🇲🇽 México

MEX 13, 14

🇨🇿 República Tcheca

CZE 4, 13, 14, 16, 17, 19, 20

🇧🇦 Bósnia e Herzegovina

BIH 3, 4, 5, 6, 9, 13, 15, 19, 20

🇨🇭 Suíça

SUI 20

🇲🇦 Marrocos

MAR 4, 19

🏴 Escócia

SCO 19

🇺🇸 Estados Unidos

USA 16, 19

🇦🇺 Austrália

AUS 18

🇩🇪 Alemanha

GER 4, 17, 18

🇨🇼 Curaçao

CUW 3

🇨🇮 Costa do Marfim

CIV 4, 13

🇳🇱 Holanda

NED 14

🇯🇵 Japão

JPN 4, 10

🇸🇪 Suécia

SWE 9, 10, 12, 14

🇪🇬 Egito

EGY 3

🇮🇷 Irã

IRN 2, 9, 11, 13, 14, 16, 18

🇳🇿 Nova Zelândia

NZL 6

🇪🇸 Espanha

ESP 19

🇸🇦 Arábia Saudita

KSA 18

🇫🇷 França

FRA 13, 16, 19

🇮🇶 Iraque

IRQ 20

🇳🇴 Noruega

NOR 8, 9, 13, 14, 18

🇦🇷 Argentina

ARG 4

🇩🇿 Argélia

ALG 4, 18

🇦🇹 Áustria

AUT 2

🇵🇹 Portugal

POR 14

🏴 Inglaterra

ENG 13, 17, 18, 20

🇬🇭 Gana

GHA 10, 20

🇵🇦 Panamá

PAN 7, 9

📊 Saldo da troca:

* Antônio entrega: 65 figurinhas
* Antônio recebe: 69 figurinhas`;

describe('parseImport on real lists from other apps', () => {
  it('loads a receiver-flow list and ignores the trade-balance footer numbers', () => {
    const result = parseImport(RECEIVER_SAMPLE, checklist);

    expect(result.strategy).toBe('common');
    expect(result.unrecognized).toEqual([]);
    // Exactly the codes listed, in album order (teams A→L, then the FWC specials) — the footer
    // tallies "65"/"69" and the header "69" are never preceded by a team, so they don't leak in.
    expect(result.codes).toEqual([
      'MEX13', 'MEX14',
      'CZE4', 'CZE13', 'CZE14', 'CZE16', 'CZE17', 'CZE19', 'CZE20',
      'BIH3', 'BIH4', 'BIH5', 'BIH6', 'BIH9', 'BIH13', 'BIH15', 'BIH19', 'BIH20',
      'SUI20',
      'MAR4', 'MAR19',
      'SCO19',
      'USA16', 'USA19',
      'AUS18',
      'GER4', 'GER17', 'GER18',
      'CUW3',
      'CIV4', 'CIV13',
      'NED14',
      'JPN4', 'JPN10',
      'SWE9', 'SWE10', 'SWE12', 'SWE14',
      'EGY3',
      'IRN2', 'IRN9', 'IRN11', 'IRN13', 'IRN14', 'IRN16', 'IRN18',
      'NZL6',
      'ESP19',
      'KSA18',
      'FRA13', 'FRA16', 'FRA19',
      'IRQ20',
      'NOR8', 'NOR9', 'NOR13', 'NOR14', 'NOR18',
      'ARG4',
      'ALG4', 'ALG18',
      'AUT2',
      'POR14',
      'ENG13', 'ENG17', 'ENG18', 'ENG20',
      'GHA10', 'GHA20',
      'PAN7', 'PAN9',
      'FWC8', 'FWC14',
    ]);
  });
});

describe('importPreview', () => {
  it('splits recognized codes into new (to add) vs already present', () => {
    const p = importPreview(['MEX3', 'MEX4', 'BRA7'], new Set(['MEX4']));
    expect(p.newCodes).toEqual(['MEX3', 'BRA7']);
    expect(p.alreadyHad).toBe(1);
  });

  it('is all-new against an empty set', () => {
    expect(importPreview(['MEX3', 'BRA7'], new Set())).toEqual({
      newCodes: ['MEX3', 'BRA7'],
      alreadyHad: 0,
    });
  });

  it('adds nothing when every recognized code is already present', () => {
    expect(importPreview(['MEX3'], new Set(['MEX3']))).toEqual({ newCodes: [], alreadyHad: 1 });
  });
});
