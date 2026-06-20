import { describe, expect, it } from 'vitest';
import { checklist } from '../data/checklist';
import type { TradePayload } from './tradeList';
import { encodePayload } from './tradeList';
import { buildShareLink, buildShareMessage, readShareLink } from './share';

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
    expect(message).toContain('🇲🇽 México (MEX): 3, 6');
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
    expect(message).toContain('📍 Preciso (2): CIV12, 00');
    expect(message).toContain(link);
  });
});
