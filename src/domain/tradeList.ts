import type { Checklist, ChecklistEntry } from '../types';
import { flagFor } from '../data/flags';
import { normalizeCode } from './code';

/** A decoded/decodable trade payload: the sharer's duplicate codes they can give, and the codes
 *  they are still missing (so the recipient can also see what THEY can give back). `name` optional. */
export interface TradePayload {
  repeats: string[];
  missing: string[];
  name?: string;
}

const VERSION = '1';
const SPECIAL_CODE = 'FWC';
const NAME_PRESENT = 1;
const BASE64URL = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

function canonicalFromInput(raw: string, checklist: Checklist): string | null {
  const normalized = normalizeCode(raw);
  if (normalized === `${SPECIAL_CODE}0`) return checklist.byCode.has('00') ? '00' : null;
  return checklist.byCode.has(normalized) ? normalized : null;
}

function canonicalCodeSet(codes: Iterable<string>, checklist: Checklist): Set<string> {
  const out = new Set<string>();
  for (const code of codes) {
    const canonical = canonicalFromInput(code, checklist);
    if (canonical) out.add(canonical);
  }
  return out;
}

function entriesFromCodeSet(codes: Set<string>, checklist: Checklist): ChecklistEntry[] {
  return checklist.entries.filter((entry) => codes.has(entry.code));
}

function numberLabel(entry: ChecklistEntry): string {
  return entry.code === '00' ? '00' : String(entry.number);
}

function displayTeamLine(teamEntries: ChecklistEntry[]): string {
  const first = teamEntries[0];
  const flag = flagFor(first.teamCode);
  const prefix = flag ? `${flag} ` : '';
  const numbers = teamEntries.map(numberLabel).join(', ');
  // Compact, WhatsApp-friendly: "🇲🇽 MEX 3, 6, 10" (flag + 3-letter code + numbers). The country is
  // already named by the flag + the group header above, so the full team name would only add length.
  return `${prefix}${first.teamCode} ${numbers}`;
}

/** The per-team lines, grouped by album group (A..L) then the group-less sections (Especiais,
 *  Coca-Cola), one team per line via displayTeamLine, with a blank line between groups. The group
 *  header is "Grupo X" for the A..L draw and the section's own name (Especiais / Coca-Cola) otherwise.
 *  Shared by the "Tenho" and "Preciso" blocks so the two layouts can never drift. */
function groupedTeamLines(selected: Set<string>, checklist: Checklist): string[] {
  const lines: string[] = [];
  let currentGroup: string | null = null;
  for (const team of checklist.teams) {
    const teamEntries = team.entries.filter((entry) => selected.has(entry.code));
    if (teamEntries.length === 0) continue;

    const groupLabel = team.group ? `Grupo ${team.group}` : team.teamName;
    if (groupLabel !== currentGroup) {
      if (lines.length > 0) lines.push('');
      lines.push(groupLabel);
      currentGroup = groupLabel;
    }
    lines.push(displayTeamLine(teamEntries));
  }
  return lines;
}

/** Build the human-readable, WhatsApp-friendly pt-BR text of a set of repeat codes, grouped by
 *  album group (A..L, then "Especiais", "Coca-Cola"), one line per team: "🇲🇽 MEX 3, 6, 10, 20".
 *  Numbers sorted ascending; teams in album order; groups in A..L order then the special sections.
 *  Include an optional title line (default e.g. "Repetidas para trocar 🔁", or include opts.name if
 *  given) and, if opts.link is provided, a final call-to-action line with the link. */
export function formatTradeList(
  codes: Iterable<string>,
  checklist: Checklist,
  opts?: { name?: string; link?: string },
): string {
  const selected = canonicalCodeSet(codes, checklist);
  const total = selected.size;
  const fig = total === 1 ? 'figurinha repetida' : 'figurinhas repetidas';
  // First-person headline (the message is sent BY the owner of these repeats): lead with the
  // count so it reads like a real swap offer in the group chat. The sharer's name travels in
  // the link payload, not the text, so the recipient's app can greet them ("Você pega de João").
  const lines = [
    total > 0
      ? `🔁 Tenho ${total} ${fig} da Copa 2026 pra trocar!`
      : 'Ainda não tenho repetidas pra trocar 🔁',
  ];

  const teamLines = groupedTeamLines(selected, checklist);
  if (teamLines.length > 0) {
    lines.push(...teamLines);
  } else {
    lines.push('', 'Nenhuma repetida informada.');
  }

  if (opts?.link) {
    // Put the link on its OWN line so WhatsApp auto-links it, after a benefit-led nudge.
    lines.push('', '👉 Abre o link e veja na hora o que serve pra você 👇', opts.link);
  }

  return lines.join('\n');
}

