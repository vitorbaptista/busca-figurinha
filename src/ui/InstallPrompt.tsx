import { pt } from '../i18n/pt';

interface InstallPromptProps {
  /** Close the sheet (backdrop / ✕ / "Entendi"). */
  onClose: () => void;
}

/** iOS-only "Add to Home Screen" instructions, shown on demand from Ajustes (iOS Safari has no
 *  install API, so the user must do it manually). Android installs via the native OS dialog and
 *  never reaches this sheet. */
export function InstallPrompt({ onClose }: InstallPromptProps) {
  const t = pt.install;
  return (
    <div class="install-sheet" role="dialog" aria-modal="true" aria-label={t.title}>
      <div class="install-backdrop" onClick={onClose} />
      <div class="install-card">
        <button class="install-close" onClick={onClose} aria-label={t.close}>
          ✕
        </button>
        <div class="install-emoji" aria-hidden="true">
          📲
        </div>
        <h2 class="install-title">{t.title}</h2>
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
        <button class="btn btn-block" onClick={onClose}>
          {t.gotIt}
        </button>
      </div>
    </div>
  );
}
