import { describe, expect, it } from 'vitest';
import { commitLabel } from './ReportScreen';
import { pt } from '../../i18n/pt';

describe('commitLabel', () => {
  // The bug: a mixed batch's button only named the keepers, so it looked like the repetidas
  // wouldn't be saved unless you un-checked every new sticker. commit() always saves both.
  it('names both the keepers and the repeats when both are present', () => {
    const label = commitLabel(3, 5);
    expect(label).toContain('3');
    expect(label).toContain('5');
    expect(label).toMatch(/nova/);
    expect(label).toMatch(/repetida/);
  });

  it('pluralizes each count independently', () => {
    expect(commitLabel(1, 1)).toBe('Salvar 1 nova + 1 repetida');
    expect(commitLabel(1, 2)).toBe('Salvar 1 nova + 2 repetidas');
    expect(commitLabel(2, 1)).toBe('Salvar 2 novas + 1 repetida');
  });

  it('keeps the keepers-only label when there are no repeats', () => {
    expect(commitLabel(4, 0)).toBe('Adicionar 4 à coleção');
  });

  it('keeps the repeats-only label when nothing new was kept', () => {
    expect(commitLabel(0, 6)).toBe('Guardar 6 repetidas pra trocar');
  });

  it('falls back to the empty label when there is nothing to save', () => {
    expect(commitLabel(0, 0)).toBe('Adicionar à coleção');
  });
});

describe('skipRepeatsNote', () => {
  // The secondary "save only the new ones" button drops the scanned repetidas; the note has to
  // name how many spares that leaves un-saved, with the verb agreeing in number.
  it('agrees in number with the repeats count', () => {
    expect(pt.report.skipRepeatsNote(1)).toBe('A repetida não vai ser guardada pra trocar.');
    expect(pt.report.skipRepeatsNote(5)).toBe('As 5 repetidas não vão ser guardadas pra trocar.');
  });
});
