// A scanning session is read-only over the collection: it just records what the
// camera saw. The end-of-session report dedupes the records into keepers (needed),
// repeats (owned) and unknowns so the user can tick off what they actually traded.

import type {
  Checklist,
  ChecklistEntry,
  MatchResult,
  ScanOutcome,
  ScanRecord,
  ScanSession,
  SessionReport,
} from '../types';

/** Classify a scan: unknown when unmatched, else owned/needed by the collection. */
export function outcomeFor(match: MatchResult, owned: boolean): ScanOutcome {
  if (match.entry === null || match.status === 'unknown') return 'unknown';
  return owned ? 'owned' : 'needed';
}

export function createSession(initial: ScanRecord[] = []): ScanSession {
  const records: ScanRecord[] = [...initial];

  function add(match: MatchResult, owned: boolean): ScanRecord {
    const record: ScanRecord = {
      raw: match.raw,
      code: match.entry?.code ?? null,
      outcome: outcomeFor(match, owned),
      ts: Date.now(),
    };
    records.push(record);
    return record;
  }

  /** Undo a misread: drop the most recent record with this code so it never reaches
   *  the report. Each code is added at most once per session, so this removes the lone
   *  record for it (and scans the tail just in case there are stray duplicates). */
  function removeByCode(code: string): boolean {
    for (let i = records.length - 1; i >= 0; i--) {
      if (records[i].code === code) {
        records.splice(i, 1);
        return true;
      }
    }
    return false;
  }

  function report(checklist: Checklist): SessionReport {
    const keeperCodes = new Set<string>();
    const repeatCodes = new Set<string>();
    const unknownRaws = new Set<string>();

    for (const r of records) {
      if (r.outcome === 'needed' && r.code) keeperCodes.add(r.code);
      else if (r.outcome === 'owned' && r.code) repeatCodes.add(r.code);
      else if (r.outcome === 'unknown') unknownRaws.add(r.raw);
    }

    const byTeamThenNumber = (a: ChecklistEntry, b: ChecklistEntry) =>
      a.teamName.localeCompare(b.teamName, 'pt') || a.number - b.number;

    const toEntries = (codes: Set<string>): ChecklistEntry[] => {
      const entries: ChecklistEntry[] = [];
      for (const code of codes) {
        const entry = checklist.byCode.get(code);
        if (entry) entries.push(entry);
      }
      return entries.sort(byTeamThenNumber);
    };

    return {
      scannedCount: records.length,
      keepers: toEntries(keeperCodes),
      repeats: toEntries(repeatCodes),
      unknowns: [...unknownRaws],
    };
  }

  function finish(checklist: Checklist): SessionReport {
    const sessionReport = report(checklist);
    records.length = 0;
    return sessionReport;
  }

  return {
    add,
    removeByCode,
    records: () => [...records],
    report,
    finish,
    isEmpty: () => records.length === 0,
    clear: () => {
      records.length = 0;
    },
    toJSON: () => [...records],
  };
}
