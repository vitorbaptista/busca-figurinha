import type { Checklist } from '../types';
import {
  encodePayload,
  decodePayload,
  formatNeeds,
  formatTradeList,
  type TradePayload,
} from './tradeList';

export type ShareTradesResult = 'shared' | 'whatsapp' | 'copied' | 'unavailable';

const LINK_CTA = '👉 Abre o link e veja na hora o que serve pra você 👇';
/** Headline when the sharer has no spares yet — the message becomes a "wishlist" (só "Preciso"). */
const WISHLIST_HEADER = '🔁 Tô montando meu álbum da Copa 2026!';

/** Build the deep link that carries the payload in the query (?t=...). baseUrl is like
 *  location.origin + location.pathname. */
export function buildShareLink(baseUrl: string, payload: TradePayload, checklist: Checklist): string {
  const encoded = encodeURIComponent(encodePayload(payload, checklist));
  const hashStart = baseUrl.indexOf('#');
  const beforeHash = hashStart === -1 ? baseUrl : baseUrl.slice(0, hashStart);
  const hash = hashStart === -1 ? '' : baseUrl.slice(hashStart);
  const joiner = beforeHash.includes('?')
    ? beforeHash.endsWith('?') || beforeHash.endsWith('&')
      ? ''
      : '&'
    : '?';

  return `${beforeHash}${joiner}t=${encoded}${hash}`;
}

/** Read a payload back from a full URL or a raw query/`?t=` value; returns null if absent/garbage. */
export function readShareLink(urlOrSearch: string, checklist: Checklist): TradePayload | null {
  const encoded = extractPayloadValue(urlOrSearch);
  if (!encoded) return null;

  const payload = decodePayload(encoded, checklist);
  return payload.repeats.length > 0 || payload.missing.length > 0 || payload.name ? payload : null;
}

/** The full WhatsApp message text: the grouped "Tenho" list (formatTradeList) of `payload.repeats`,
 *  then a compact "Preciso" line (formatNeeds) of `payload.missing`, then the deep link last so
 *  WhatsApp auto-links it. The on-screen preview renders this verbatim, so what you see IS what's
 *  sent. */
export function buildShareMessage(
  payload: TradePayload,
  link: string,
  checklist: Checklist,
): string {
  const preciso = formatNeeds(payload.missing, checklist);

  // With spares: the grouped "Tenho" block. Without: a "wishlist" headline (sharing what you NEED is
  // useful even before you've scanned a single repeat — that's the whole point of this screen).
  const parts = [
    payload.repeats.length > 0
      ? formatTradeList(payload.repeats, checklist, { name: payload.name })
      : WISHLIST_HEADER,
  ];
  if (preciso) parts.push('', preciso);
  parts.push('', LINK_CTA, link);
  return parts.join('\n');
}

/** Build both the deep link and the full message text for a payload, using the current page as the
 *  base URL. One source of truth for the WhatsApp share AND the "copy" button so the two never drift. */
export function shareTextFor(
  payload: TradePayload,
  checklist: Checklist,
): { link: string; text: string } {
  const link = buildShareLink(browserBaseUrl(), payload, checklist);
  return { link, text: buildShareMessage(payload, link, checklist) };
}

/** Marker that stands in for the long deep link in the ON-SCREEN preview only. What's actually
 *  shared/copied (shareTextFor) keeps the real link — the receiver loop depends on it. Without this
 *  the preview would dump a ~350-char base64 URL that wraps over several lines and reads as broken. */
export const PREVIEW_LINK_PLACEHOLDER = '🔗 (o link da sua lista vai junto)';

/** The preview text: the real message, but with the raw URL replaced by a friendly marker. Reuses
 *  buildShareMessage so the preview can never drift from the structure of what's sent. */
export function previewTextFor(payload: TradePayload, checklist: Checklist): string {
  return buildShareMessage(payload, PREVIEW_LINK_PLACEHOLDER, checklist);
}

export async function shareTrades(
  payload: TradePayload,
  checklist: Checklist,
): Promise<ShareTradesResult> {
  const { text } = shareTextFor(payload, checklist);
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

/** Copy the full share message to the clipboard (the "Copiar lista" button). Returns false when no
 *  clipboard is available so the caller can surface a fallback. */
export async function copyTradeList(payload: TradePayload, checklist: Checklist): Promise<boolean> {
  const { text } = shareTextFor(payload, checklist);
  const nav = typeof navigator === 'undefined' ? null : navigator;
  if (nav?.clipboard && typeof nav.clipboard.writeText === 'function') {
    try {
      await nav.clipboard.writeText(text);
      return true;
    } catch {
      return false;
    }
  }
  return false;
}

function browserBaseUrl(): string {
  if (typeof location === 'undefined') return '';
  return `${location.origin}${location.pathname}`;
}

function extractPayloadValue(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  if (!trimmed.includes('=') && trimmed.startsWith('1')) return trimmed;

  let query = trimmed;
  const queryStart = query.indexOf('?');
  if (queryStart !== -1) query = query.slice(queryStart + 1);

  const hashStart = query.indexOf('#');
  if (hashStart !== -1) query = query.slice(0, hashStart);

  for (const pair of query.split('&')) {
    const [rawKey, rawValue = ''] = pair.split('=');
    if (safeDecode(rawKey) === 't') return safeDecode(rawValue);
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