/** The "Preciso" block for the share message: the codes the sharer still needs, in the SAME
 *  album-grouped, one-team-per-line layout as the "Tenho" list ("🇲🇽 MEX 1, 2, 5, 7"), under a
 *  count header. Returns "" when nothing is needed. No inline cap: grouping by team keeps even a
 *  hundreds-long wishlist down to one line per team, and the full set still travels in the link. */
export function formatNeeds(codes: Iterable<string>, checklist: Checklist): string {
  const selected = canonicalCodeSet(codes, checklist);
  if (selected.size === 0) return '';
  return [`📍 Preciso (${selected.size}):`, ...groupedTeamLines(selected, checklist)].join('\n');
}

interface TeamMention {
  code: string;
  start: number;
  end: number;
}

function teamCodePattern(checklist: Checklist): RegExp {
  const codes = checklist.teams.map((team) => team.teamCode).join('|');
  return new RegExp(`(^|[^A-Z0-9])(${codes})(?=\\d|[^A-Z0-9]|$)`, 'gi');
}

function teamMentions(line: string, checklist: Checklist): TeamMention[] {
  const mentions: TeamMention[] = [];
  const re = teamCodePattern(checklist);
  for (const match of line.matchAll(re)) {
    const prefix = match[1] ?? '';
    const code = match[2].toUpperCase();
    const start = match.index + prefix.length;
    mentions.push({ code, start, end: start + code.length });
  }
  return mentions;
}

function codeFromTeamNumber(teamCode: string, rawNumber: string, checklist: Checklist): string | null {
  const number = Number.parseInt(rawNumber, 10);
  if (!Number.isFinite(number)) return null;
  const code = teamCode === SPECIAL_CODE && number === 0 ? '00' : `${teamCode}${number}`;
  return checklist.byCode.has(code) ? code : null;
}

/** Parse a received/pasted trade-list text back into canonical checklist codes. Robust to the
 *  emoji/format above AND to looser pasted text ("MEX 3, 6, 10, 20", "CIV12", "FWC 1"). Only return
 *  codes that exist in the checklist (validate via checklist.byCode). De-duplicate; preserve a stable
 *  (album) order. Ignore lines/tokens that don't resolve. */
export function parseTradeList(text: string, checklist: Checklist): string[] {
  const found = new Set<string>();
  const numberRe = /\b\d{1,3}\b/g;

  for (const line of text.split(/\r?\n/)) {
    if (/https?:\/\//i.test(line)) continue;

    if (/\b00\b/.test(line) && checklist.byCode.has('00')) {
      found.add('00');
    }

    const mentions = teamMentions(line, checklist);
    for (let i = 0; i < mentions.length; i++) {
      const mention = mentions[i];
      const next = mentions[i + 1];
      const segment = line.slice(mention.end, next?.start);
      for (const match of segment.matchAll(numberRe)) {
        const code = codeFromTeamNumber(mention.code, match[0], checklist);
        if (code) found.add(code);
      }
    }
  }

  return entriesFromCodeSet(found, checklist).map((entry) => entry.code);
}

function bitLength(checklist: Checklist): number {
  return Math.ceil(checklist.entries.length / 8);
}

function setBit(bytes: Uint8Array, index: number): void {
  bytes[Math.floor(index / 8)] |= 1 << (index % 8);
}

function hasBit(bytes: Uint8Array, index: number): boolean {
  return (bytes[Math.floor(index / 8)] & (1 << (index % 8))) !== 0;
}

function bitsetFor(codes: Iterable<string>, checklist: Checklist): Uint8Array {
  const selected = canonicalCodeSet(codes, checklist);
  const bytes = new Uint8Array(bitLength(checklist));
  checklist.entries.forEach((entry, index) => {
    if (selected.has(entry.code)) setBit(bytes, index);
  });
  return bytes;
}

function codesFromBitset(bytes: Uint8Array, checklist: Checklist): string[] {
  const out: string[] = [];
  checklist.entries.forEach((entry, index) => {
    if (hasBit(bytes, index)) out.push(entry.code);
  });
  return out;
}

function base64UrlEncode(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i];
    const b1 = i + 1 < bytes.length ? bytes[i + 1] : 0;
    const b2 = i + 2 < bytes.length ? bytes[i + 2] : 0;

    out += BASE64URL[b0 >> 2];
    out += BASE64URL[((b0 & 3) << 4) | (b1 >> 4)];
    if (i + 1 < bytes.length) out += BASE64URL[((b1 & 15) << 2) | (b2 >> 6)];
    if (i + 2 < bytes.length) out += BASE64URL[b2 & 63];
  }
  return out;
}

