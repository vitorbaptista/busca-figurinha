import { describe, expect, it } from 'vitest';
import type { Checklist, ChecklistEntry } from '../types';
import { checklist } from '../data/checklist';
import { bestMatchFromText, extractCodes, matchAllFromText, matchCode } from './matching';

/** Build a tiny synthetic checklist from canonical codes for focused tests. */
function makeChecklist(codes: string[]): Checklist {
  const entries: ChecklistEntry[] = codes.map((code) => {
    const m = /^([A-Z]*)(\d+)$/.exec(code)!;
    return {
      code,
      display: m[1] ? `${m[1]} ${m[2]}` : code,
      teamCode: m[1] || 'FWC',
      teamName: m[1] || 'Especiais',
      number: parseInt(m[2], 10),
      type: 'player',
    };
  });
  return {
    entries,
    byCode: new Map(entries.map((e) => [e.code, e])),
    teams: [],
    total: entries.length,
  };
}

describe('extractCodes', () => {
  it('pulls a code out of noisy album text', () => {
    expect(extractCodes('FIFA WORLD CUP 2026 CIV 12')).toContain('CIV12');
  });

  it('handles codes with no space', () => {
    expect(extractCodes('panini EGY4 ©2026')).toContain('EGY4');
  });

  it('is case-insensitive and normalizes', () => {
    expect(extractCodes('civ 12')).toEqual(['CIV12']);
  });

  it('dedupes while preserving first-seen order', () => {
    expect(extractCodes('CIV 12 noise CIV12 more EGY4')).toEqual(['CIV12', 'EGY4']);
  });

  it('finds the standalone "00" logo but ignores stray single zeros', () => {
    expect(extractCodes('panini 00 logo')).toContain('00');
    // A lone "0" is OCR noise (a date, a jersey number), not the logo sticker.
    expect(extractCodes('only a 0 here')).toEqual([]);
  });

  it('does not absorb trailing letters of adjacent words into decoy codes', () => {
    // Regression: a greedy regex turned "WORLD CUP 2026" into "CUP202" and
    // "panini 00" into "NINI00", which could mis-correct to a real code.
    expect(extractCodes('FIFA WORLD CUP 2026')).not.toContain('CUP202');
    expect(extractCodes('panini 00 logo')).not.toContain('NINI00');
  });

  it('returns empty for text with no codes', () => {
    expect(extractCodes('just some words')).toEqual([]);
  });

  it('extracts the real codes from multi-line OCR (noise tokens allowed)', () => {
    const text = 'FIFA WORLD CUP 2026\nCIV 12\nMade in Italy\nFWC 1';
    const codes = extractCodes(text);
    // Surrounding text like "CUP 2026" can yield junk tokens; that's fine — the
    // real codes must be present and the noise gets dropped at match time.
    expect(codes).toContain('CIV12');
    expect(codes).toContain('FWC1');
  });

  it('extracts cleanly from text with no decoy numbers', () => {
    expect(extractCodes('back of sticker\nCIV 12\nFWC 1')).toEqual(['CIV12', 'FWC1']);
  });
});

