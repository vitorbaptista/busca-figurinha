// Anonymous, no-PII usage stats. ONE lazy wrapper around posthog-js so the whole app talks to a
// `track()` that NEVER throws and NEVER blocks: posthog-js is dynamically imported on first use
// (a separate chunk, off the scanner's critical path), and every call is fire-and-forget so an
// offline/blocked/missing-key state can't break the app. No analytics code touches the 0-FP
// recognition pipeline. See GH issue #71 for the privacy design.
import type { BeforeSendFn, PostHog } from 'posthog-js';

// The 9 events we send. NOTE: the Conferir screen (scanning a friend's pile to decide what to grab)
// is deliberately NOT counted as a `sticker_scanned` — it's a trade-assist, not the user building
// their own album, and mixing it in would skew "stickers scanned". Conferir usage is still visible
// via `screen_viewed` (screen: 'conferir').
export type AnalyticsEvent =
  | 'app_opened'
  | 'screen_viewed'
  | 'sticker_scanned'
  | 'misread_rejected'
  | 'ocr_unavailable'
  | 'share'
  | 'friend_list_saved'
  | 'gave_to_friend'
  | 'report_committed';

type Props = Record<string, string | number | boolean | undefined>;

// posthog-js auto-attaches URL + referrer properties (and $initial_* person props) to EVERY event;
// `capture_pageview: false` suppresses only the auto pageview EVENT, NOT these properties. Our
// friend-share links carry a `?t=<payload>` in the URL that encodes the sharer's NAME, so we drop
// the whole URL/referrer surface from every event BEFORE it leaves the device — independent of
// whether the routing effect has stripped `?t=` yet (a race we must not depend on). We don't need
// URLs anyway: screens are tracked explicitly via `screen_viewed`. Exported + pure so the privacy
// guarantee is unit-tested without loading posthog.
const IDENTIFYING_PROPS = [
  '$current_url',
  '$pathname',
  '$host',
  '$referrer',
  '$referring_domain',
  '$initial_current_url',
  '$initial_pathname',
  '$initial_host',
  '$initial_referrer',
  '$initial_referring_domain',
];

export const stripIdentifyingProps: BeforeSendFn = (event) => {
  if (event) {
    for (const bag of [event.properties, event.$set, event.$set_once]) {
      if (!bag) continue;
      for (const key of IDENTIFYING_PROPS) delete bag[key];
    }
  }
  return event;
};

// Injected at build time from CI env (deploy.yml). Empty/unset → analytics is a pure no-op, so
// dev and tests send nothing. `||` (not `??`) so an empty CI variable falls back to the default.
const KEY = import.meta.env.VITE_POSTHOG_KEY || '';
const HOST = import.meta.env.VITE_POSTHOG_HOST || 'https://us.i.posthog.com';

let phPromise: Promise<PostHog | null> | null = null;

function load(): Promise<PostHog | null> {
  if (!KEY) return Promise.resolve(null); // disabled (no key) → never even imports posthog-js
  if (!phPromise) {
    phPromise = import('posthog-js')
      .then(({ default: posthog }) => {
        posthog.init(KEY, {
          api_host: HOST,
          // Fully anonymous: we NEVER call identify(), so no person profile is created; the random
          // distinct_id (localStorage) is the only "identity" — it counts unique browsers, no PII.
          person_profiles: 'identified_only',
          persistence: 'localStorage', // no cookies → no cookie-consent surface
          // Send ONLY the explicit events below. autocapture off is load-bearing: it's what stops
          // posthog from capturing the manual-entry input and the friend-name field (incidental PII).
          autocapture: false,
          capture_pageview: false,
          capture_pageleave: false,
          disable_session_recording: true,
          // Strip URL/referrer props from every event (the friend-link ?t= payload carries a name).
          before_send: stripIdentifyingProps,
        });
        return posthog;
      })
      .catch(() => null); // offline / blocked → stay null; never throw
  }
  return phPromise;
}

/** Record an anonymous, non-PII usage event. Fire-and-forget — safe to call from anywhere; it can
 *  never throw, block, or alter control flow. A no-op when no PostHog key is configured. */
export function track(event: AnalyticsEvent, props?: Props): void {
  void load()
    .then((ph) => ph?.capture(event, props))
    .catch(() => {});
}

/** Convenience for the per-screen "pageview" equivalent. */
export function trackScreen(screen: string): void {
  track('screen_viewed', { screen });
}
