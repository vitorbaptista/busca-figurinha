import type { Checklist, KeyValueStore } from '../types';
import { canonicalCodeSet } from '../domain/tradeList';
import { normalizeName, type FriendList } from '../domain/friendMatch';

/** Reactive store of saved friend lists (idb-keyval), separate from the user's own collection. Codes are
 *  canonicalized + checklist-validated at the boundary, so `needs` only ever holds real album codes. */
export interface FriendListsStore {
  readonly ready: Promise<void>;
  loaded(): boolean;
  all(): FriendList[];
  active(): FriendList[];
  get(id: string): FriendList | undefined;
  /** Saved friends whose normalized name matches — the SCREEN decides insert/update/disambiguate. */
  findByNormalizedName(name: string): FriendList[];
  add(input: { name: string; needs: Iterable<string>; source: 'link' | 'paste' }): string;
  updateNeeds(id: string, needs: Iterable<string>): void;
  removeNeeds(id: string, codes: Iterable<string>): void;
  rename(id: string, name: string): void;
  setArchived(id: string, archived: boolean): void;
  remove(id: string): void;
  exportAll(): FriendList[];
  importAll(lists: FriendList[]): void;
  subscribe(listener: () => void): () => void;
}

const KEY = 'friendLists';

export function createFriendListsStore(
  kv: KeyValueStore,
  checklist: Checklist,
  now: () => number = () => Date.now(),
): FriendListsStore {
  let lists: FriendList[] = [];
  const listeners = new Set<() => void>();
  let isLoaded = false;

  const ready = kv.get<FriendList[]>(KEY).then((stored) => {
    isLoaded = true;
    if (Array.isArray(stored) && stored.length) {
      lists = stored.map(sanitizeStored).filter((l): l is FriendList => l !== null);
      notify();
    }
  });

  function notify(): void {
    for (const listener of listeners) listener();
  }
  function persist(): void {
    void kv.set(KEY, lists).catch(() => {
      /* storage full/evicted on a low-end device — nothing we can do. */
    });
  }
  function commit(): void {
    persist();
    notify();
  }

  /** Canonical, checklist-valid, album-ordered, deduped codes. */
  function canonical(codes: Iterable<string>): string[] {
    const set = canonicalCodeSet(codes, checklist);
    return checklist.entries.filter((e) => set.has(e.code)).map((e) => e.code);
  }

  /** Tolerate a corrupt/old persisted or imported record: require id+name, re-canonicalize needs. */
  function sanitizeStored(raw: unknown): FriendList | null {
    if (!raw || typeof raw !== 'object') return null;
    const r = raw as Record<string, unknown>;
    if (typeof r.id !== 'string' || typeof r.name !== 'string') return null;
    return {
      id: r.id,
      name: r.name,
      needs: canonical(Array.isArray(r.needs) ? (r.needs as string[]) : []),
      source: r.source === 'paste' ? 'paste' : 'link',
      archived: r.archived === true,
      updatedAt: typeof r.updatedAt === 'number' ? r.updatedAt : 0,
    };
  }

  /** Deep copy so callers can't mutate internal state (and re-renders see new references). */
  function copy(f: FriendList): FriendList {
    return { ...f, needs: [...f.needs] };
  }

  function mutate(id: string, fn: (f: FriendList) => void): void {
    const f = lists.find((l) => l.id === id);
    if (!f) return;
    fn(f);
    f.updatedAt = now();
    commit();
  }

  return {
    ready,
    loaded: () => isLoaded,
    all: () => lists.map(copy),
    active: () => lists.filter((l) => !l.archived).map(copy),
    get: (id) => {
      const f = lists.find((l) => l.id === id);
      return f ? copy(f) : undefined;
    },
    findByNormalizedName(name) {
      const n = normalizeName(name);
      return lists.filter((l) => normalizeName(l.name) === n).map(copy);
    },
    add({ name, needs, source }) {
      const id = newId();
      lists = [...lists, { id, name, needs: canonical(needs), source, archived: false, updatedAt: now() }];
      commit();
      return id;
    },
    updateNeeds(id, needs) {
      mutate(id, (f) => {
        f.needs = canonical(needs);
      });
    },
    removeNeeds(id, codes) {
      const drop = canonicalCodeSet(codes, checklist);
      mutate(id, (f) => {
        f.needs = f.needs.filter((c) => !drop.has(c));
      });
    },
    rename(id, name) {
      mutate(id, (f) => {
        f.name = name;
      });
    },
    setArchived(id, archived) {
      mutate(id, (f) => {
        f.archived = archived;
      });
    },
    remove(id) {
      const before = lists.length;
      lists = lists.filter((l) => l.id !== id);
      if (lists.length !== before) commit();
    },
    exportAll: () => lists.map(copy),
    importAll(incoming) {
      lists = incoming.map(sanitizeStored).filter((l): l is FriendList => l !== null);
      commit();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

function newId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return 'f' + Math.random().toString(36).slice(2) + now36();
}
function now36(): string {
  return Date.now().toString(36);
}
