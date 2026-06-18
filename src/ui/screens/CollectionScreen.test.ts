import { describe, expect, it } from 'vitest';
import { checklist } from '../../data/checklist';
import { filterTeams } from './CollectionScreen';

function teamCodes(query: string): string[] {
  return filterTeams(checklist.teams, query).map((team) => team.teamCode);
}

describe('filterTeams', () => {
  it('matches team names without requiring accents', () => {
    expect(teamCodes('argelia')).toEqual(['ALG']);
    expect(teamCodes('austria')).toEqual(['AUT']);
    expect(teamCodes('curacao')).toEqual(['CUW']);
    expect(teamCodes('paises baixos')).toEqual(['NED']);
  });

  it('matches team and sticker codes', () => {
    expect(teamCodes('civ')).toEqual(['CIV']);
    expect(teamCodes('civ 12')).toEqual(['CIV']);
    expect(teamCodes('fwc1')).toEqual(['FWC']);
    expect(teamCodes('00')).toEqual(['FWC']);
  });
});
