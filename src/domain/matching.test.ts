import { describe, expect, it } from 'vitest';
import type { Checklist, ChecklistEntry } from '../types';
import { checklist } from '../data/checklist';
import {
  bestHighConfidenceConfusionMatchFromText,
  bestHighConfidenceExactAliasMatchFromText,
  bestMatchFromText,
  extractCodes,
  matchAllFromText,
  matchCode,
  matchLines,
} from './matching';

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

  it('auto-corrects ONLY the safe 0<->O confusion, never a blind letter substitution', () => {
    // 0<->O is the one same-length confusion safe to auto-correct (a digit/letter twin).
    const oList = makeChecklist(['POR10', 'CIV12']);
    expect(matchCode('P0R10', oList).entry?.code).toBe('POR10'); // zero read for the letter O
    // A blind single-letter substitution is NOT auto-corrected: it would manufacture a
    // DIFFERENT real code from a garbled read (the false positive a trading app must avoid).
    // Systematic letter confusions go through bestHighConfidenceConfusionMatchFromText instead.
    expect(matchCode('C1V12', list).status).toBe('unknown'); // '1'->'I' is not a safe blind edit
    expect(matchCode('GIV12', list).status).toBe('unknown'); // 'G'->'C' is not a safe blind edit
    expect(matchCode('EGYA', list).status).toBe('unknown'); // 'A'->'4' letter-for-digit, not safe
  });

  it('returns unknown when nothing is close enough', () => {
    const r = matchCode('ZZZ99', list);
    expect(r.status).toBe('unknown');
    expect(r.entry).toBeNull();
    expect(r.distance).toBe(-1);
    expect(r.raw).toBe('ZZZ99');
  });

  it('never blind-corrects a two-edit read', () => {
    expect(matchCode('CXX12', list, 1).status).toBe('unknown'); // 2 edits from CIV12
    expect(matchCode('CXX12', list, 2).status).toBe('unknown'); // still not a safe/curated edit
  });

  it('does not invent a code from a blind same-length substitution', () => {
    // "FWC12" is one blind digit substitution from FWC11 — NOT auto-corrected (would be a
    // wrong number, the worst kind of false positive). A miss is the safe outcome.
    const tie = makeChecklist(['FWC1', 'FWC11']);
    expect(matchCode('FWC12', tie).status).toBe('unknown');
  });

  it('rejects ambiguous, blind-substitution, and too-short reads', () => {
    // A blind letter substitution is never auto-corrected (GIV12 stays unknown — "G"->"C"
    // is not a safe blind edit), so a garbled read can't snap to a different real code.
    expect(matchCode('GIV12', checklist).status).toBe('unknown');
    // "EGYA" is one edit from EGY1..EGY9 — ambiguous and not a safe edit anyway.
    expect(matchCode('EGYA', checklist).status).toBe('unknown');
    // "SE3" (3 chars) is too short to correct safely.
    expect(matchCode('SE3', checklist).status).toBe('unknown');
  });

  it('restores a dropped THIN letter, but only when it is unambiguous', () => {
    // The OCR font reliably drops the thin "I": "CIV 12" reads as "CV 12". Because
    // the engine never drops a bold letter, the missing char can only be the thin
    // "I" — so "CV12" restores to CIV12 even though CPV12 also exists (reaching it
    // would require dropping a bold "P", which never happens).
    const thinOnly = makeChecklist(['CIV12', 'CPV12']);
    expect(matchCode('CV12', thinOnly).entry?.code).toBe('CIV12');
    // NOTE: against the real baked-in checklist, "CV12" is now ambiguous — the
    // Coca-Cola sticker "CC12" is a single substitution away (V→C), tying with the
    // thin-letter restore to CIV12 — so the real list returns unknown (never guesses).
    expect(matchCode('CV12', checklist).status).toBe('unknown');
    // A garbled-but-PRESENT middle char stays ambiguous: "C1V12" could be CIV12 or
    // CPV12 (we can't tell an "I" from a "P" in that slot).
    expect(matchCode('C1V12', checklist).status).toBe('unknown');
    // A missing BOLD letter is never restored (would be a wrong guess): "CPV12"
    // read as "CV12" is indistinguishable from CIV12, so we must not invent a "P".
    // (Implicit: only thin letters I/J/L/T are ever inserted.)
    const onlyBold = makeChecklist(['CPV12']);
    expect(matchCode('CV12', onlyBold).status).toBe('unknown');
  });

  it('works against the real baked-in checklist', () => {
    expect(matchCode('CIV12', checklist).status).toBe('exact');
    expect(matchCode('00', checklist).status).toBe('exact');
    // Thin-letter recovery still works on the real checklist: "BH12" restores the dropped I → BIH12
    // (unambiguous — no same-number code is a substitution away). "CV12" is NOT a good example
    // anymore: with Coca-Cola "CC12" in the list it's ambiguous (CIV12 via dropped-I vs CC12 via
    // C/V confusion), so the never-guess rule makes it unknown — see the thin-letter test above.
    expect(matchCode('BH12', checklist).entry?.code).toBe('BIH12');
    expect(matchCode('CV12', checklist).status).toBe('unknown');
    // A blind substitution is NEVER auto-corrected (no wrong guesses): GIV12/C1V12 stay unknown.
    expect(matchCode('GIV12', checklist).status).toBe('unknown');
    expect(matchCode('C1V12', checklist).status).toBe('unknown');
  });
});

