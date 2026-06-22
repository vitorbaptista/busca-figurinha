import { describe, it, expect } from 'vitest';
import type { CaptureResult } from 'posthog-js';
import { track, trackScreen, stripIdentifyingProps } from './analytics';

// In tests (and dev) there is no VITE_POSTHOG_KEY, so analytics must be a PURE no-op: it must never
// throw, never block, and never reject — analytics can never be allowed to break the app.
describe('analytics — no key configured → pure no-op', () => {
  it('track() returns undefined and never throws', () => {
    expect(track('app_opened')).toBeUndefined();
    expect(() => track('sticker_scanned', { code: 'CIV12', outcome: 'needed', source: 'camera' })).not.toThrow();
  });

  it('trackScreen() never throws', () => {
    expect(() => trackScreen('scan')).not.toThrow();
  });

  it('does not produce an unhandled rejection when flushed', async () => {
    track('share', { kind: 'primary', method: 'whatsapp', spare_count: 3, missing_count: 5 });
    track('report_committed', { keepers_kept: 2, repeats_found: 1, repeats_committed: true, scanned_total: 4 });
    // Let the fire-and-forget promise chain settle. If load()/capture rejected unhandled, the test
    // run would flag it; reaching the assertion means the no-op stayed silent.
    await Promise.resolve();
    await Promise.resolve();
    expect(true).toBe(true);
  });
});

// The privacy-critical guarantee: posthog-js auto-attaches the page URL to every event, and our
// friend-share links carry a `?t=<payload>` that encodes the sharer's NAME. before_send must drop
// the entire URL/referrer surface so that name can never leave the device.
describe('stripIdentifyingProps (before_send) — no URL/referrer/name ever leaves', () => {
  const PAYLOAD_URL = 'https://app.example/busca-figurinha/?t=eyJuYW1lIjoiSm9hbyJ9_with_name';

  it('removes every URL/referrer property but keeps the safe event props', () => {
    const event = {
      uuid: 'u1',
      event: 'app_opened',
      properties: {
        $current_url: PAYLOAD_URL,
        $pathname: '/busca-figurinha/',
        $host: 'app.example',
        $referrer: 'https://wa.me/',
        $referring_domain: 'wa.me',
        app_version: '1.2.3',
        is_standalone: true,
      },
      $set_once: { $initial_current_url: PAYLOAD_URL, $initial_referring_domain: 'wa.me' },
    } as unknown as CaptureResult;

    const out = stripIdentifyingProps(event);
    expect(out).toBeTruthy();
    // safe props survive
    expect(out!.properties.app_version).toBe('1.2.3');
    expect(out!.properties.is_standalone).toBe(true);
    // every URL/referrer prop is gone, from properties AND $set_once
    for (const k of ['$current_url', '$pathname', '$host', '$referrer', '$referring_domain']) {
      expect(out!.properties[k]).toBeUndefined();
    }
    expect(out!.$set_once?.$initial_current_url).toBeUndefined();
    expect(out!.$set_once?.$initial_referring_domain).toBeUndefined();
    // belt-and-suspenders: the ?t= friend payload appears NOWHERE in the outgoing event
    expect(JSON.stringify(out)).not.toContain('?t=');
  });

  it('passes a null event through (posthog calls before_send with null)', () => {
    expect(stripIdentifyingProps(null)).toBeNull();
  });
});
