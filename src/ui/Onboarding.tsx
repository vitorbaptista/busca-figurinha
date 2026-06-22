import { useMemo, useState } from 'preact/hooks';
import { pt } from '../i18n/pt';
import { checklist } from '../data/checklist';
import { parseImport } from '../domain/importList';
import { sanitizeName } from '../domain/name';
import { ScanDemo } from './components/ScanDemo';

/** What the first-run flow learned about the user, handed back to app.tsx to seed state + route. */
export interface OnboardingResult {
  /** First name / nickname, signed into share links. Absent if the user skipped the field. */
  name?: string;
  /** Where to drop the user: their own pile (Escanear) or someone else's (Conferir). */
  start: 'scan' | 'conferir';
  /** Codes from a pasted "what I'm looking for" list, to seed the wishlist (wants). */
  wants?: string[];
}

type Step = 'welcome' | 'whose' | 'list' | 'paste';

const PREV: Record<Step, Step> = {
  welcome: 'welcome',
  whose: 'welcome',
  list: 'whose',
  paste: 'list',
};

/** First-run onboarding: prove the value (a looping live-scan demo), ask only the first name, then
 *  route the user to the right starting point — their own pile (Escanear) or another person's
 *  (Conferir), optionally seeding a pasted want-list. Replaces the old emoji carousel. */
export function Onboarding({
  onComplete,
  defaultName,
}: {
  onComplete: (result: OnboardingResult) => void;
  /** Pre-fills the name field — so replaying the tutorial from Ajustes keeps the existing name. */
  defaultName?: string;
}) {
  const [step, setStep] = useState<Step>('welcome');
  const [name, setName] = useState(defaultName ?? '');
  const [paste, setPaste] = useState('');

  // Sanitize at the source so the name written to settings (and signed into share links) matches what
  // the rest of the app produces (Ajustes/Trocar route through the same sanitizeName: strips
  // zero-width/control chars, collapses whitespace, caps at 24).
  const cleanName = sanitizeName(name);
  const finish = (start: 'scan' | 'conferir', wants?: string[]) =>
    onComplete({ name: cleanName || undefined, start, wants });

  // Recognized codes in the pasted list — recomputed as they type so the count reassures them the
  // paste worked (the same parser the Importar flow uses). Cheap for an onboarding-sized paste.
  const pasteCodes = useMemo(
    () => (paste.trim() ? parseImport(paste, checklist).codes : []),
    [paste],
  );

  return (
    <div class="onboarding">
      {step !== 'welcome' && (
        <button class="onboarding-back" onClick={() => setStep(PREV[step])}>
          ← {pt.onboarding.back}
        </button>
      )}
      <button class="onboarding-skip" onClick={() => finish('scan')}>
        {pt.onboarding.skip}
      </button>

      {step === 'welcome' && (
        <div class="ob-step ob-welcome" key="welcome">
          <ScanDemo />
          <h2 class="ob-headline">{pt.onboarding.welcomeTitle}</h2>
          <p class="ob-sub">{pt.onboarding.welcomeText}</p>
          <input
            class="ob-input"
            type="text"
            value={name}
            maxLength={24}
            autocomplete="given-name"
            placeholder={pt.onboarding.namePlaceholder}
            aria-label={pt.onboarding.namePlaceholder}
            onInput={(e) => setName((e.currentTarget as HTMLInputElement).value)}
          />
          <button class="btn btn-primary btn-block" onClick={() => setStep('whose')}>
            {pt.onboarding.start}
          </button>
        </div>
      )}

      {step === 'whose' && (
        <div class="ob-step" key="whose">
          <h2 class="ob-headline">{pt.onboarding.whoseTitle(cleanName)}</h2>
          <div class="ob-choices">
            <button class="ob-choice" onClick={() => finish('scan')}>
              <span class="ob-choice-emoji" aria-hidden="true">
                📷
              </span>
              <span class="ob-choice-body">
                <span class="ob-choice-label">{pt.onboarding.whoseMine}</span>
                <span class="ob-choice-sub">{pt.onboarding.whoseMineSub}</span>
              </span>
            </button>
            <button class="ob-choice" onClick={() => setStep('list')}>
              <span class="ob-choice-emoji" aria-hidden="true">
                🔄
              </span>
              <span class="ob-choice-body">
                <span class="ob-choice-label">{pt.onboarding.whoseOther}</span>
                <span class="ob-choice-sub">{pt.onboarding.whoseOtherSub}</span>
              </span>
            </button>
          </div>
        </div>
      )}

      {step === 'list' && (
        <div class="ob-step" key="list">
          <h2 class="ob-headline">{pt.onboarding.listTitle}</h2>
          <p class="ob-sub">{pt.onboarding.listText}</p>
          <div class="ob-choices">
            <button class="ob-choice" onClick={() => setStep('paste')}>
              <span class="ob-choice-emoji" aria-hidden="true">
                📋
              </span>
              <span class="ob-choice-body">
                <span class="ob-choice-label">{pt.onboarding.listYes}</span>
                <span class="ob-choice-sub">{pt.onboarding.listYesSub}</span>
              </span>
            </button>
            <button class="ob-choice" onClick={() => finish('conferir')}>
              <span class="ob-choice-emoji" aria-hidden="true">
                🔍
              </span>
              <span class="ob-choice-body">
                <span class="ob-choice-label">{pt.onboarding.listNo}</span>
                <span class="ob-choice-sub">{pt.onboarding.listNoSub}</span>
              </span>
            </button>
          </div>
        </div>
      )}

      {step === 'paste' && (
        <div class="ob-step ob-paste" key="paste">
          <h2 class="ob-headline">{pt.onboarding.pasteTitle}</h2>
          <p class="ob-sub">{pt.onboarding.pasteText}</p>
          <textarea
            class="ob-textarea"
            value={paste}
            placeholder={pt.onboarding.pastePlaceholder}
            aria-label={pt.onboarding.pasteTitle}
            onInput={(e) => setPaste((e.currentTarget as HTMLTextAreaElement).value)}
          />
          <p class={`ob-paste-hint${pasteCodes.length ? ' is-ok' : ''}`} aria-live="polite">
            {paste.trim()
              ? pasteCodes.length
                ? pt.onboarding.pasteRecognized(pasteCodes.length)
                : pt.onboarding.pasteNone
              : ''}
          </p>
          <button
            class="btn btn-primary btn-block"
            disabled={pasteCodes.length === 0}
            onClick={() => finish('conferir', pasteCodes)}
          >
            {pt.onboarding.pasteLoad}
          </button>
          <button class="link-btn" onClick={() => finish('conferir')}>
            {pt.onboarding.pasteSkip}
          </button>
        </div>
      )}
    </div>
  );
}
