import type { ChecklistEntry } from '../types';
import type { HuntVerdict } from './friendMatch';

/** What the Conferir finish step ("Terminar") needs from the live pile scan. */
export interface PileReport {
  /** Distinct stickers you NEED (the take-mine reads) — the review list to commit to the collection. */
  taken: ChecklistEntry[];
  /** Every distinct sticker code you read (the friend's whole pile) — what the viral share encodes. */
  wholePile: string[];
}

/**
 * Read-only accumulator for a "conferir a pilha do amigo" session. Mirrors domain/session.ts:
 * scanning records nothing into any store; only the finish step writes. In-memory (a trade is one
 * sitting) — unlike the album session it is NOT persisted to localStorage.
 */
export interface PileSession {
  /** Record one committed read. Returns true when the code was newly recorded (a fresh sticker),
   *  false on a re-read of one already seen — so the live counters stay in sync with the dedup. */
  add(entry: ChecklistEntry, kind: HuntVerdict['kind']): boolean;
  /** Distinct codes you need (take-mine) — drives the live "pra você" counter. */
  takenForMe(): string[];
  /** Distinct codes a saved friend needs but you already own (take-friends) — the "pros amigos" counter. */
  takenForFriends(): string[];
  /** Every distinct code read so far. */
  wholePile(): string[];
  /** Build the finish-step report. Pure: does NOT clear (reset() is explicit). */
  finish(): PileReport;
  /** Clear everything (start a fresh trade). */
  reset(): void;
}

export function createPileSession(): PileSession {
  // code -> { entry, kind }. A Map dedupes by code and preserves first-seen insertion order.
  const reads = new Map<string, { entry: ChecklistEntry; kind: HuntVerdict['kind'] }>();

  const codesWhere = (match: HuntVerdict['kind']): string[] => {
    const out: string[] = [];
    for (const [code, r] of reads) if (r.kind === match) out.push(code);
    return out;
  };

  return {
    add(entry, kind) {
      // First read of a code wins its kind; a sticker's verdict is deterministic, so re-reads agree.
      if (reads.has(entry.code)) return false;
      reads.set(entry.code, { entry, kind });
      return true;
    },
    takenForMe: () => codesWhere('take-mine'),
    takenForFriends: () => codesWhere('take-friends'),
    wholePile: () => [...reads.keys()],
    finish: () => ({
      taken: [...reads.values()].filter((r) => r.kind === 'take-mine').map((r) => r.entry),
      wholePile: [...reads.keys()],
    }),
    reset: () => reads.clear(),
  };
}
