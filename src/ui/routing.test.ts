import { describe, expect, it } from 'vitest';
import { hashFromScreen, nextHistoryStep, screenFromHash, sectionUrl } from './routing';

describe('screenFromHash', () => {
  it('maps each known slug to its screen', () => {
    expect(screenFromHash('#escanear')).toBe('scan');
    expect(screenFromHash('#colecao')).toBe('collection');
    expect(screenFromHash('#trocar')).toBe('trade');
    expect(screenFromHash('#ajustes')).toBe('settings');
    expect(screenFromHash('#repetidas')).toBe('repeats');
  });

  it('tolerates a missing leading #', () => {
    expect(screenFromHash('trocar')).toBe('trade');
  });

  it('falls back to scan for empty or unknown hashes', () => {
    expect(screenFromHash('')).toBe('scan');
    expect(screenFromHash('#')).toBe('scan');
    expect(screenFromHash('#report')).toBe('scan');
    expect(screenFromHash('#lixo')).toBe('scan');
  });
});

describe('hashFromScreen', () => {
  it('maps each screen to its slug', () => {
    expect(hashFromScreen('scan')).toBe('escanear');
    expect(hashFromScreen('collection')).toBe('colecao');
    expect(hashFromScreen('trade')).toBe('trocar');
    expect(hashFromScreen('settings')).toBe('ajustes');
    expect(hashFromScreen('repeats')).toBe('repetidas');
  });

  it('writes the escanear slug for the ephemeral report screen', () => {
    expect(hashFromScreen('report')).toBe('escanear');
  });

  it('writes the trocar slug for the ephemeral conferir-report screen', () => {
    expect(hashFromScreen('conferir-report')).toBe('trocar');
  });

  it('round-trips every routable screen', () => {
    for (const s of ['scan', 'collection', 'trade', 'settings', 'repeats'] as const) {
      expect(screenFromHash('#' + hashFromScreen(s))).toBe(s);
    }
  });
});

describe('sectionUrl', () => {
  it('keeps the path + query and sets the hash', () => {
    expect(sectionUrl({ pathname: '/busca-figurinha/', search: '' }, 'trade', false)).toBe(
      '/busca-figurinha/#trocar',
    );
  });

  it('preserves dev/query flags when not dropping the query', () => {
    expect(sectionUrl({ pathname: '/', search: '?debug' }, 'collection', false)).toBe(
      '/?debug#colecao',
    );
  });

  it('drops the query when a friend ?t= link was consumed', () => {
    expect(sectionUrl({ pathname: '/app/', search: '?t=ABC' }, 'trade', true)).toBe('/app/#trocar');
  });

  it('writes the escanear slug for the ephemeral report screen', () => {
    expect(sectionUrl({ pathname: '/', search: '' }, 'report', false)).toBe('/#escanear');
  });
});

describe('nextHistoryStep', () => {
  const loc = (hash: string, search = '') => ({ pathname: '/', search, hash });

  it('replaces (no phantom entry) on the first sync when the hash is not yet canonical', () => {
    expect(nextHistoryStep(loc(''), 'scan', false, true)).toEqual({
      action: 'replace',
      url: '/#escanear',
    });
  });

  it('does nothing when the URL already matches (e.g. a Back/Forward just synced it)', () => {
    expect(nextHistoryStep(loc('#trocar'), 'trade', false, false)).toEqual({
      action: 'none',
      url: '/#trocar',
    });
  });

  it('pushes on a later in-app navigation so Back returns to the previous section', () => {
    expect(nextHistoryStep(loc('#escanear'), 'trade', false, false)).toEqual({
      action: 'push',
      url: '/#trocar',
    });
  });

  it('replaces to strip a consumed ?t= friend link on the first sync without a phantom entry', () => {
    expect(nextHistoryStep(loc('#trocar', '?t=ABC'), 'trade', true, true)).toEqual({
      action: 'replace',
      url: '/#trocar',
    });
  });

  it('is a no-op once the friend query is already stripped', () => {
    expect(nextHistoryStep(loc('#trocar'), 'trade', true, false)).toEqual({
      action: 'none',
      url: '/#trocar',
    });
  });
});
