import { describe, expect, it } from 'vitest';
import { sanitizeName } from './name';

describe('sanitizeName', () => {
  it('trims surrounding whitespace', () => {
    expect(sanitizeName('  Léo  ')).toBe('Léo');
  });

  it('keeps accents and a normal name unchanged', () => {
    expect(sanitizeName('João Pedro')).toBe('João Pedro');
  });

  it('strips newlines, tabs and control chars (no layout break / injection)', () => {
    expect(sanitizeName('Lé\no\t Maria')).toBe('Léo Maria');
  });

  it('strips zero-width chars (ZWJ/ZWSP/BOM)', () => {
    expect(sanitizeName('Jo‍ã​o﻿')).toBe('João');
  });

  it('collapses internal whitespace runs to a single space', () => {
    expect(sanitizeName('Maria    das   Couves')).toBe('Maria das Couves');
  });

  it('clamps to 24 characters', () => {
    expect(sanitizeName('A'.repeat(40))).toBe('A'.repeat(24));
  });

  it('returns an empty string for blank or all-stripped input', () => {
    expect(sanitizeName('   ')).toBe('');
    expect(sanitizeName('​‍')).toBe('');
    expect(sanitizeName(undefined)).toBe('');
  });
});