describe('matchCode', () => {
  const list = makeChecklist(['CIV12', 'EGY4', 'FWC1', '00']);

  it('returns an exact match', () => {
    const r = matchCode('CIV12', list);
    expect(r.status).toBe('exact');
    expect(r.distance).toBe(0);
    expect(r.entry?.code).toBe('CIV12');
    expect(r.raw).toBe('CIV12');
  });

  it('corrects a one-edit OCR slip', () => {
    const r = matchCode('C1V12', list);
    expect(r.status).toBe('corrected');
    expect(r.distance).toBe(1);
    expect(r.entry?.code).toBe('CIV12');
  });

  it('corrects a letter-for-digit confusion within distance', () => {
    const r = matchCode('EGYA', list); // 'A' read instead of '4'
    expect(r.status).toBe('corrected');
    expect(r.entry?.code).toBe('EGY4');
    expect(r.distance).toBe(1);
  });

  it('returns unknown when nothing is close enough', () => {
    const r = matchCode('ZZZ99', list);
    expect(r.status).toBe('unknown');
    expect(r.entry).toBeNull();
    expect(r.distance).toBe(-1);
    expect(r.raw).toBe('ZZZ99');
  });

  it('respects a custom maxDistance', () => {
    expect(matchCode('CXX12', list, 1).status).toBe('unknown'); // 2 edits from CIV12
    expect(matchCode('CXX12', list, 2).status).toBe('corrected');
  });

  it('prefers an equal-length candidate on a distance tie', () => {
    // "FWC11" is distance 1 from "FWC1" (insertion) and distance 1 from "FWC11"
    // when that exists; build a list where two candidates tie.
    const tie = makeChecklist(['FWC1', 'FWC11']);
    // "FWC12" -> distance 1 to "FWC11" (same length) and distance 2 to "FWC1".
    const r = matchCode('FWC12', tie, 1);
    expect(r.entry?.code).toBe('FWC11');
  });

  it('only corrects to a UNIQUE near code; rejects ambiguous or short reads', () => {
    // Unique single substitution is fixed (only CIV12 is one edit from GIV12).
    expect(matchCode('GIV12', checklist).entry?.code).toBe('CIV12');
    // "CV12" is one edit from BOTH CIV12 and CPV12 — ambiguous, so don't guess.
    expect(matchCode('CV12', checklist).status).toBe('unknown');
    // "EGYA" is one edit from EGY1..EGY9 — ambiguous.
    expect(matchCode('EGYA', checklist).status).toBe('unknown');
    // "SE3" (3 chars) is too short to correct safely.
    expect(matchCode('SE3', checklist).status).toBe('unknown');
  });

  it('works against the real baked-in checklist', () => {
    expect(matchCode('CIV12', checklist).status).toBe('exact');
    expect(matchCode('00', checklist).status).toBe('exact');
    // A unique single substitution corrects (only CIV12 is one edit from GIV12).
    expect(matchCode('GIV12', checklist).entry?.code).toBe('CIV12');
    // Near-collisions make many 1-edit reads ambiguous → unknown (never a wrong guess).
    expect(matchCode('C1V12', checklist).status).toBe('unknown');
  });
});

describe('bestMatchFromText', () => {
  it('returns null when there are no codes', () => {
    expect(bestMatchFromText('no codes here', checklist)).toBeNull();
  });

  it('prefers an exact hit over other candidates', () => {
    const r = bestMatchFromText('garbage CIV12 EGY4', checklist);
    expect(r?.status).toBe('exact');
    expect(r?.entry?.code).toBe('CIV12');
  });

  it('falls back to the closest correction', () => {
    const list = makeChecklist(['CIV12']);
    // 'CIW12' keeps a 3-letter prefix so extractCodes finds it, then matchCode
    // corrects the W->V slip (one edit).
    const r = bestMatchFromText('noise CIW12 more', list);
    expect(r?.status).toBe('corrected');
    expect(r?.entry?.code).toBe('CIV12');
  });

  it('returns unknown for the first token when nothing matches', () => {
    const list = makeChecklist(['CIV12']);
    const r = bestMatchFromText('ZZZ99 then WWW88', list);
    expect(r?.status).toBe('unknown');
    expect(r?.raw).toBe('ZZZ99');
  });

  it('reads a real multi-line sticker back', () => {
    const text = 'FIFA WORLD CUP 2026\nCIV 12\n© Panini';
    const r = bestMatchFromText(text, checklist);
    expect(r?.entry?.code).toBe('CIV12');
  });
});

describe('matchAllFromText', () => {
  it('resolves every distinct sticker when several are in view', () => {
    const text = 'FIFA WORLD CUP 2026 CIV 12\nEGY 4\nBRA 5\nFWC 1';
    const results = matchAllFromText(text, checklist);
    const codes = results.map((r) => r.entry?.code);
    expect(codes).toEqual(['CIV12', 'EGY4', 'BRA5', 'FWC1']);
    expect(results.every((r) => r.entry !== null)).toBe(true);
  });

  it('dedupes repeated codes and drops unmatched noise', () => {
    const text = 'CIV12 CIV 12 ZZZ99 EGY4';
    const codes = matchAllFromText(text, checklist).map((r) => r.entry?.code);
    expect(codes).toEqual(['CIV12', 'EGY4']);
  });

  it('returns an empty list when nothing matches', () => {
    expect(matchAllFromText('just some words', checklist)).toEqual([]);
  });

  it('corrects OCR slips on individual codes in a group', () => {
    const text = 'GIV12 EGY4'; // "GIV12" is a one-edit slip of CIV12
    const codes = matchAllFromText(text, checklist).map((r) => r.entry?.code);
    expect(codes).toContain('CIV12');
    expect(codes).toContain('EGY4');
  });
});
