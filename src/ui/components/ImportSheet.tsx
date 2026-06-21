import { useState } from 'preact/hooks';
import type { CollectionStore } from '../../types';
import { checklist } from '../../data/checklist';
import { importPreview, parseImport, type ImportResult } from '../../domain/importList';
import { pt } from '../../i18n/pt';

/** The "Importar a lista de outro app" flow (a paste from a friend's WhatsApp / another album app):
 *  paste + choose a destination bucket → preview the recognized count → merge. "Tenho" lands in the
 *  collection (owned); "Preciso" lands in the wishlist (wants). Neither touches repeats, so an import
 *  can never create a tradeable spare — 0 false positives by construction. */
type Step =
  | { phase: 'paste' }
  | { phase: 'preview'; result: ImportResult; newCodes: string[]; alreadyHad: number }
  | { phase: 'done'; added: number };

export function ImportSheet({
  collection,
  wants,
  onClose,
}: {
  collection: CollectionStore;
  /** The wishlist store — destination for the "Preciso" bucket. */
  wants: CollectionStore;
  onClose: () => void;
}) {
  const [bucket, setBucket] = useState<'have' | 'need'>('have');
  const [text, setText] = useState('');
  const [step, setStep] = useState<Step>({ phase: 'paste' });

  const target = () => (bucket === 'have' ? collection : wants);

  const pasteFromClipboard = async () => {
    try {
      const clip = await navigator.clipboard.readText();
      if (clip) setText(clip);
    } catch {
      /* clipboard blocked (permissions / no https) — the user can paste into the textarea by hand. */
    }
  };

  const load = () => {
    const result = parseImport(text, checklist);
    const { newCodes, alreadyHad } = importPreview(result.codes, target().codes());
    setStep({ phase: 'preview', result, newCodes, alreadyHad });
  };

  const confirm = (preview: { newCodes: string[] }) => {
    const store = target();
    for (const code of preview.newCodes) store.add(code);
    setStep({ phase: 'done', added: preview.newCodes.length });
  };

  const reset = () => {
    setText('');
    setStep({ phase: 'paste' });
  };

  return (
    <div class="import-overlay" role="dialog" aria-modal="true" aria-label={pt.importList.title}>
      <div class="import-card">
        {step.phase === 'paste' && (
          <>
            <header class="import-head">
              <h2>{pt.importList.title}</h2>
              <button class="import-close" onClick={onClose} aria-label={pt.importList.close}>
                ✕
              </button>
            </header>
            <p class="import-lead">{pt.importList.lead}</p>

            <div class="import-bucket" role="radiogroup" aria-label={pt.importList.bucketLabel}>
              <button
                class={`import-bucket-btn${bucket === 'have' ? ' is-on' : ''}`}
                role="radio"
                aria-checked={bucket === 'have'}
                onClick={() => setBucket('have')}
              >
                ✓ {pt.importList.bucketHave}
              </button>
              <button
                class={`import-bucket-btn${bucket === 'need' ? ' is-on' : ''}`}
                role="radio"
                aria-checked={bucket === 'need'}
                onClick={() => setBucket('need')}
              >
                {pt.importList.bucketNeed}
              </button>
            </div>

            <textarea
              class="import-textarea"
              value={text}
              placeholder={pt.importList.placeholder}
              onInput={(e) => setText((e.currentTarget as HTMLTextAreaElement).value)}
            />
            <button class="btn btn-ghost btn-block" onClick={pasteFromClipboard}>
              📋 {pt.importList.pasteClipboard}
            </button>
            <button
              class="btn btn-primary btn-block"
              disabled={text.trim().length === 0}
              onClick={load}
            >
              {pt.importList.load}
            </button>
          </>
        )}

        {step.phase === 'preview' && (
          <>
            <header class="import-head">
              <h2>{pt.importList.previewTitle}</h2>
              <button class="import-close" onClick={onClose} aria-label={pt.importList.close}>
                ✕
              </button>
            </header>

            {step.result.codes.length === 0 ? (
              <div class="import-preview-empty">
                <span class="import-big" aria-hidden="true">
                  🤔
                </span>
                <p>{pt.importList.previewNone}</p>
                <button class="btn btn-primary btn-block" onClick={reset}>
                  {pt.importList.back}
                </button>
              </div>
            ) : (
              <>
                <div class="import-stat">
                  <span class="import-big">{step.result.codes.length}</span>
                  <span class="import-stat-label">{pt.importList.recognized}</span>
                  <span class="import-dest">
                    {bucket === 'have' ? pt.importList.destHave : pt.importList.destNeed}
                  </span>
                </div>
                {step.alreadyHad > 0 && (
                  <p class="import-note">{pt.importList.alreadyHad(step.alreadyHad)}</p>
                )}
                {step.result.unrecognized.length > 0 && (
                  <p class="import-note import-note-skip">
                    {pt.importList.skipped(step.result.unrecognized.length)}
                  </p>
                )}
                <button
                  class="btn btn-primary btn-block"
                  disabled={step.newCodes.length === 0}
                  onClick={() => confirm(step)}
                >
                  {step.newCodes.length === 0
                    ? pt.importList.nothingNew
                    : pt.importList.add(step.newCodes.length)}
                </button>
                <button class="link-btn" onClick={reset}>
                  {pt.importList.back}
                </button>
              </>
            )}
          </>
        )}

        {step.phase === 'done' && (
          <div class="import-done">
            <span class="import-check" aria-hidden="true">
              ✓
            </span>
            <h2>{pt.importList.doneTitle}</h2>
            <p>
              {bucket === 'have'
                ? pt.importList.doneHave(step.added)
                : pt.importList.doneNeed(step.added)}
            </p>
            <button class="btn btn-primary btn-block" onClick={onClose}>
              {pt.importList.seeCollection}
            </button>
            <button class="link-btn" onClick={reset}>
              {pt.importList.another}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
