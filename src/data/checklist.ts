import type { Checklist, ChecklistEntry, StickerType, TeamGroup } from '../types';

// Official Panini FIFA World Cup 2026 album: 48 teams × 20 stickers + 20 special "FWC"
// stickers = 980, plus 12 Coca-Cola exclusive "CC" stickers = 992 total. Codes are FIFA
// 3-letter team abbreviations + number,
// matching the codes printed on the back of each sticker (e.g. "CIV 12", "EGY 4").
// Cross-verified across the official Panini pack-contents page and three secondary
// checklists. Team names are Portuguese (Brazil edition). Edit here to correct data.

interface RawTeam {
  code: string;
  name: string;
  count: number;
}

// Alphabetical by FIFA code internally; sorted by Portuguese name for display below.
const RAW_TEAMS: RawTeam[] = [
  { code: 'ALG', name: 'Argélia', count: 20 },
  { code: 'ARG', name: 'Argentina', count: 20 },
  { code: 'AUS', name: 'Austrália', count: 20 },
  { code: 'AUT', name: 'Áustria', count: 20 },
  { code: 'BEL', name: 'Bélgica', count: 20 },
  { code: 'BIH', name: 'Bósnia e Herzegovina', count: 20 },
  { code: 'BRA', name: 'Brasil', count: 20 },
  { code: 'CAN', name: 'Canadá', count: 20 },
  { code: 'CPV', name: 'Cabo Verde', count: 20 },
  { code: 'COL', name: 'Colômbia', count: 20 },
  { code: 'COD', name: 'Congo (RD)', count: 20 },
  { code: 'CRO', name: 'Croácia', count: 20 },
  { code: 'CUW', name: 'Curaçao', count: 20 },
  { code: 'CZE', name: 'Tchéquia', count: 20 },
  { code: 'ECU', name: 'Equador', count: 20 },
  { code: 'EGY', name: 'Egito', count: 20 },
  { code: 'ENG', name: 'Inglaterra', count: 20 },
  { code: 'FRA', name: 'França', count: 20 },
  { code: 'GER', name: 'Alemanha', count: 20 },
  { code: 'GHA', name: 'Gana', count: 20 },
  { code: 'HAI', name: 'Haiti', count: 20 },
  { code: 'IRN', name: 'Irã', count: 20 },
  { code: 'IRQ', name: 'Iraque', count: 20 },
  { code: 'CIV', name: 'Costa do Marfim', count: 20 },
  { code: 'JPN', name: 'Japão', count: 20 },
  { code: 'JOR', name: 'Jordânia', count: 20 },
  { code: 'MEX', name: 'México', count: 20 },
  { code: 'MAR', name: 'Marrocos', count: 20 },
  { code: 'NED', name: 'Países Baixos', count: 20 },
  { code: 'NZL', name: 'Nova Zelândia', count: 20 },
  { code: 'NOR', name: 'Noruega', count: 20 },
  { code: 'PAN', name: 'Panamá', count: 20 },
  { code: 'PAR', name: 'Paraguai', count: 20 },
  { code: 'POR', name: 'Portugal', count: 20 },
  { code: 'QAT', name: 'Catar', count: 20 },
  { code: 'KSA', name: 'Arábia Saudita', count: 20 },
  { code: 'SCO', name: 'Escócia', count: 20 },
  { code: 'SEN', name: 'Senegal', count: 20 },
  { code: 'RSA', name: 'África do Sul', count: 20 },
  { code: 'KOR', name: 'Coreia do Sul', count: 20 },
  { code: 'ESP', name: 'Espanha', count: 20 },
  { code: 'SWE', name: 'Suécia', count: 20 },
  { code: 'SUI', name: 'Suíça', count: 20 },
  { code: 'TUN', name: 'Tunísia', count: 20 },
  { code: 'TUR', name: 'Turquia', count: 20 },
  { code: 'URU', name: 'Uruguai', count: 20 },
  { code: 'USA', name: 'Estados Unidos', count: 20 },
  { code: 'UZB', name: 'Uzbequistão', count: 20 },
];

// Album order: teams are laid out by 2026 World Cup GROUP (A→L), and within each group in the
// official position order, matching how the Panini album prints them (NOT alphabetically).
// Source: the official final draw (cross-checked against ge.globo.com's group tables/simulator).
const ALBUM_GROUPS: { group: string; codes: string[] }[] = [
  { group: 'A', codes: ['MEX', 'RSA', 'KOR', 'CZE'] },
  { group: 'B', codes: ['CAN', 'BIH', 'QAT', 'SUI'] },
  { group: 'C', codes: ['BRA', 'MAR', 'HAI', 'SCO'] },
  { group: 'D', codes: ['USA', 'PAR', 'AUS', 'TUR'] },
  { group: 'E', codes: ['GER', 'CUW', 'CIV', 'ECU'] },
  { group: 'F', codes: ['NED', 'JPN', 'SWE', 'TUN'] },
  { group: 'G', codes: ['BEL', 'EGY', 'IRN', 'NZL'] },
  { group: 'H', codes: ['ESP', 'CPV', 'KSA', 'URU'] },
  { group: 'I', codes: ['FRA', 'SEN', 'IRQ', 'NOR'] },
  { group: 'J', codes: ['ARG', 'ALG', 'AUT', 'JOR'] },
  { group: 'K', codes: ['POR', 'COD', 'UZB', 'COL'] },
  { group: 'L', codes: ['ENG', 'CRO', 'GHA', 'PAN'] },
];

