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
  repeats,
  wants,
  onClose,
}: {
  collection: CollectionStore;
  /** The user's spares — a "Tenho" import clears any STALE repeat marker for a re-owned code (see confirm). */
  repeats: CollectionStore;
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
    if (bucket === 'have') {
      // newCodes are recognized codes the user did NOT already own, so none can be a live spare (a
      // spare must be owned). Clearing any lingering repeat marker for them in one commit means a stale
      // spare (marked-repeat then un-owned in Coleção) can't resurrect as tradeable just because the
      // import re-owns one copy — the import only proved ownership, not a duplicate. 0-FP-safe.
      repeats.setOwned(preview.newCodes, false);
      collection.setOwned(preview.newCodes, true); // single IDB write + one re-render, not N
    } else {
      wants.setOwned(preview.newCodes, true);
    }
    setStep({ phase: 'done', added: preview.newCodes.length });
  };

  // Back from the preview keeps the pasted text so the user can actually revise it; only the
  // done-screen "Colar outra lista" starts fresh.
  const back = () => setStep({ phase: 'paste' });
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

            <div class="import-bucket" role="group" aria-label={pt.importList.bucketLabel}>
              <button
                class={`import-bucket-btn${bucket === 'have' ? ' is-on' : ''}`}
                aria-pressed={bucket === 'have'}
                onClick={() => setBucket('have')}
              >
                ✓ {pt.importList.bucketHave}
              </button>
              <button
                class={`import-bucket-btn${bucket === 'need' ? ' is-on' : ''}`}
                aria-pressed={bucket === 'need'}
                onClick={() => setBucket('need')}
              >
                {pt.importList.bucketNeed}
              </button>
            </div>

            <textarea
              class="import-textarea"
              value={text}
              aria-label={pt.importList.title}
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
                <button class="btn btn-primary btn-block" onClick={back}>
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
                <button class="link-btn" onClick={back}>
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
              {bucket === 'have' ? pt.importList.seeCollection : pt.importList.doneClose}
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
