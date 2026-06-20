import { describe, expect, it } from 'vitest';
import { checklist } from '../data/checklist';
import type { TradePayload } from './tradeList';
import { encodePayload } from './tradeList';
import {
  buildShareLink,
  buildShareMessage,
  readShareLink,
  previewTextFor,
  shareTextFor,
  PREVIEW_LINK_PLACEHOLDER,
} from './share';

describe('share links', () => {
  it('round-trips a payload through buildShareLink and readShareLink', () => {
    const payload: TradePayload = {
      repeats: ['MEX3', 'CIV12'],
      missing: ['00', 'FWC1'],
      name: 'Ana',
    };

    const link = buildShareLink('https://exemplo.com/app', payload, checklist);

    expect(link).toMatch(/^https:\/\/exemplo\.com\/app\?t=1/);
    expect(readShareLink(link, checklist)).toEqual(payload);
  });

  it('reads full URLs and raw queries, and ignores absent or garbage payloads', () => {
    const payload: TradePayload = {
      repeats: ['MEX3', 'MEX6'],
      missing: ['CIV12'],
    };
    const encoded = encodePayload(payload, checklist);

    expect(readShareLink(`https://exemplo.com/app?x=1&t=${encoded}#trocas`, checklist)).toEqual(
      payload,
    );
    expect(readShareLink(`?t=${encoded}`, checklist)).toEqual(payload);
    expect(readShareLink('?t=', checklist)).toBeNull();
    expect(readShareLink('?t=%%%%', checklist)).toBeNull();
    expect(readShareLink('https://exemplo.com/app?x=1', checklist)).toBeNull();
  });

  it('builds a share message with the link and the grouped team line', () => {
    const payload: TradePayload = {
      repeats: ['MEX3', 'MEX6'],
      missing: [],
    };
    const link = buildShareLink('https://exemplo.com/app', payload, checklist);
    const message = buildShareMessage(payload, link, checklist);

    expect(message).toContain(link);
    expect(message).toContain('🇲🇽 MEX 3, 6');
    // No needs → no "Preciso" line, and the link is last.
    expect(message).not.toContain('Preciso');
    expect(message.trimEnd().endsWith(link)).toBe(true);
  });

  it('includes a compact "Preciso" line when the payload has missing codes', () => {
    const payload: TradePayload = {
      repeats: ['MEX3'],
      missing: ['CIV12', '00'],
    };
    const link = buildShareLink('https://exemplo.com/app', payload, checklist);
    const message = buildShareMessage(payload, link, checklist);

    expect(message).toContain('🔁 Tenho 1 figurinha repetida da Copa 2026 pra trocar!');
    // The "Preciso" block mirrors the grouped "Tenho" layout: header + one compact line per team.
    expect(message).toContain('📍 Preciso (2):');
    expect(message).toContain('🇨🇮 CIV 12');
    expect(message).toContain('⭐ FWC 00');
    expect(message).toContain(link);
  });

  it('builds a "wishlist" message (no repeats yet) — só Preciso, sem linha redundante', () => {
    const payload: TradePayload = { repeats: [], missing: ['CIV12', '00'] };
    const link = buildShareLink('https://exemplo.com/app', payload, checklist);
    const message = buildShareMessage(payload, link, checklist);

    expect(message).toContain('🔁 Tô montando meu álbum da Copa 2026!');
    expect(message).toContain('📍 Preciso (2):');
    expect(message).toContain('🇨🇮 CIV 12');
    expect(message).toContain(link);
    // No awkward "Tenho 0 …" / "Nenhuma repetida informada." when sharing a pure wishlist.
    expect(message).not.toContain('Tenho 0');
    expect(message).not.toContain('Nenhuma repetida informada.');
  });
});

describe('preview text', () => {
  it('hides the raw deep link behind a friendly marker, while the real message keeps it', () => {
    const payload: TradePayload = { repeats: ['MEX3', 'MEX6'], missing: ['CIV12', '00'] };

    const preview = previewTextFor(payload, checklist);
    // Same body as the real message...
    expect(preview).toContain('🔁 Tenho 2 figurinhas repetidas da Copa 2026 pra trocar!');
    expect(preview).toContain('📍 Preciso (2):');
    expect(preview).toContain('🇨🇮 CIV 12');
    // ...but the ~350-char base64 URL is replaced by the marker — no raw link to wrap/break.
    expect(preview).toContain(PREVIEW_LINK_PLACEHOLDER);
    expect(preview).not.toContain('?t=');
    expect(preview).not.toMatch(/https?:\/\//);

    // What's actually shared/copied still carries the deep link so the receiver loop works.
    expect(shareTextFor(payload, checklist).text).toContain('?t=');
  });
});