// Special section: Panini logo "00" + FWC1..FWC19 (opening + FIFA World Cup history foils).
const SPECIAL_NAME = 'Especiais';
const SPECIAL_CODE = 'FWC';

// Coca-Cola exclusive section: CC1..CC12. These are NOT in the regular packs — they only come
// behind the peel-back label of specially marked Coca-Cola bottles, and the album has a dedicated
// Coca-Cola page for them, so they count toward completing the album.
// Players (CC1..CC12): Lamine Yamal, Joshua Kimmich, Harry Kane, Santiago Giménez, Antonee Robinson,
// Jefferson Lerma, Edson Álvarez, Virgil van Dijk, Alphonso Davies, Weston McKennie,
// Lautaro Martínez, Gabriel Magalhães.
const COKE_NAME = 'Coca-Cola';
const COKE_CODE = 'CC';
const COKE_COUNT = 12;

function teamEntries(team: RawTeam): ChecklistEntry[] {
  const entries: ChecklistEntry[] = [];
  for (let n = 1; n <= team.count; n++) {
    const type: StickerType = n === 1 ? 'team' : 'player';
    entries.push({
      code: `${team.code}${n}`,
      display: `${team.code} ${n}`,
      teamCode: team.code,
      teamName: team.name,
      number: n,
      type,
    });
  }
  return entries;
}

function specialEntries(): ChecklistEntry[] {
  const entries: ChecklistEntry[] = [
    { code: '00', display: '00', teamCode: SPECIAL_CODE, teamName: SPECIAL_NAME, number: 0, type: 'special' },
  ];
  for (let n = 1; n <= 19; n++) {
    entries.push({
      code: `${SPECIAL_CODE}${n}`,
      display: `${SPECIAL_CODE} ${n}`,
      teamCode: SPECIAL_CODE,
      teamName: SPECIAL_NAME,
      number: n,
      type: 'special',
    });
  }
  return entries;
}

function cocaColaEntries(): ChecklistEntry[] {
  const entries: ChecklistEntry[] = [];
  for (let n = 1; n <= COKE_COUNT; n++) {
    entries.push({
      code: `${COKE_CODE}${n}`,
      display: `${COKE_CODE} ${n}`,
      teamCode: COKE_CODE,
      teamName: COKE_NAME,
      number: n,
      type: 'special',
    });
  }
  return entries;
}

function build(): Checklist {
  const byTeamCode = new Map(RAW_TEAMS.map((t) => [t.code, t] as const));

  // Teams in ALBUM order: group A→L, each group in its printed position order.
  const teamGroups: TeamGroup[] = [];
  for (const { group, codes } of ALBUM_GROUPS) {
    for (const code of codes) {
      const t = byTeamCode.get(code);
      if (!t) continue; // data guard — an unknown code is skipped, not crashed
      teamGroups.push({ teamCode: t.code, teamName: t.name, entries: teamEntries(t), group });
    }
  }
  // Safety net: any team missing from ALBUM_GROUPS still appears (alphabetically) so the
  // checklist can never silently drop a team if the group data and RAW_TEAMS drift apart.
  const placed = new Set(teamGroups.map((g) => g.teamCode));
  RAW_TEAMS.filter((t) => !placed.has(t.code))
    .sort((a, b) => a.name.localeCompare(b.name, 'pt'))
    .forEach((t) =>
      teamGroups.push({ teamCode: t.code, teamName: t.name, entries: teamEntries(t) }),
    );

  const specials: TeamGroup = {
    teamCode: SPECIAL_CODE,
    teamName: SPECIAL_NAME,
    entries: specialEntries(),
  };

  const cocaCola: TeamGroup = {
    teamCode: COKE_CODE,
    teamName: COKE_NAME,
    entries: cocaColaEntries(),
  };

  // Teams in album/group order, specials then the Coca-Cola section last.
  const teams: TeamGroup[] = [...teamGroups, specials, cocaCola];

  const entries = teams.flatMap((g) => g.entries);
  const byCode = new Map(entries.map((e) => [e.code, e]));

  return { entries, byCode, teams, total: entries.length };
}

export const checklist: Checklist = build();
