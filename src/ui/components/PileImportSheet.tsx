import { useRef, useState } from 'preact/hooks';
import type { CollectionStore } from '../../types';
import { sanitizeName } from '../../domain/name';
import { pt } from '../../i18n/pt';

/** Receiver side of the viral pile link (`?p=`): a friend scanned my pile and sent me the codes.
 *  On confirm they land in BOTH my owned collection AND my repeats (spare-implies-ownership — the
 *  same "tenho" mechanic as the trade receiver). Consent-gated: nothing is written until I tap add. */
export function PileImportSheet({
  codes,
  fromName,
  collection,
  repeats,
  onClose,
}: {
  codes: string[];
  /** The sharer's name (optional) — greets the receiver ("João escaneou suas figurinhas!"). */
  fromName?: string;
  collection: CollectionStore;
  repeats: CollectionStore;
  onClose: () => void;
}) {
  const [done, setDone] = useState(false);
  // Latch so a synchronous double-tap can't run the import twice across the `await` below.
  const busy = useRef(false);
  // Sanitize the RECEIVED name (a hand-crafted ?p= link could carry a huge/control-char name) —
  // same helper that cleans our own outgoing name. Reused for the title + aria-label.
  const from = sanitizeName(fromName ?? '') || undefined;

  const add = async () => {
    if (busy.current || done) return;
    busy.current = true;
    // Wait for the stores to hydrate from IndexedDB BEFORE writing — otherwise a write that races
    // hydration would persist only the imported codes and the later in-memory merge wouldn't be
    // re-persisted, dropping an existing user's saved collection (same gate TradeScreen uses).
    await Promise.all([collection.ready, repeats.ready]);
    // owned + repeats in one shot. A code seen in a hand-pile is owned (collection) and, being in a
    // trade pile, a spare (repeats) — exactly what the trade receiver's "tenho" does.
    collection.setOwned(codes, true);
    repeats.setOwned(codes, true);
    setDone(true);
  };

  if (done) {
    return (
      <div class="name-overlay" role="dialog" aria-modal="true" aria-label={pt.pile.importDoneTitle}>
        <div class="name-card pile-import-card">
          <div class="report-done-emoji" aria-hidden="true">
            🎉
          </div>
          <h2>{pt.pile.importDoneTitle}</h2>
          <p>{pt.pile.importDoneLead}</p>
          <button class="btn btn-primary btn-block" onClick={onClose}>
            {pt.pile.importDoneCta}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      class="name-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={pt.pile.importTitle(from)}
    >
      <div class="name-card pile-import-card">
        <h2>{pt.pile.importTitle(from)}</h2>
        <p>{pt.pile.importLead(codes.length)}</p>
        <button class="btn btn-primary btn-block" onClick={add}>
          {pt.pile.importAdd(codes.length)}
        </button>
        <button class="link-btn name-skip" onClick={onClose}>
          {pt.pile.importSkip}
        </button>
      </div>
    </div>
  );
}
