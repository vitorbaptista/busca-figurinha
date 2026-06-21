import { pt } from '../i18n/pt';

interface InstallPromptProps {
  /** 'prompt' → Android/Chromium native install button. 'ios-steps' → iOS Safari instructions. */
  kind: 'prompt' | 'ios-steps';
  /** Fire the native install prompt (only used in 'prompt' mode). */
  onInstall: () => void;
  /** Close the sheet (✕ / "Agora não" / "Entendi"). */
  onDismiss: () => void;
}

/** A small, dismissible bottom sheet inviting the user to install the app to their home screen.
 *  Stateless: the parent decides when to show it and what to do on install/dismiss. */
export function InstallPrompt({ kind, onInstall, onDismiss }: InstallPromptProps) {
  const t = pt.install;
  return (
    <div class="install-sheet" role="dialog" aria-modal="true" aria-label={t.title}>
      <div class="install-backdrop" onClick={onDismiss} />
      <div class="install-card">
        <button class="install-close" onClick={onDismiss} aria-label={t.dismiss}>
          ✕
        </button>
        <div class="install-emoji" aria-hidden="true">
          📲
        </div>
        <h2 class="install-title">{t.title}</h2>

        {kind === 'prompt' ? (
          <>
            <p class="install-text">{t.bodyAndroid}</p>
            <button class="btn btn-primary btn-block" onClick={onInstall}>
              {t.action}
            </button>
          </>
        ) : (
          <>
            <p class="install-text">{t.bodyIos}</p>
            <ol class="install-steps">
              <li>
                <span class="install-step-ic" aria-hidden="true">
                  ⬆️
                </span>
                {t.iosStep1}
              </li>
              <li>
                <span class="install-step-ic" aria-hidden="true">
                  ➕
                </span>
                {t.iosStep2}
              </li>
            </ol>
            <button class="btn btn-block" onClick={onDismiss}>
              {t.gotIt}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
