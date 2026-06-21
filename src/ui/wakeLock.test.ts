import { describe, it, expect, vi, afterEach } from 'vitest';
import { createScreenWakeLock } from './wakeLock';

// A fake WakeLockSentinel: an EventTarget so we can model the OS firing `release` on hide,
// which is exactly what makes the re-acquire path real.
class FakeSentinel extends EventTarget {
  released = false;
  release = vi.fn(() => {
    this.released = true;
    this.dispatchEvent(new Event('release'));
    return Promise.resolve();
  });
}

interface FakeWakeLock {
  request: ReturnType<typeof vi.fn>;
  sentinels: FakeSentinel[];
}

/** Install a fake navigator.wakeLock whose request() resolves (or rejects). */
function installWakeLock(opts: { reject?: boolean } = {}): FakeWakeLock {
  const sentinels: FakeSentinel[] = [];
  const request = vi.fn(async (_type: 'screen') => {
    if (opts.reject) throw new DOMException('not allowed', 'NotAllowedError');
    const s = new FakeSentinel();
    sentinels.push(s);
    return s as unknown as WakeLockSentinel;
  });
  (navigator as unknown as { wakeLock: unknown }).wakeLock = { request };
  return { request, sentinels };
}

/** Drive document visibility the way the browser does, then fire the event. */
function setVisible(visible: boolean): void {
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => !visible });
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    get: () => (visible ? 'visible' : 'hidden'),
  });
  document.dispatchEvent(new Event('visibilitychange'));
}

// request() awaits navigator.wakeLock.request(), so let microtasks settle before asserting state.
const flush = () => new Promise((r) => setTimeout(r, 0));

afterEach(() => {
  delete (navigator as unknown as { wakeLock?: unknown }).wakeLock;
  setVisible(true);
});

describe('createScreenWakeLock', () => {
  it('acquire() requests a screen lock exactly once', async () => {
    const fake = installWakeLock();
    const wake = createScreenWakeLock();
    wake.acquire();
    await flush();
    expect(fake.request).toHaveBeenCalledTimes(1);
    expect(fake.request).toHaveBeenCalledWith('screen');
    wake.release(); // detach the visibilitychange listener so it can't leak into later tests
  });

  it('re-acquires after the OS auto-releases the lock on background', async () => {
    const fake = installWakeLock();
    const wake = createScreenWakeLock();
    wake.acquire();
    await flush();
    expect(fake.request).toHaveBeenCalledTimes(1);

    // Model the OS releasing the lock on hide (it fires the sentinel's own `release` event, which
    // nulls our handle), then a background → foreground cycle.
    fake.sentinels[0].dispatchEvent(new Event('release'));
    setVisible(false);
    await flush();
    setVisible(true);
    await flush();

    expect(fake.request).toHaveBeenCalledTimes(2);
    wake.release();
  });

  it('release() drops the lock and stops re-acquiring on later visibility changes', async () => {
    const fake = installWakeLock();
    const wake = createScreenWakeLock();
    wake.acquire();
    await flush();
    const sentinel = fake.sentinels[0];

    wake.release();
    await flush();
    expect(sentinel.release).toHaveBeenCalled();

    // A subsequent foreground must NOT re-acquire — the caller let go.
    setVisible(false);
    setVisible(true);
    await flush();
    expect(fake.request).toHaveBeenCalledTimes(1);
  });

  it('is a silent no-op when the API is unsupported', async () => {
    delete (navigator as unknown as { wakeLock?: unknown }).wakeLock;
    const wake = createScreenWakeLock();
    expect(() => {
      wake.acquire();
      wake.release();
    }).not.toThrow();
    await flush();
  });

  it('swallows a rejected request and still re-acquires later (in-flight guard resets)', async () => {
    const fake = installWakeLock({ reject: true });
    const wake = createScreenWakeLock();
    // acquire() must not throw / leak an unhandled rejection even though request() rejects.
    wake.acquire();
    await flush();
    expect(fake.request).toHaveBeenCalledTimes(1);

    // A later visibility change must try again — proving `requesting` was reset in finally.
    setVisible(false);
    setVisible(true);
    await flush();
    expect(fake.request).toHaveBeenCalledTimes(2);
    wake.release();
  });

  it('releases the just-acquired lock if release() runs mid-request (no leak)', async () => {
    // The subtlest race: release() flips `desired` to false WHILE a request() is awaiting. The
    // resolved sentinel must be released, not stored (the listener is already gone, so a stored
    // lock would be unreleasable). Drive it with a hand-resolved request promise.
    let resolveRequest!: (s: WakeLockSentinel) => void;
    const sentinel = new FakeSentinel();
    const request = vi.fn(
      () => new Promise<WakeLockSentinel>((r) => (resolveRequest = r)),
    );
    (navigator as unknown as { wakeLock: unknown }).wakeLock = { request };

    const wake = createScreenWakeLock();
    wake.acquire(); // request() suspends on the pending promise
    wake.release(); // desired → false while the request is in flight
    resolveRequest(sentinel as unknown as WakeLockSentinel);
    await flush();

    expect(sentinel.release).toHaveBeenCalled(); // the just-acquired lock was dropped, not leaked
  });
});
