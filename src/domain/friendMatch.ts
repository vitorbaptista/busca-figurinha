// The 0-FALSE-POSITIVE heart of the "saved friend lists + radar" feature. A friend's saved wishlist can
// never offer YOUR stickers — the radar/caça only ever say "serve pro {amigo}" for a code you can
// actually GIVE, i.e. one of your spares (repeats ∩ owned, passed in as `myRepeatCodes`). A code you
// scanned but still NEED yourself is NOT givable and must never flag a friend.

/** A saved friend's list. Keyed on a stable `id`; `name` is a display/match hint, not the key. */
export interface FriendList {
  id: string;
  name: string;
  /** Canonical album codes the friend still needs (validated at the store boundary). */
  needs: string[];
  /** Where the list came from (a ?t= link or a pasted text) — drives the update/diff UX. */
  source: 'link' | 'paste';
  archived: boolean;
  updatedAt: number;
}

/** The ACTIVE saved friends who need `code` AND to whom I can give it — only when `code` is one of my
 *  own spares (`myRepeatCodes` = repeats ∩ owned). Returns [] when the code isn't mine to give. */
export function friendCanReceive(args: {
  code: string;
  myRepeatCodes: Set<string>;
  friends: FriendList[];
}): FriendList[] {
  if (!args.myRepeatCodes.has(args.code)) return [];
  return args.friends.filter((f) => !f.archived && f.needs.includes(args.code));
}

/** The codes I can give this friend right now = their needs that I hold as spares. Computed live
 *  against my current repeats, never persisted, so it can't go stale. */
export function givableTo(friend: FriendList, myRepeatCodes: Set<string>): string[] {
  return friend.needs.filter((code) => myRepeatCodes.has(code));
}

const COMBINING = new RegExp('[\\u0300-\\u036f]', 'g');

/** Normalize a name for matching a re-shared list back to its saved friend: strip accents, lowercase,
 *  collapse whitespace, trim. (Identity is the stable `id`; this is only a match hint for the screen.) */
export function normalizeName(name: string): string {
  return name
    .normalize('NFD')
    .replace(COMBINING, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}
