import { describe, expect, it } from 'vitest';
import { groupByAlbum } from './TradeScreen';

describe('groupByAlbum', () => {
  it('returns only groups with missing entries, in album order', () => {
    // MEX is Grupo A, BRA is Grupo C → A comes before C in the album.
    const groups = groupByAlbum(['BRA5', 'MEX3', 'BRA9']);
    expect(groups.map((g) => g.label)).toEqual(['Grupo A', 'Grupo C']);
    expect(groups[0].entries.map((e) => e.code)).toEqual(['MEX3']);
    // entries stay in album (number) order within the group
    expect(groups[1].entries.map((e) => e.code)).toEqual(['BRA5', 'BRA9']);
  });

  it('merges the four teams of a World Cup group under one label; count = missing stickers', () => {
    // Grupo A = MEX, RSA, KOR, CZE — one code from each.
    const groups = groupByAlbum(['MEX1', 'RSA2', 'KOR3', 'CZE4']);
    expect(groups).toHaveLength(1);
    expect(groups[0].label).toBe('Grupo A');
    expect(groups[0].entries).toHaveLength(4); // "faltam 4"
  });

  it('labels special sections by their own name, not a Grupo', () => {
    const groups = groupByAlbum(['FWC3']);
    expect(groups).toHaveLength(1);
    expect(groups[0].label).not.toMatch(/^Grupo/);
  });
});
