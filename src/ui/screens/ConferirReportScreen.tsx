// src/ui/screens/ConferirReportScreen.tsx
import { useState } from 'preact/hooks';
import type { CollectionStore } from '../../types';
import type { PileReport } from '../../domain/pileSession';
import { pt } from '../../i18n/pt';
import { PileShareSheet } from '../components/PileShareSheet';

interface ConferirReportScreenProps {
  report: PileReport;
  collection: CollectionStore;
  /** Sender's name for the share message (already sanitized; undefined = anonymous). */
  name?: string;
  onBack: () => void;
}

/**
 * The Conferir finish step ("Terminar"), symmetric to the album's ReportScreen. Two goal-appropriate
 * actions on one screen: (1) review which scanned stickers you actually TOOK in the trade → mark them
 * owned (preserving the cardinal rule: only what you physically have), and (2) share the friend's whole
 * pile back to them. Unlike ReportScreen it does NOT auto-navigate after saving — you may save AND then
 * share — so saving shows inline success and the share stays available; the only exit is "Voltar".
 */
export function ConferirReportScreen({ report, collection, name, onBack }: ConferirReportScreenProps) {
  const { taken, wholePile } = report;
  // Take-mine rows default checked; the user un-checks any they didn't actually take.
  const [checked, setChecked] = useState<Set<string>>(() => new Set(taken.map((e) => e.code)));
  // What was actually saved this session — excluded from the share (you took those dupes).
  const [savedTaken, setSavedTaken] = useState<Set<string>>(() => new Set());
  const [savedMsg, setSavedMsg] = useState<string | null>(null);
  const [shareOpen, setShareOpen] = useState(false);

  const toggle = (code: string) =>
    setChecked((prev) => {
      const next = new Set(prev);
      next.has(code) ? next.delete(code) : next.add(code);
      return next;
    });

  const save = () => {
    const codes = [...checked];
    if (codes.length === 0) return;
    collection.setOwned(codes, true);
    setSavedTaken((s) => new Set([...s, ...codes]));
    setSavedMsg(pt.conferir.saved(codes.length));
  };

  return (
    <div class="screen report-screen conferir-report-screen">
      <header class="report-header">
        <h1>{pt.conferir.finishTitle}</h1>
        <div class="report-totals">
          <div class="total-card">
            <b>{wholePile.length}</b>
            <span>{pt.conferir.finishPileCount}</span>
          </div>
          <div class="total-card total-keep">
            <b>{taken.length}</b>
            <span>{pt.conferir.finishTakeCount}</span>
          </div>
        </div>
      </header>

      <section class="report-section">
        <div class="report-section-head">
          <h2>{pt.conferir.reviewTitle}</h2>
        </div>
        <p class="report-sub">{pt.conferir.reviewSub}</p>
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
        {savedMsg && (
          <div class="conferir-notice" role="status" aria-live="polite">
            {savedMsg}
          </div>
        )}
        {taken.length > 0 && (
          <button class="btn btn-primary btn-block" disabled={checked.size === 0} onClick={save}>
            {pt.conferir.reviewSave(checked.size)}
          </button>
        )}
        {wholePile.length > 0 && (
          <button class="btn btn-secondary btn-block" onClick={() => setShareOpen(true)}>
            {pt.pile.shareCta}
          </button>
        )}
        <button class="btn btn-ghost btn-block" onClick={onBack}>
          {pt.conferir.back}
        </button>
      </div>

      {shareOpen && (
        <PileShareSheet
          pile={wholePile}
          taken={[...savedTaken]}
          name={name}
          onClose={() => setShareOpen(false)}
        />
      )}
    </div>
  );
}
