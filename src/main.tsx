import { render } from 'preact';
import { App } from './app';
import './styles.css';

const root = document.getElementById('app');
if (root) render(<App />, root);

// Register the service worker for offline/PWA support. Best-effort: a failure
// (unsupported browser, dev without the plugin) must never break the app, and we
// avoid top-level await so the entry stays compatible with the build target.
import('virtual:pwa-register')
  .then(({ registerSW }) => registerSW({ immediate: true }))
  .catch(() => {
    /* PWA registration is optional; ignore if unavailable. */
  });
