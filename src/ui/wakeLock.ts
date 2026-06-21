/**
 * Keeps the phone screen from dimming/locking while the scanner is open, via the Screen Wake
 * Lock API. Without it the phone sleeps mid-scan — interrupting the hands-free loop AND pausing
 * the camera <video> (the same stall `frameSource.ts` fights) and killing the fill-light the
 * capture relies on.
 *
 * The one non-obvious bit: the OS automatically RELEASES the lock whenever the page is hidden
 * (tab/app switch, screen off), firing the sentinel's `release` event. So the lock must be
 * re-acquired when the page becomes visible again — the same `visibilitychange` precedent
 * `frameSource.ts` uses to replay the paused video. A "request once" version silently stops
 * working after the first backgrounding.
 */
export interface ScreenWakeLock {
  /** Hold the screen awake; re-acquires automatically after the page is backgrounded. */
  acquire(): void;
  /** Drop the lock and stop re-acquiring. Idempotent. */
  release(): void;
}

export function createScreenWakeLock(): ScreenWakeLock {
  // Single runtime guard. `navigator.wakeLock` is typed non-optional by lib.dom, but at RUNTIME it
  // is absent on unsupported browsers (older Safari) and in jsdom unless a fake is injected — so the
  // `in` check is the real gate; TS can't enforce it. Computed once: API presence doesn't change.
  const supported = typeof navigator !== 'undefined' && 'wakeLock' in navigator;

  let desired = false; // does the caller want the lock held right now?
  let sentinel: WakeLockSentinel | null = null; // the live lock, or null
  let requesting = false; // an acquire is in flight (acquire() and visibilitychange both fire it)

  const request = async (): Promise<void> => {
    if (!supported || !desired || sentinel || requesting || document.hidden) return;
    requesting = true;
    try {
      const s = await navigator.wakeLock.request('screen');
      if (!desired) {
        // release() ran while this request was in flight — don't keep the lock.
        void s.release().catch(() => {});
        return;
      }
      sentinel = s;
      // The OS auto-releases on hide and fires this; null our handle so the visibility re-arm
      // (which guards on `!sentinel`) actually re-requests. This is the load-bearing line.
      s.addEventListener('release', () => {
        if (sentinel === s) sentinel = null;
      });
    } catch {
      /* request rejected (page not visible, battery-saver, UA policy) — acceptable, try again later */
    } finally {
      // Reset even on rejection — otherwise one failed request wedges the flag and every future
      // re-acquire silently no-ops.
      requesting = false;
    }
  };

  const onVisibility = (): void => {
    if (!document.hidden) void request();
  };

  return {
    acquire() {
      if (!supported) return;
      desired = true;
      document.addEventListener('visibilitychange', onVisibility);
      void request();
    },
    release() {
      desired = false;
      if (!supported) return;
      document.removeEventListener('visibilitychange', onVisibility);
      const s = sentinel;
      sentinel = null; // null first so the `release` listener's `sentinel === s` check is already false
      void s?.release().catch(() => {});
    },
  };
}
