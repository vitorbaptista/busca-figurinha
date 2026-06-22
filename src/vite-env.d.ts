// Build-time constants injected by Vite `define` (see vite.config.ts).
declare const __APP_VERSION__: string;
declare const __APP_COMMIT__: string;

// Anonymous-analytics config, injected from CI env (deploy.yml) via Vite's VITE_ prefix. Both are
// optional (absent in dev → analytics is a pure no-op). This MERGES onto vite/client's
// ImportMetaEnv — keep this file a global script (no top-level import/export) so the merge holds.
interface ImportMetaEnv {
  readonly VITE_POSTHOG_KEY?: string;
  readonly VITE_POSTHOG_HOST?: string;
}
