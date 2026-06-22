import { useState } from 'preact/hooks';
import type { CollectionStore } from '../types';
import { pt } from '../i18n/pt';
import { sanitizeName } from '../domain/name';
import { ScanDemo } from './components/ScanDemo';
import { ImportSheet } from './components/ImportSheet';

/** What the first-run flow learned about the user, handed back to app.tsx to seed state + route. */
export interface OnboardingResult {
  /** First name / nickname, signed into share links. Absent if the user skipped the field. */
  name?: string;
  /** Where to drop the user: their own pile (Escanear) or someone else's (Conferir). */
  start: 'scan' | 'conferir';
}

type Step = 'welcome' | 'whose' | 'list';

const PREV: Record<Step, Step> = {
  welcome: 'welcome',
  whose: 'welcome',
  list: 'whose',
};

/** First-run onboarding: prove the value (a looping live-scan demo), ask only the first name, then
 *  route the user to the right starting point — their own pile (Escanear) or another person's
 *  (Conferir). On the "outra pessoa" branch they can first paste a list via the real Importar sheet
 *  (Tenho → coleção, Preciso → wants) and then go straight to scanning. Replaces the old carousel. */
export function Onboarding({
  collection,
  repeats,
  wants,
  onComplete,
  defaultName,
}: {
  collection: CollectionStore;
  repeats: CollectionStore;
  wants: CollectionStore;
  onComplete: (result: OnboardingResult) => void;
  /** Pre-fills the name field — so replaying the tutorial from Ajustes keeps the existing name. */
  defaultName?: string;
}) {
  const [step, setStep] = useState<Step>('welcome');
  const [name, setName] = useState(defaultName ?? '');
  // The "Tenho a lista" branch opens the real Importar sheet (it writes to the stores itself).
  const [importing, setImporting] = useState(false);

  // Sanitize at the source so the name written to settings (and signed into share links) matches what
  // the rest of the app produces (Ajustes/Trocar route through the same sanitizeName: strips
  // zero-width/control chars, collapses whitespace, caps at 24).
  const cleanName = sanitizeName(name);
  const finish = (start: 'scan' | 'conferir') => onComplete({ name: cleanName || undefined, start });

  return (
    <div class="onboarding">
      {step !== 'welcome' && !importing && (
        <button class="onboarding-back" onClick={() => setStep(PREV[step])}>
          ← {pt.onboarding.back}
        </button>
      )}
      {!importing && (
        <button class="onboarding-skip" onClick={() => finish('scan')}>
          {pt.onboarding.skip}
        </button>
      )}

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
            <button class="ob-choice" onClick={() => setImporting(true)}>
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

      {/* The real "Importar a lista" sheet, reused: paste → Tenho (coleção) / Preciso (wants), with a
          real "achei N" confirmation, then "Bora escanear!" drops into the scanner. The ✕ cancels back
          to the list question. It writes to the stores itself, so onComplete only routes. */}
      {importing && (
        <ImportSheet
          collection={collection}
          repeats={repeats}
          wants={wants}
          onClose={() => setImporting(false)}
          onProceed={() => finish('conferir')}
          proceedLabel={pt.onboarding.importProceed}
        />
      )}
    </div>
  );
}
