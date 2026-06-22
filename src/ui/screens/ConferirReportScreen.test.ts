// src/ui/screens/ConferirReportScreen.test.ts
import { describe, expect, it } from 'vitest';
import { pt } from '../../i18n/pt';

// The finish step reuses the review modal's pluralized save label; assert the new strings exist
// and the save label agrees in number (the cardinal idiom: never overstate what was saved).
describe('conferir finish-step strings', () => {
  it('has the finish-step labels', () => {
    expect(pt.conferir.finishTitle).toBe('Terminar a troca');
    expect(pt.conferir.takenEmpty.length).toBeGreaterThan(0);
  });

  it('pluralizes the save label by count', () => {
    expect(pt.conferir.reviewSave(0)).toBe('Salvar na coleção');
    expect(pt.conferir.reviewSave(1)).toBe('Salvar 1 na coleção');
    expect(pt.conferir.reviewSave(3)).toBe('Salvar 3 na coleção');
  });
});
