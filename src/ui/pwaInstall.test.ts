import { describe, it, expect } from 'vitest';
import { detectPlatform, isStandalone, installInvite } from './pwaInstall';

// Real-world UA strings (trimmed) for each install class.
const UA = {
  androidChrome:
    'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36',
  iphoneSafari:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  iphoneChrome:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/120.0 Mobile/15E148 Safari/604.1',
  iphoneInstagram:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 300.0 (iPhone; iOS 17_0)',
  desktopChrome:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
};

describe('detectPlatform', () => {
  it('classifies Android Chromium as android (native prompt path)', () => {
    expect(detectPlatform(UA.androidChrome)).toBe('android');
  });

  it('classifies real iOS Safari as ios-safari (can add to home screen)', () => {
    expect(detectPlatform(UA.iphoneSafari)).toBe('ios-safari');
  });

  it('classifies iOS Chrome (CriOS) as ios-other — it cannot add to home screen', () => {
    // CriOS UAs still contain "Safari/604.1", so the check must exclude crios explicitly.
    expect(detectPlatform(UA.iphoneChrome)).toBe('ios-other');
  });

  it('classifies an iOS in-app webview (Instagram) as ios-other', () => {
    expect(detectPlatform(UA.iphoneInstagram)).toBe('ios-other');
  });

  it('classifies desktop as other', () => {
    expect(detectPlatform(UA.desktopChrome)).toBe('other');
  });
});

describe('isStandalone', () => {
  it('is false when neither signal is set', () => {
    expect(isStandalone(false, undefined)).toBe(false);
    expect(isStandalone(false, false)).toBe(false);
  });

  it('is true when display-mode matches (Android/desktop)', () => {
    expect(isStandalone(true, undefined)).toBe(true);
  });

  it('is true when navigator.standalone === true (iOS)', () => {
    expect(isStandalone(false, true)).toBe(true);
  });

  it('treats a non-true navigator.standalone as not standalone', () => {
    expect(isStandalone(false, 'yes')).toBe(false);
    expect(isStandalone(false, 1)).toBe(false);
  });
});

describe('installInvite', () => {
  it('offers the native prompt when one is available', () => {
    expect(installInvite({ platform: 'android', isStandalone: false, canPrompt: true })).toBe('prompt');
    // The prompt event drives this regardless of platform (desktop Chrome too).
    expect(installInvite({ platform: 'other', isStandalone: false, canPrompt: true })).toBe('prompt');
  });

  it('offers iOS steps on real Safari when there is no prompt event', () => {
    expect(installInvite({ platform: 'ios-safari', isStandalone: false, canPrompt: false })).toBe('ios-steps');
  });

  it('offers nothing on iOS browsers that cannot install', () => {
    expect(installInvite({ platform: 'ios-other', isStandalone: false, canPrompt: false })).toBe('none');
  });

  it('offers nothing once the app is already installed (standalone wins over everything)', () => {
    expect(installInvite({ platform: 'android', isStandalone: true, canPrompt: true })).toBe('none');
    expect(installInvite({ platform: 'ios-safari', isStandalone: true, canPrompt: false })).toBe('none');
  });

  it('offers nothing on a plain desktop browser with no prompt', () => {
    expect(installInvite({ platform: 'other', isStandalone: false, canPrompt: false })).toBe('none');
  });
});
