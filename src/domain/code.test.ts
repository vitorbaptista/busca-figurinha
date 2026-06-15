import { describe, expect, it } from 'vitest';
import { levenshtein, normalizeCode, parseCode, toDisplay } from './code';

describe('normalizeCode', () => {
  it('uppercases and strips non-alphanumerics', () => {
    expect(normalizeCode('civ 12')).toBe('CIV12');
    expect(normalizeCode('c1v-12')).toBe('C1V12');
    expect(normalizeCode('  fwc_1  ')).toBe('FWC1');
    expect(normalizeCode('00')).toBe('00');
  });

  it('returns empty string for pure junk', () => {
    expect(normalizeCode('--- .')).toBe('');
  });
});

describe('toDisplay', () => {
  it('inserts a space between letters and digits', () => {
    expect(toDisplay('CIV12')).toBe('CIV 12');
    expect(toDisplay('FWC1')).toBe('FWC 1');
  });

  it('leaves all-digit or all-letter codes unchanged', () => {
    expect(toDisplay('00')).toBe('00');
    expect(toDisplay('FWC')).toBe('FWC');
  });

  it('leaves mixed/irregular codes unchanged', () => {
    expect(toDisplay('C1V12')).toBe('C1V12');
  });
});

describe('parseCode', () => {
  it('splits a letter prefix and trailing number', () => {
    expect(parseCode('CIV12')).toEqual({ teamCode: 'CIV', number: 12, canonical: 'CIV12' });
    expect(parseCode('civ 12')).toEqual({ teamCode: 'CIV', number: 12, canonical: 'CIV12' });
    expect(parseCode('FWC1')).toEqual({ teamCode: 'FWC', number: 1, canonical: 'FWC1' });
  });

  it('handles the pure-number logo sticker', () => {
    expect(parseCode('00')).toEqual({ teamCode: '', number: 0, canonical: '00' });
  });

  it('returns null when there are no trailing digits', () => {
    expect(parseCode('CIV')).toBeNull();
    expect(parseCode('')).toBeNull();
    expect(parseCode('AB12C')).toBeNull();
  });
});

describe('levenshtein', () => {
  it('is zero for identical strings', () => {
    expect(levenshtein('CIV12', 'CIV12')).toBe(0);
  });

  it('counts single edits', () => {
    expect(levenshtein('C1V12', 'CIV12')).toBe(1); // substitution
    expect(levenshtein('CIV2', 'CIV12')).toBe(1); // insertion
    expect(levenshtein('CIV123', 'CIV12')).toBe(1); // deletion
  });

  it('handles empty strings', () => {
    expect(levenshtein('', '')).toBe(0);
    expect(levenshtein('', 'ABC')).toBe(3);
    expect(levenshtein('ABC', '')).toBe(3);
  });

  it('is symmetric', () => {
    expect(levenshtein('EGYA', 'EGY4')).toBe(levenshtein('EGY4', 'EGYA'));
  });

  it('counts multiple edits', () => {
    expect(levenshtein('ZZZ99', 'CIV12')).toBe(5);
  });
});
