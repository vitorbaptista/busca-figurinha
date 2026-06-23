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

// A real "Repetidas" (duplicates) share from another World Cup 2026 album app. The twist vs the lists
// above: some codes carry an "(×N)" copy count — "MEX20 (×2)" means two spare copies. The header
// tallies "252 Repetidas", but that counts COPIES; collapsing the 41 extra copies gives 211 distinct
// codes, which is what this app loads (repeats are tracked per-code, not per-copy). Two things must
// hold for a correct load: (1) the "(×N)" digit must NEVER be read as a sticker number — "(×2)" must
// not inject a phantom "MEX2"; (2) "CC13" (Raúl Jiménez) must resolve, since this 14-sticker Coca-Cola
// album (the Brazil / Latin America edition) includes CC1..CC14.
const REPEATS_SAMPLE = `🏆 *Copa 2026* — *🔁 252 Repetidas*

🌟 Introdução:
FWC4, FWC9, FWC10, FWC11, FWC12, FWC13, FWC15

🇲🇽 México:
MEX5, MEX6, MEX9, MEX17, MEX19, MEX20 (×2)

🇿🇦 África do Sul:
RSA2, RSA3, RSA5 (×3), RSA11, RSA19

🇰🇷 Coreia do Sul:
KOR3, KOR7, KOR9, KOR10, KOR11, KOR14

🇨🇿 República Tcheca:
CZE11, CZE15 (×2)

🇨🇦 Canadá:
CAN6, CAN9, CAN10, CAN12, CAN16, CAN18, CAN20

🇶🇦 Catar:
QAT2, QAT6, QAT8, QAT9, QAT10, QAT11, QAT12, QAT13, QAT15 (×2), QAT16 (×2), QAT17

🇨🇭 Suíça:
SUI1, SUI2, SUI4, SUI5 (×3), SUI9, SUI12

🇧🇷 Brasil:
BRA4, BRA9, BRA12, BRA16 (×2), BRA17

🇲🇦 Marrocos:
MAR1, MAR3, MAR7, MAR9, MAR10, MAR11, MAR14

🇭🇹 Haiti:
HAI3, HAI10, HAI15, HAI17

🏴󠁧󠁢󠁳󠁣󠁴󠁿 Escócia:
SCO3, SCO4, SCO6, SCO8 (×2), SCO9 (×2), SCO12 (×2), SCO14, SCO16, SCO20

🇺🇸 Estados Unidos:
USA10, USA14 (×2)

🇵🇾 Paraguai:
PAR2, PAR6, PAR10, PAR14, PAR17

🇦🇺 Austrália:
AUS2

🇹🇷 Turquia:
TUR1, TUR2, TUR4

🇩🇪 Alemanha:
GER1, GER2, GER5 (×2), GER6, GER9, GER12, GER19 (×2)

🇨🇼 Curaçao:
CUW1, CUW2, CUW5, CUW9, CUW16, CUW19

🇨🇮 Costa do Marfim:
CIV1, CIV3, CIV7 (×3), CIV11, CIV12, CIV16, CIV17

🇪🇨 Equador:
ECU1 (×2), ECU2, ECU8, ECU12 (×2), ECU15 (×2), ECU16, ECU19 (×2), ECU20

🇳🇱 Holanda:
NED6, NED16, NED18

🇯🇵 Japão:
JPN1, JPN6, JPN15

🇸🇪 Suécia:
SWE1 (×2), SWE5

🇹🇳 Tunísia:
TUN1, TUN18, TUN20

🇧🇪 Bélgica:
BEL5, BEL12, BEL16, BEL18, BEL19 (×2)

🇪🇬 Egito:
EGY6, EGY7, EGY14

🇮🇷 Irã:
IRN3, IRN10, IRN15 (×3), IRN19

🇳🇿 Nova Zelândia:
NZL3, NZL7, NZL8, NZL16, NZL17, NZL20 (×2)

🇪🇸 Espanha:
ESP1, ESP4, ESP10, ESP16

🇨🇻 Cabo Verde:
CPV3, CPV6, CPV7 (×2), CPV10, CPV12

🇸🇦 Arábia Saudita:
KSA2, KSA7, KSA12, KSA14 (×2), KSA20

🇺🇾 Uruguai:
URU18

🇫🇷 França:
FRA6, FRA14

🇸🇳 Senegal:
SEN4, SEN5 (×3), SEN8 (×2), SEN9, SEN11 (×2), SEN16, SEN20 (×2)

🇮🇶 Iraque:
IRQ17

🇳🇴 Noruega:
NOR6 (×2), NOR7, NOR11 (×2)

🇦🇷 Argentina:
ARG11, ARG16

🇩🇿 Argélia:
ALG5, ALG7, ALG11 (×2), ALG16 (×2), ALG20

🇦🇹 Áustria:
AUT11 (×2), AUT15

🇯🇴 Jordânia:
JOR1, JOR7, JOR8, JOR9, JOR11 (×2), JOR12, JOR14, JOR17

🇵🇹 Portugal:
POR1, POR8, POR9, POR12, POR16, POR19 (×3)

🇺🇿 Uzbequistão:
UZB1

🇨🇴 Colômbia:
COL5

🏴󠁧󠁢󠁥󠁮󠁧󠁿 Inglaterra:
ENG1, ENG8, ENG11, ENG15

🇭🇷 Croácia:
CRO1, CRO4, CRO7, CRO8

🇬🇭 Gana:
GHA11, GHA16, GHA17, GHA18

🥤 Coca:
CC7, CC12, CC13


Bora trocar? 📲`;

describe('parseImport on a "Repetidas" list with (×N) copy markers', () => {
  it('loads the 211 unique codes, ignoring the (×N) copy counts', () => {
    const result = parseImport(REPEATS_SAMPLE, checklist);

    expect(result.strategy).toBe('common');
    // Nothing is skipped: every listed code is in this album — including CC13, which only exists in
    // the 14-sticker Coca-Cola edition (would be "unrecognized" against an album that stops at CC12).
    expect(result.unrecognized).toEqual([]);
    // 252 copies (the header tally) collapse to 211 distinct codes — what an import actually loads.
    expect(result.codes).toHaveLength(211);
    expect(result.codes).toHaveLength(new Set(result.codes).size); // deduped, no repeats

    // The bug this guards: the "(×N)" multiplier digit must NOT be read as a sticker number, so a
    // marker like "MEX20 (×2)" / "SUI5 (×3)" / "POR19 (×3)" must not inject a phantom "MEX2" / "SUI3"
    // / "POR3". (Digits that DO match a really-listed code, e.g. "QAT2"/"RSA3", are exempt by design.)
    for (const phantom of [
      'MEX2', 'CZE2', 'SUI3', 'BRA2', 'SCO2', 'USA2', 'SWE2', 'BEL2',
      'NZL2', 'CPV2', 'SEN2', 'SEN3', 'NOR2', 'ALG2', 'AUT2', 'JOR2', 'POR3',
    ]) {
      expect(result.codes).not.toContain(phantom);
    }

    // The multiplied codes themselves still load (once each), and CC13 resolves in the 14-CC album.
    for (const code of ['MEX20', 'RSA5', 'SUI5', 'POR19', 'SEN5', 'CC13']) {
      expect(result.codes).toContain(code);
    }

    // Album order is preserved: group teams (MEX) before the FWC specials before the Coca-Cola section.
    expect(result.codes.indexOf('MEX5')).toBeLessThan(result.codes.indexOf('FWC4'));
    expect(result.codes.indexOf('FWC4')).toBeLessThan(result.codes.indexOf('CC7'));
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
