import { describe, expect, it } from 'vitest';
import type { ChecklistEntry, MatchResult } from '../types';
import { checklist } from '../data/checklist';
import { createSession, outcomeFor } from './session';

function entry(code: string): ChecklistEntry {
  const e = checklist.byCode.get(code);
  if (!e) throw new Error(`test setup: unknown code ${code}`);
  return e;
}

function exact(code: string): MatchResult {
  return { raw: code, status: 'exact', entry: entry(code), distance: 0 };
}

function unknown(raw: string): MatchResult {
  return { raw, status: 'unknown', entry: null, distance: -1 };
}

describe('outcomeFor', () => {
  it('is unknown when the match has no entry', () => {
    expect(outcomeFor(unknown('ZZZ99'), false)).toBe('unknown');
  });

  it('is unknown when status is unknown even if owned is passed', () => {
    expect(outcomeFor(unknown('ZZZ99'), true)).toBe('unknown');
  });

  it('is owned for a matched sticker the user already has', () => {
    expect(outcomeFor(exact('CIV12'), true)).toBe('owned');
  });

  it('is needed for a matched sticker the user lacks', () => {
    expect(outcomeFor(exact('CIV12'), false)).toBe('needed');
  });
});

describe('createSession', () => {
  it('starts empty', () => {
    const s = createSession();
    expect(s.isEmpty()).toBe(true);
    expect(s.records()).toEqual([]);
  });

  it('records each add with the right shape', () => {
    const s = createSession();
    const rec = s.add(exact('CIV12'), false);
    expect(rec.raw).toBe('CIV12');
    expect(rec.code).toBe('CIV12');
    expect(rec.outcome).toBe('needed');
    expect(typeof rec.ts).toBe('number');
    expect(s.isEmpty()).toBe(false);
    expect(s.records()).toHaveLength(1);
  });

  it('stores null code for unknown scans', () => {
    const s = createSession();
    const rec = s.add(unknown('ZZZ99'), false);
    expect(rec.code).toBeNull();
    expect(rec.outcome).toBe('unknown');
  });

  it('records() returns a defensive copy', () => {
    const s = createSession();
    s.add(exact('CIV12'), false);
    const copy = s.records();
    copy.push(s.records()[0]);
    expect(s.records()).toHaveLength(1);
  });

  it('clear() empties the session', () => {
    const s = createSession();
    s.add(exact('CIV12'), false);
    s.clear();
    expect(s.isEmpty()).toBe(true);
  });

  it('seeds from initial records', () => {
    const seed = [{ raw: 'CIV12', code: 'CIV12', outcome: 'needed' as const, ts: 1 }];
    const s = createSession(seed);
    expect(s.records()).toHaveLength(1);
  });

  it('toJSON mirrors the records', () => {
    const s = createSession();
    s.add(exact('CIV12'), false);
    expect(s.toJSON()).toEqual(s.records());
  });
});

describe('session report', () => {
  it('dedupes keepers and repeats by code', () => {
    const s = createSession();
    s.add(exact('CIV12'), false); // needed
    s.add(exact('CIV12'), false); // duplicate needed
    s.add(exact('EGY4'), true); // owned
    s.add(exact('EGY4'), true); // duplicate owned

    const report = s.report(checklist);
    expect(report.scannedCount).toBe(4);
    expect(report.keepers.map((e) => e.code)).toEqual(['CIV12']);
    expect(report.repeats.map((e) => e.code)).toEqual(['EGY4']);
  });

  it('dedupes unknown raw tokens', () => {
    const s = createSession();
    s.add(unknown('ZZZ99'), false);
    s.add(unknown('ZZZ99'), false);
    s.add(unknown('WWW88'), false);

    const report = s.report(checklist);
    expect(report.unknowns).toEqual(['ZZZ99', 'WWW88']);
  });

  it('sorts keepers by Portuguese team name then number', () => {
    const s = createSession();
    // BRA1 -> "Brasil", CIV1 -> "Costa do Marfim", ARG2/ARG1 -> "Argentina".
    s.add(exact('BRA1'), false);
    s.add(exact('CIV1'), false);
    s.add(exact('ARG2'), false);
    s.add(exact('ARG1'), false);

    const report = s.report(checklist);
    expect(report.keepers.map((e) => e.code)).toEqual(['ARG1', 'ARG2', 'BRA1', 'CIV1']);
  });

  it('routes outcomes to the right buckets', () => {
    const s = createSession();
    s.add(exact('CIV12'), false); // keeper
    s.add(exact('EGY4'), true); // repeat
    s.add(unknown('ZZZ99'), false); // unknown

    const report = s.report(checklist);
    expect(report.keepers.map((e) => e.code)).toEqual(['CIV12']);
    expect(report.repeats.map((e) => e.code)).toEqual(['EGY4']);
    expect(report.unknowns).toEqual(['ZZZ99']);
  });
});
