import { useCallback, useEffect, useMemo, useState } from 'preact/hooks';
import { detectPlatform, installInvite, isStandalone, type InstallPlatform } from './pwaInstall';

// The non-standard event Chromium fires when the app is installable. Not in lib.dom yet.
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export interface PwaInstall {
  /** Which invite to show, if any. Capability only — the auto-show gating (onboarded /
   *  previously dismissed) lives in the caller. */
  invite: 'prompt' | 'ios-steps' | 'none';
  platform: InstallPlatform;
  /** True once the app runs as an installed standalone app (Android display-mode or iOS). */
  isStandalone: boolean;
  /** Fire the native install prompt (Android/Chromium). Single-use — the stashed event is
   *  consumed and cleared. A no-op returning 'unavailable' when there's no pending event. */
  promptInstall: () => Promise<'accepted' | 'dismissed' | 'unavailable'>;
}

function readStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  const displayMode = window.matchMedia?.('(display-mode: standalone)').matches ?? false;
  const navStandalone = (navigator as Navigator & { standalone?: boolean }).standalone;
  return isStandalone(displayMode, navStandalone);
}

/** Captures `beforeinstallprompt`/`appinstalled` and derives the install invite. Must be mounted
 *  once at the app root (the event fires early, before lazily-mounted screens exist), then its
 *  result passed down to anywhere that offers installing (e.g. Ajustes). */
export function usePwaInstall(): PwaInstall {
  const platform = useMemo(
    () => detectPlatform(typeof navigator === 'undefined' ? '' : navigator.userAgent),
    [],
  );
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [standalone, setStandalone] = useState<boolean>(readStandalone);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onBeforeInstallPrompt = (e: Event) => {
      // Stop Chrome's default mini-infobar; stash the event so OUR UI can trigger it later.
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      // Installed: drop the (now spent) event and reflect standalone so the invite disappears.
      setDeferred(null);
      setStandalone(true);
    };
    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const promptInstall = useCallback(async (): Promise<'accepted' | 'dismissed' | 'unavailable'> => {
    if (!deferred) return 'unavailable';
    await deferred.prompt();
    const { outcome } = await deferred.userChoice;
    setDeferred(null); // the event can only be used once
    return outcome;
  }, [deferred]);

  const invite = installInvite({ platform, isStandalone: standalone, canPrompt: !!deferred });
  return { invite, platform, isStandalone: standalone, promptInstall };
}
