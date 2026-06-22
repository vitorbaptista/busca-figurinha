import type { Checklist } from '../types';
import { encodePayload, decodePayload } from './tradeList';

export type SharePileResult = 'shared' | 'whatsapp' | 'copied' | 'unavailable';

const PILE_CTA = '👉 Abre o link e suas figurinhas entram no seu álbum 👇';

/** The viral "I scanned your pile" deep link, under a NEW `?p=` key so the trade `?t=` receiver
 *  never sees it. It carries TWO sets of the friend's stickers via the 2-field tradeList codec:
 *    - `repeats` slot = the ones you did NOT take → still the friend's spares → their álbum AND
 *      their repetidas.
 *    - `missing` slot = the ones you TOOK in the trade → their álbum ONLY (you took that dupe, so
 *      it's no longer a spare for them).
 *  The whole pile = the union of both → the friend's álbum. (`missing` is just the codec's second
 *  transport slot here, not "missing" in the trade sense.) */
export function buildPileLink(
  baseUrl: string,
  pile: Iterable<string>,
  taken: Iterable<string>,
  checklist: Checklist,
  name?: string,
): string {
  const takenSet = new Set(taken);
  const pileArr = [...pile];
  const notTaken = pileArr.filter((c) => !takenSet.has(c));
  const tookFromPile = pileArr.filter((c) => takenSet.has(c));
  const encoded = encodeURIComponent(
    encodePayload({ repeats: notTaken, missing: tookFromPile, name }, checklist),
  );
  const hashStart = baseUrl.indexOf('#');
  const beforeHash = hashStart === -1 ? baseUrl : baseUrl.slice(0, hashStart);
  const hash = hashStart === -1 ? '' : baseUrl.slice(hashStart);
  const joiner = beforeHash.includes('?')
    ? beforeHash.endsWith('?') || beforeHash.endsWith('&')
      ? ''
      : '&'
    : '?';
  return `${beforeHash}${joiner}p=${encoded}${hash}`;
}

/** Read a pile payload back from a full URL or a raw query/`?p=` value; null if absent/garbage.
 *  `ownedCodes` = the whole pile (→ the receiver's álbum); `repeatCodes` = the not-taken subset
 *  (→ the receiver's repetidas). */
export function readPilePayload(
  urlOrSearch: string,
  checklist: Checklist,
): { ownedCodes: string[]; repeatCodes: string[]; name?: string } | null {
  const encoded = extractPileValue(urlOrSearch);
  if (!encoded) return null;
  const payload = decodePayload(encoded, checklist);
  if (payload.repeats.length === 0 && payload.missing.length === 0) return null;
  const repeatCodes = payload.repeats; // not-taken → spares
  const ownedCodes = [...new Set([...payload.repeats, ...payload.missing])]; // whole pile
  return { ownedCodes, repeatCodes, name: payload.name };
}

/** The deep link + the WhatsApp message text for a scanned pile, from the current page. One source
 *  of truth for the QR, the share, and the copy fallback so they never drift. The count is the WHOLE
 *  pile (what enters the friend's álbum), regardless of how many you took. */
export function pileShareTextFor(
  pile: Iterable<string>,
  taken: Iterable<string>,
  checklist: Checklist,
  name?: string,
): { link: string; text: string } {
  const link = buildPileLink(browserBaseUrl(), pile, taken, checklist, name);
  const total = new Set(pile).size;
  const head = `📸 Escaneei a sua pilha da Copa 2026 — ${total} ${
    total === 1 ? 'figurinha' : 'figurinhas'
  }!`;
  return { link, text: [head, '', PILE_CTA, link].join('\n') };
}

export async function sharePile(
  pile: Iterable<string>,
  taken: Iterable<string>,
  checklist: Checklist,
  name?: string,
): Promise<SharePileResult> {
  const { text } = pileShareTextFor(pile, taken, checklist, name);
  const nav = typeof navigator === 'undefined' ? null : navigator;

  if (typeof nav?.share === 'function') {
    try {
      await nav.share({ text });
      return 'shared';
    } catch {
      return 'unavailable';
    }
  }

  if (typeof window !== 'undefined' && typeof window.open === 'function') {
    const opened = window.open(
      `https://wa.me/?text=${encodeURIComponent(text)}`,
      '_blank',
      'noopener,noreferrer',
    );
    if (opened) return 'whatsapp';
  }

  if (nav?.clipboard && typeof nav.clipboard.writeText === 'function') {
    try {
      await nav.clipboard.writeText(text);
      return 'copied';
    } catch {
      return 'unavailable';
    }
  }

  return 'unavailable';
}

function browserBaseUrl(): string {
  if (typeof location === 'undefined') return '';
  return `${location.origin}${location.pathname}`;
}

/** Pull the `p=` value out of a full URL or a bare query; mirrors share.ts's extractor but keyed on
 *  `p`, and a bare value (no `=`) is NOT treated as a pile (only `?t=` accepts a bare payload). */
function extractPileValue(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed || !trimmed.includes('=')) return null;

  let query = trimmed;
  const queryStart = query.indexOf('?');
  if (queryStart !== -1) query = query.slice(queryStart + 1);

  const hashStart = query.indexOf('#');
  if (hashStart !== -1) query = query.slice(0, hashStart);

  for (const pair of query.split('&')) {
    const [rawKey, rawValue = ''] = pair.split('=');
    if (safeDecode(rawKey) === 'p') return safeDecode(rawValue);
  }

  return null;
}

function safeDecode(value: string): string | null {
  try {
    return decodeURIComponent(value.replace(/\+/g, ' '));
  } catch {
    return null;
  }
}
