import { render } from 'preact';
import { App } from './app';
import { track } from './analytics';
import { isStandalone } from './ui/pwaInstall';
import './styles.css';

// Capture the friend-link flag BEFORE render: the app's routing effect strips `?t=` from the URL on
// mount, so reading location.search afterwards would always miss it.
const viaFriendLink =
  typeof location !== 'undefined' && new URLSearchParams(location.search).has('t');

const root = document.getElementById('app');
if (root) render(<App />, root);

// Anonymous "app opened" stat. Best-effort and fully deferred (track() lazily imports posthog on
// first use), so it never blocks render or the scanner. is_standalone reuses the install helper so
// it also covers iOS home-screen apps.
track('app_opened', {
  app_version: __APP_VERSION__,
  is_standalone: isStandalone(
    window.matchMedia?.('(display-mode: standalone)').matches ?? false,
    (navigator as Navigator & { standalone?: boolean }).standalone,
  ),
  via_friend_link: viaFriendLink,
});

// Register the service worker for offline/PWA support. Best-effort: a failure
// (unsupported browser, dev without the plugin) must never break the app, and we
// avoid top-level await so the entry stays compatible with the build target.
import('virtual:pwa-register')
  .then(({ registerSW }) => registerSW({ immediate: true }))
  .catch(() => {
    /* PWA registration is optional; ignore if unavailable. */
  });
