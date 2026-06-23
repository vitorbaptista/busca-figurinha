// src/ui/screens/ConferirReportScreen.tsx
import { useMemo, useState } from 'preact/hooks';
import type { CollectionStore } from '../../types';
import type { PileReport } from '../../domain/pileSession';
import { pt } from '../../i18n/pt';
import { checklist } from '../../data/checklist';
import { shareLinkFor } from '../../domain/share';
import { QrCode } from '../components/QrCode';

interface ConferirReportScreenProps {
  report: PileReport;
  collection: CollectionStore;
  /** My spares (repeats ∩ owned) go into the "pedido" trade link, so the friend also sees what he can
   *  take from me. Read-only here. */
  repeats: CollectionStore;
  /** Sender's name for the trade link (already sanitized; undefined = anonymous). */
  name?: string;
  onBack: () => void;
}

/**
 * The Conferir finish step ("Terminar"), reworked as a trade "pedido". The hero is a QR of YOUR OWN
 * trade link (?t=) — the friend scans it and lands on the regular "Trocar com {você}" receiver screen
 * (TradeScreen's FriendMatch) with the stickers you picked already under "O que falta pro {você}". You
 * confirm which of the pile you actually took (one list, pre-checked) and save those to your collection.
 * The picked set drives BOTH the QR (`missing`) and the save — one source of truth, never two lists.
 */
export function ConferirReportScreen({
  report,
  collection,
  repeats,
  name,
  onBack,
}: ConferirReportScreenProps) {
  const { taken } = report;
  // Take-mine rows default checked; the user un-checks any they didn't actually take.
  const [checked, setChecked] = useState<Set<string>>(() => new Set(taken.map((e) => e.code)));
  const [saved, setSaved] = useState(false);

  const toggle = (code: string) =>
    setChecked((prev) => {
      const next = new Set(prev);
      next.has(code) ? next.delete(code) : next.add(code);
      return next;
    });

  // The QR is YOUR trade link: `missing` = the picked pile cards (what you want from the friend), so
  // they appear under "O que falta pro {você}"; `repeats` = your spares so the friend also sees what
  // he can take. Recomputed as the selection changes.
  const link = useMemo(() => {
    const myRepeatCodes = [...repeats.codes()].filter((code) => collection.has(code));
    return shareLinkFor({ repeats: myRepeatCodes, missing: [...checked], name }, checklist);
  }, [checked, name, repeats, collection]);

  const save = () => {
    if (saved) return;
    collection.setOwned([...checked], true);
    setSaved(true);
    // Brief success, then hand back to Trocar (mirrors the album ReportScreen commit timing).
    window.setTimeout(onBack, 900);
  };

  if (saved) {
    return (
      <div class="screen report-done">
        <div class="report-done-emoji">🎉</div>
        <h2>{pt.report.added}</h2>
      </div>
    );
  }

  return (
    <div class="screen report-screen conferir-report-screen">
      <header class="report-header">
        <h1>{pt.conferir.finishTitle}</h1>
      </header>

      {/* HERO: the "pedido" QR — your trade link, pre-loaded with the picked stickers. */}
      <div class="qr-hero">
        <div class="trade-qr">
          <span class="ptag">{pt.conferir.reqPtag}</span>
          <QrCode value={link} ariaLabel={pt.conferir.reqQrAria} class="trade-qr-svg" />
          <p class="trade-qr-hint">{pt.conferir.reqCaption}</p>
          <p class="qr-tally">{pt.conferir.reqCount(checked.size)}</p>
        </div>
      </div>

      <section class="report-section">
        <div class="report-section-head">
          <h2>{pt.conferir.reqConfirmTitle}</h2>
        </div>
        <p class="report-sub">{pt.conferir.reqConfirmSub}</p>
        {taken.length === 0 ? (
          <p class="report-empty">{pt.conferir.takenEmpty}</p>
        ) : (
          <ul class="report-list">
            {taken.map((e) => {
              const isChecked = checked.has(e.code);
              return (
                <li key={e.code}>
                  <label class={`report-row ${isChecked ? 'is-checked' : ''}`}>
                    <input type="checkbox" checked={isChecked} onChange={() => toggle(e.code)} />
                    <span class="report-check" aria-hidden="true" />
                    <span class="report-code">{e.display}</span>
                    <span class="report-team">{e.teamName}</span>
                  </label>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <div class="report-footer">
        <button class="btn btn-primary btn-block" disabled={checked.size === 0} onClick={save}>
          {pt.conferir.reqSave}
        </button>
        <button class="btn btn-ghost btn-block" onClick={onBack}>
          {pt.conferir.back}
        </button>
      </div>
    </div>
  );
}
