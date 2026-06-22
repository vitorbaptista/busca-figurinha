// src/ui/screens/ConferirReportScreen.tsx
import { useState } from 'preact/hooks';
import type { CollectionStore } from '../../types';
import type { PileReport } from '../../domain/pileSession';
import { pt } from '../../i18n/pt';
import { checklist } from '../../data/checklist';
import { pileShareTextFor, sharePile } from '../../domain/pileShare';
import { QrCode } from '../components/QrCode';

interface ConferirReportScreenProps {
  report: PileReport;
  collection: CollectionStore;
  /** Sender's name for the share message (already sanitized; undefined = anonymous). */
  name?: string;
  onBack: () => void;
}

/**
 * The Conferir finish step ("Terminar"), symmetric to the album's ReportScreen. Reviews which
 * scanned stickers you actually TOOK, marks them owned, then transitions to a full-screen done
 * state whose hero is the friend's-album QR code — so handing the phone back is one tap.
 */
export function ConferirReportScreen({ report, collection, name, onBack }: ConferirReportScreenProps) {
  const { taken, wholePile } = report;
  // Take-mine rows default checked; the user un-checks any they didn't actually take.
  const [checked, setChecked] = useState<Set<string>>(() => new Set(taken.map((e) => e.code)));
  // What was actually saved this session — excluded from the share QR (you took those dupes).
  const [savedTaken, setSavedTaken] = useState<Set<string>>(() => new Set());
  const [done, setDone] = useState(false);
  const [shareNotice, setShareNotice] = useState<string | null>(null);

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
  };

  /** Single handler for the primary CTA: save (when there's something to save) + flip to done. */
  const finalize = () => {
    save();
    // One-shot snapshot — the QR renders with this savedTaken. When taken.length === 0,
    // savedTaken stays empty → the QR encodes the whole pile (correct: you took nothing).
    setSavedTaken(new Set(checked));
    setDone(true);
  };

  const shareAlbum = async () => {
    const result = await sharePile(wholePile, [...savedTaken], checklist, name);
    if (result === 'copied') setShareNotice(pt.pile.shareCopied);
    else if (result === 'unavailable') setShareNotice(pt.pile.shareFail);
  };

  // ── Done state ──────────────────────────────────────────────────────────────
  if (done) {
    const { link } = pileShareTextFor(wholePile, [...savedTaken], checklist, name);
    return (
      <div class="screen report-screen conferir-report-screen">
        <div class="conferir-album-done">
          <h2 class="conferir-album-done-title">{pt.conferir.albumDoneTitle}</h2>
          <p class="conferir-album-done-lead">{pt.conferir.albumDoneLead(wholePile.length)}</p>
          <div class="trade-qr conferir-album-qr">
            <QrCode value={link} ariaLabel={pt.pile.qrAria} class="trade-qr-svg" />
          </div>
          {shareNotice && (
            <p class="conferir-album-notice" role="status" aria-live="polite">
              {shareNotice}
            </p>
          )}
          <button class="btn btn-primary btn-block" onClick={onBack}>
            {pt.conferir.albumDoneCta}
          </button>
          <button class="btn-wa" onClick={shareAlbum}>
            📲 {pt.pile.shareWhats}
          </button>
        </div>
      </div>
    );
  }

  // ── Review state ─────────────────────────────────────────────────────────────
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
        <button
          class="btn btn-primary btn-block"
          disabled={taken.length > 0 && checked.size === 0}
          onClick={finalize}
        >
          {taken.length > 0 ? pt.conferir.reviewSave(checked.size) : pt.conferir.showAlbumCta}
        </button>
        <button class="btn btn-ghost btn-block" onClick={onBack}>
          {pt.conferir.back}
        </button>
      </div>
    </div>
  );
}