function base64UrlDecode(encoded: string): Uint8Array | null {
  const clean = encoded.replace(/=+$/, '');
  if (clean.length % 4 === 1) return null;

  const values: number[] = [];
  for (const char of clean) {
    const value = BASE64URL.indexOf(char);
    if (value === -1) return null;
    values.push(value);
  }

  const bytes: number[] = [];
  for (let i = 0; i < values.length; i += 4) {
    const c0 = values[i];
    const c1 = values[i + 1];
    const c2 = values[i + 2] ?? 0;
    const c3 = values[i + 3] ?? 0;
    if (c1 === undefined) return null;

    bytes.push((c0 << 2) | (c1 >> 4));
    if (i + 2 < values.length) bytes.push(((c1 & 15) << 4) | (c2 >> 2));
    if (i + 3 < values.length) bytes.push(((c2 & 3) << 6) | c3);
  }

  return new Uint8Array(bytes);
}

function emptyPayload(): TradePayload {
  return { repeats: [], missing: [] };
}

/** Compact, URL-safe encoding of a TradePayload for a share link's query (e.g. ?t=...). Encode the
 *  repeats and missing as bitsets over the checklist's canonical entry order (checklist.entries index),
 *  so the payload is tiny and order-stable; base64url (no padding, URL-safe alphabet). Prefix with a
 *  1-char version tag. `name` (if present) appended in a URL-safe way. decode is the exact inverse;
 *  decode must tolerate an unknown/garbage string by returning empty sets rather than throwing. */
export function encodePayload(p: TradePayload, checklist: Checklist): string {
  const repeats = bitsetFor(p.repeats, checklist);
  const missing = bitsetFor(p.missing, checklist);
  const nameBytes = p.name === undefined ? new Uint8Array() : new TextEncoder().encode(p.name);
  const flags = p.name === undefined ? 0 : NAME_PRESENT;
  const body = new Uint8Array(1 + repeats.length + missing.length + nameBytes.length);

  body[0] = flags;
  body.set(repeats, 1);
  body.set(missing, 1 + repeats.length);
  body.set(nameBytes, 1 + repeats.length + missing.length);

  return `${VERSION}${base64UrlEncode(body)}`;
}

export function decodePayload(s: string, checklist: Checklist): TradePayload {
  try {
    const trimmed = s.trim();
    if (!trimmed.startsWith(VERSION)) return emptyPayload();

    const bytes = base64UrlDecode(trimmed.slice(VERSION.length));
    const bits = bitLength(checklist);
    if (!bytes || bytes.length < 1 + bits * 2) return emptyPayload();

    const repeatsBytes = bytes.slice(1, 1 + bits);
    const missingBytes = bytes.slice(1 + bits, 1 + bits * 2);
    const payload: TradePayload = {
      repeats: codesFromBitset(repeatsBytes, checklist),
      missing: codesFromBitset(missingBytes, checklist),
    };

    if ((bytes[0] & NAME_PRESENT) !== 0) {
      payload.name = new TextDecoder().decode(bytes.slice(1 + bits * 2));
    }

    return payload;
  } catch {
    return emptyPayload();
  }
}

/** Two-way trade match. `me` is the recipient's own collection; `friend` is the decoded payload from
 *  the share link. iCanGet = friend.repeats that I do NOT own (entries). iCanGive = my repeats that
 *  the friend is missing (friend.missing). Return ChecklistEntry[] in album order, de-duplicated. */
export function matchTrades(args: {
  me: { owned: Iterable<string>; repeats: Iterable<string> };
  friend: TradePayload;
  checklist: Checklist;
}): { iCanGet: ChecklistEntry[]; iCanGive: ChecklistEntry[] } {
  const owned = canonicalCodeSet(args.me.owned, args.checklist);
  const myRepeats = canonicalCodeSet(args.me.repeats, args.checklist);
  const friendRepeats = canonicalCodeSet(args.friend.repeats, args.checklist);
  const friendMissing = canonicalCodeSet(args.friend.missing, args.checklist);

  const iCanGet = new Set<string>();
  for (const code of friendRepeats) {
    if (!owned.has(code)) iCanGet.add(code);
  }

  const iCanGive = new Set<string>();
  for (const code of myRepeats) {
    if (friendMissing.has(code)) iCanGive.add(code);
  }

  return {
    iCanGet: entriesFromCodeSet(iCanGet, args.checklist),
    iCanGive: entriesFromCodeSet(iCanGive, args.checklist),
  };
}
