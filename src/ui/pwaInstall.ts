// Pure, browser-free helpers for the install flow. Kept free of `window`/`navigator` access
// so the platform + standalone + invite logic unit-tests in node, exactly like routing.ts.
// The hook (usePwaInstall.ts) wires these to the real beforeinstallprompt/appinstalled events.

/**
 * Install-relevant classification of a user agent:
 *  - 'android'    → Chromium fires `beforeinstallprompt`; a one-tap install button works.
 *  - 'ios-safari' → no prompt event exists, but the user CAN add to the home screen via the
 *                   share sheet, so we can show step-by-step instructions.
 *  - 'ios-other'  → iOS Chrome/Firefox/Edge or an in-app webview (Instagram/Facebook): these
 *                   CANNOT add to the home screen at all, so we must NOT show iOS instructions.
 *  - 'other'      → desktop / unknown: no contextual iOS instructions (the native prompt, if the
 *                   browser supports it, still drives the button via `canPrompt`).
 */
export type InstallPlatform = 'android' | 'ios-safari' | 'ios-other' | 'other';

export function detectPlatform(ua: string): InstallPlatform {
  const s = ua.toLowerCase();
  if (/android/.test(s)) return 'android';
  if (/iphone|ipad|ipod/.test(s)) {
    // Every iOS browser is WebKit; only real Safari can "Add to Home Screen". Chrome (CriOS),
    // Firefox (FxiOS), Edge (EdgiOS) and in-app webviews (FBAN/FBAV/Instagram/Line/etc.) cannot.
    const isOtherIosBrowser = /crios|fxios|edgios|opios|mercury/.test(s);
    const isInAppWebview = /fban|fbav|fbios|instagram|line|micromessenger|gsa|musical_ly|tiktok/.test(s);
    const isRealSafari = /safari/.test(s) && /version\//.test(s) && !isOtherIosBrowser && !isInAppWebview;
    return isRealSafari ? 'ios-safari' : 'ios-other';
  }
  return 'other';
}

/** Combine the two standalone signals: `display-mode: standalone` (Android/desktop) OR the
 *  iOS-only `navigator.standalone === true`. Either one means the app is already installed. */
export function isStandalone(displayModeMatches: boolean, navigatorStandalone: unknown): boolean {
  return displayModeMatches || navigatorStandalone === true;
}

/** What install invite (if any) to offer, given capability only (the AUTO-show gating —
 *  onboarded / previously dismissed — lives in the UI layer, not here):
 *  - already installed → 'none'
 *  - a native prompt is available → 'prompt' (works on Android/desktop Chromium)
 *  - real iOS Safari with no prompt event → 'ios-steps'
 *  - anything else → 'none' */
export function installInvite(args: {
  platform: InstallPlatform;
  isStandalone: boolean;
  canPrompt: boolean;
}): 'prompt' | 'ios-steps' | 'none' {
  if (args.isStandalone) return 'none';
  if (args.canPrompt) return 'prompt';
  if (args.platform === 'ios-safari') return 'ios-steps';
  return 'none';
}
