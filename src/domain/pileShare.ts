import type { Checklist } from '../types';
import { encodePayload, decodePayload } from './tradeList';

export type SharePileResult = 'shared' | 'whatsapp' | 'copied' | 'unavailable';

const PILE_CTA = '👉 Abre o link e suas figurinhas entram no seu álbum 👇';

/** The viral "I scanned your pile" deep link. Carries the scanned codes in the payload's `repeats`
 *  slot (for the friend these ARE their stickers-in-hand) under a NEW `?p=` key, so the trade `?t=`
 *  receiver never sees it and can't misread it as a trade offer. Reuses the tradeList codec. */
export function buildPileLink(
  baseUrl: string,
  codes: Iterable<string>,
  checklist: Checklist,
  name?: string,
): string {
  const encoded = encodeURIComponent(
    encodePayload({ repeats: [...codes], missing: [], name }, checklist),
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

/** Read a pile payload back from a full URL or a raw query/`?p=` value; null if absent/garbage. */
export function readPilePayload(
  urlOrSearch: string,
  checklist: Checklist,
): { codes: string[]; name?: string } | null {
  const encoded = extractPileValue(urlOrSearch);
  if (!encoded) return null;
  const payload = decodePayload(encoded, checklist);
  if (payload.repeats.length === 0) return null;
  return { codes: payload.repeats, name: payload.name };
}

/** The deep link + the WhatsApp message text for a scanned pile, from the current page. One source
 *  of truth for the QR, the share, and the copy fallback so they never drift. */
export function pileShareTextFor(
  codes: Iterable<string>,
  checklist: Checklist,
  name?: string,
): { link: string; text: string } {
  const link = buildPileLink(browserBaseUrl(), codes, checklist, name);
  const total = new Set(codes).size;
  const head = `📸 Escaneei a sua pilha da Copa 2026 — ${total} ${
    total === 1 ? 'figurinha' : 'figurinhas'
  }!`;
  return { link, text: [head, '', PILE_CTA, link].join('\n') };
}

export async function sharePile(
  codes: Iterable<string>,
  checklist: Checklist,
  name?: string,
): Promise<SharePileResult> {
  const { text } = pileShareTextFor(codes, checklist, name);
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
