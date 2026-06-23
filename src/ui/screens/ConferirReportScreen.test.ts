// src/ui/screens/ConferirReportScreen.test.ts
import { describe, expect, it } from 'vitest';
import { pt } from '../../i18n/pt';

// The finish step is now a trade "pedido": a QR (your trade link) + a single confirm list + save.
// Assert the new strings exist and the count idioms agree in number (the cardinal idiom: never
// overstate what was picked/saved).
describe('conferir finish-step (pedido) strings', () => {
  it('has the finish-step labels', () => {
    expect(pt.conferir.finishTitle).toBe('Terminar a troca');
    expect(pt.conferir.takenEmpty.length).toBeGreaterThan(0);
    expect(pt.conferir.reqSave.length).toBeGreaterThan(0);
    expect(pt.conferir.reqConfirmTitle.length).toBeGreaterThan(0);
    expect(pt.conferir.reqQrAria.length).toBeGreaterThan(0);
  });

  it('pluralizes the pedido count by number', () => {
    expect(pt.conferir.reqCount(1)).toBe('1 figurinha no pedido');
    expect(pt.conferir.reqCount(3)).toBe('3 figurinhas no pedido');
  });
});

// "Importar a lista do amigo" — one input, feeds the pile. Assert the load/loaded labels agree in number.
describe('friend import strings', () => {
  it('labels and pluralizes the load + loaded counts', () => {
    expect(pt.friendImport.title).toBe('Importar a lista do amigo');
    expect(pt.friendImport.loadCount(1)).toBe('Carregar 1 figurinha');
    expect(pt.friendImport.loadCount(5)).toBe('Carregar 5 figurinhas');
    expect(pt.friendImport.loaded(1)).toBe('1 figurinha carregada da lista');
    expect(pt.friendImport.loaded(2)).toBe('2 figurinhas carregadas da lista');
  });
});