describe('bestHighConfidenceConfusionMatchFromText (curated directed-confusion fallback)', () => {
  it('recovers a code through known directed glyph confusions, number preserved', () => {
    // "HSA 17" -> RSA17 (H read for R); "NJT 4" -> AUT4 (N for A, J for U). These systematic
    // font confusions are NOT reachable by a blind matchCode substitution — only the curated map.
    expect(bestHighConfidenceConfusionMatchFromText('HSA 17', checklist)?.entry?.code).toBe('RSA17');
    expect(bestHighConfidenceConfusionMatchFromText('NJT 4', checklist)?.entry?.code).toBe('AUT4');
  });

  it('never changes the number, and rejects unknown glyph swaps', () => {
    // "SWV 12" must NOT reach SWE12 (V->E is not a curated confusion) — the false positive guard.
    expect(bestHighConfidenceConfusionMatchFromText('SWV 12', checklist)).toBeNull();
    // No token / pure noise -> null.
    expect(bestHighConfidenceConfusionMatchFromText('just words', checklist)).toBeNull();
  });
});

describe('bestHighConfidenceExactAliasMatchFromText (per-sticker aliases, collision-guarded)', () => {
  it('applies a safe alias whose target is the strictly-nearest real code', () => {
    // "DXW4" is 2 edits from CUW4 and ≥3 from any other #4 code → safe.
    expect(bestHighConfidenceExactAliasMatchFromText('DXW4', checklist)?.entry?.code).toBe('CUW4');
  });

  it('REFUSES an alias that collides with another real same-number code (the 0-FP guard)', () => {
    // Each of these garbles is one edit from a DIFFERENT real code, so a different sticker could
    // produce it — mapping it would be a false positive. All must return null.
    expect(bestHighConfidenceExactAliasMatchFromText('NO2', checklist)).toBeNull(); // ~ real NOR2
    expect(bestHighConfidenceExactAliasMatchFromText('SN10', checklist)).toBeNull(); // ~ real SEN10
    expect(bestHighConfidenceExactAliasMatchFromText('TU10', checklist)).toBeNull(); // ~ real TUR10
    expect(bestHighConfidenceExactAliasMatchFromText('SWV12', checklist)).toBeNull(); // ~ real SWE12
    expect(bestHighConfidenceExactAliasMatchFromText('RO20', checklist)).toBeNull(); // ~ real CRO20
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

  it('falls back to a thin-letter correction', () => {
    const list = makeChecklist(['CIV12']);
    // 'CV12' is the dropped-thin-I reading of CIV12; matchCode restores it (the safe,
    // font-specific correction). Blind letter substitutions are no longer auto-corrected.
    const r = bestMatchFromText('noise CV12 more', list);
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
});

describe('matchLines', () => {
  it('matches one code per line from stacked crops', () => {
    const codes = matchLines('CIV 12\nEGY 4\nBRA 5', checklist).map((r) => r.entry?.code);
    expect(codes).toEqual(['CIV12', 'EGY4', 'BRA5']);
  });

  it('skips long lines so legal text cannot inject a code substring', () => {
    // "NID 9" sits inside a long legal-text line that the length gate drops.
    const text = 'CIV 12\nESTE CROMO E PARTE NID 9 INTEGRANTE DO ALBUM OFICIAL';
    expect(matchLines(text, checklist).map((r) => r.entry?.code)).toEqual(['CIV12']);
  });

  it('dedupes repeated codes and ignores blank/unknown lines', () => {
    expect(matchLines('EGY 4\n\nEGY 4\nZZZ 99', checklist).map((r) => r.entry?.code)).toEqual([
      'EGY4',
    ]);
  });

  it('tolerates a little noise on a short code line', () => {
    expect(matchLines('EGY 4 7', checklist).map((r) => r.entry?.code)).toEqual(['EGY4']);
  });

  it('corrects thin-letter slips on individual codes in a group', () => {
    const text = 'BH12 EGY4'; // "BH12" is the dropped-thin-I reading of BIH12 (unambiguous)
    const codes = matchAllFromText(text, checklist).map((r) => r.entry?.code);
    expect(codes).toContain('BIH12');
    expect(codes).toContain('EGY4');
  });
});
