# Analytics (PostHog) — setup & privacy

Anonymous, **no-PII** usage stats so we can see how useful the app is (scan volume, which stickers
fail, sharing, session outcomes, rough geography, unique-browser counts) **without knowing who** is
using it. Implementation: `src/analytics.ts` (a lazy `posthog-js` wrapper). Design rationale +
review trail: GitHub issue #71.

## Disabled by default

With **no key configured**, analytics is a **pure no-op**: `track()` returns immediately and Vite
dead-code-eliminates `posthog-js` out of the bundle entirely (the `if (!KEY) return` short-circuit
becomes always-true at build time). Dev, tests, and any build without the secret send nothing. So
nothing happens until you do the two setup steps below.

## 1. Turn it on (GitHub Actions)

The key is injected at build time via `import.meta.env.VITE_POSTHOG_*` (wired in
`.github/workflows/deploy.yml`). In the repo **Settings → Secrets and variables → Actions**:

- **Secret** `POSTHOG_KEY` — your PostHog **project API key** (`phc_…`). This is a *public client
  key* (it ships in the JS bundle by design); it is safe to expose. It is a secret only to keep it
  out of CI logs.
- **Variable** `POSTHOG_HOST` *(optional)* — `https://us.i.posthog.com` (default) or
  `https://eu.i.posthog.com`. If unset, the client falls back to US cloud.

Push to `main` (or run the deploy workflow) and the next build will have analytics enabled.

## 2. Configure the PostHog project (privacy-critical)

The "we only keep country/state, never the raw IP" promise is **server-side** — it must be set on
the project, the client cannot enforce it alone. In **PostHog → Project settings**:

1. **Enable GeoIP.**
2. **Enable "Discard client IP data".** PostHog runs GeoIP enrichment *first* and *then* drops the
   IP, so `$geoip_country_name` + `$geoip_subdivision_1_name` (state) survive while the identifying
   IP is never stored.
3. **Do NOT enable "Cookieless server hash mode".** In that mode the IP is stripped *before*
   transformations run, which **kills GeoIP** (you'd lose country/state entirely).
4. **Drop `$geoip_city_name`, `$geoip_latitude`, `$geoip_longitude`** (keep only country +
   subdivision_1). City/lat-long would weaken the anonymity claim.
5. **Verify in Live Events:** events arrive anonymous (no person profile), carry country/state, and
   show **no** IP / city / lat-long, and no `$autocapture` / `$pageview` / `$current_url` noise.

## What the client already guarantees (no project config needed)

`src/analytics.ts` hardens posthog so that, key or not, no PII can leave the device:

- `person_profiles: 'identified_only'` and **we never call `identify()`** → every event is
  anonymous; the only "identity" is a random `distinct_id` in `localStorage` (counts unique
  browsers, no cookies, less identifying than a fingerprint).
- `autocapture: false` + `disable_session_recording: true` → posthog never captures the
  manual-entry field or the friend-name input.
- **`before_send: stripIdentifyingProps`** removes `$current_url` / `$pathname` / `$host` /
  `$referrer` / `$referring_domain` (+ their `$initial_*` variants) from **every** event. This is
  load-bearing: `capture_pageview: false` suppresses only the auto *pageview event*, not the
  `$current_url` *property*, and our friend-share links (`?t=<payload>`) encode the **sharer's
  name** in the URL — so without this strip, that name would leak. Covered by `src/analytics.test.ts`.

## Events

All anonymous, non-PII (sticker codes are album metadata; only counts/enums otherwise).

| Event | Fires when | Properties |
|---|---|---|
| `app_opened` | app loads | `app_version`, `is_standalone`, `via_friend_link` |
| `screen_viewed` | section change | `screen` |
| `sticker_scanned` | a code is read, once per distinct code per session | `outcome` (`needed`/`owned`), `match_status` (`exact`/`corrected`), `source` (`camera`/`manual`), `code`, `multi` |
| `misread_rejected` | user taps "Não é essa?" | `outcome` |
| `ocr_unavailable` | OCR fails to load (once/mount) | — |
| `share` | a list is shared | `kind` (`primary`/`reply`), `method` (`shared`/`whatsapp`/`copied`/`unavailable`), `spare_count`, `missing_count` |
| `friend_list_saved` | a friend's list is saved/updated | `needs_count`, `is_update` |
| `gave_to_friend` | "Dei essas pro …" | `spare_count` |
| `report_committed` | keepers committed at end of scan | `keepers_kept`, `repeats_found`, `repeats_committed`, `scanned_total` |

Interpretation notes:
- **"How many scanned"** = `sticker_scanned` count. It fires **once per distinct code per session**
  (matching the app's own dedup), so re-scanning the same sticker in one session doesn't inflate it.
- **"Which ones the scanner missed"** = `sticker_scanned{source:'manual'}` — the user only types a
  code the camera failed to read. (Caveat: manual entry is also reachable by the always-on keyboard
  button, so it's a close proxy for OCR misses, not an exact one. `misread_rejected` separately
  flags confidently-wrong reads.)
- The **Conferir** scanner (checking a friend's pile) is **deliberately not** counted as
  `sticker_scanned` — it's a trade-assist, not the user building their own album. Its usage still
  shows via `screen_viewed` (`screen: 'conferir'`).
