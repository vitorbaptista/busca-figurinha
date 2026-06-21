import { useMemo, useState } from 'preact/hooks';
import type { CollectionStore, SessionReport } from '../../types';
import { pt } from '../../i18n/pt';

/** The commit CTA's label. `commit` ALWAYS saves both the checked keepers and every scanned
 *  repeat, so when both are present the label must name both — otherwise it reads as if only
 *  the keepers (or only the repetidas) get saved, and the user un-checks the news to "reach"
 *  the repetidas. */
export function commitLabel(checkedCount: number, repeatsCount: number): string {
  if (checkedCount > 0 && repeatsCount > 0) return pt.report.addBoth(checkedCount, repeatsCount);
  if (checkedCount > 0) return pt.report.add(checkedCount);
  if (repeatsCount > 0) return pt.report.saveRepeats(repeatsCount);
  return pt.report.addEmpty;
}

interface ReportScreenProps {
  report: SessionReport;
  collection: CollectionStore;
  /** Persist the scanned duplicates as tradeable spares — committed here (not at scan finish)
   *  so it shares the same reversible "Adicionar à coleção" action and "Voltar" stays a no-op. */
  onCommitRepeats: (codes: string[]) => void;
  onCommitted: () => void;
  onBack: () => void;
}

export function ReportScreen({
  report,
  collection,
  onCommitRepeats,
  onCommitted,
  onBack,
}: ReportScreenProps) {
  const { keepers, repeats, unknowns, scannedCount } = report;

  // Keepers default to checked: the user marks which they actually traded for.
  const [checked, setChecked] = useState<Set<string>>(() => new Set(keepers.map((e) => e.code)));
  const [repeatsOpen, setRepeatsOpen] = useState(false);
  const [done, setDone] = useState(false);

  const allChecked = checked.size === keepers.length && keepers.length > 0;

  const toggle = (code: string) =>
    setChecked((prev) => {
      const next = new Set(prev);
      next.has(code) ? next.delete(code) : next.add(code);
      return next;
    });

  const toggleAll = () =>
    setChecked(allChecked ? new Set() : new Set(keepers.map((e) => e.code)));

  const commit = () => {
    collection.setOwned(checked, true);
    // Every scanned duplicate becomes a tradeable spare; the Trocar screen lets the user drop
    // any they've since traded away. Committed alongside the keepers so both stores move together.
    onCommitRepeats(repeats.map((e) => e.code));
    setDone(true);
    // Brief success state before handing back to the collection.
    window.setTimeout(onCommitted, 900);
  };

  const checkedCount = useMemo(() => checked.size, [checked]);

  if (done) {
    return (
      <div class="screen report-done">
        <div class="report-done-emoji">🎉</div>
        <h2>{checked.size > 0 ? pt.report.added : pt.report.repeatsSaved}</h2>
      </div>
    );
  }

  return (
    <div class="screen report-screen">
      <header class="report-header">
        <h1>{pt.report.title}</h1>
        <div class="report-totals">
          <div class="total-card">
            <b>{scannedCount}</b>
            <span>{pt.report.scanned}</span>
          </div>
          <div class="total-card total-keep">
            <b>{keepers.length}</b>
            <span>{pt.report.toKeep}</span>
          </div>
        </div>
      </header>

      <section class="report-section">
        <div class="report-section-head">
          <h2>{pt.report.keepersSection}</h2>
          {keepers.length > 0 && (
            <button class="link-btn" onClick={toggleAll}>
              {allChecked ? pt.report.toggleNone : pt.report.toggleAll}
            </button>
          )}
        </div>

        {keepers.length === 0 ? (
          <p class="report-empty">{pt.report.keepersEmpty}</p>
        ) : (
          <ul class="report-list">
            {keepers.map((e) => {
              const isChecked = checked.has(e.code);
              return (
                <li key={e.code}>
                  <label class={`report-row ${isChecked ? 'is-checked' : ''}`}>
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => toggle(e.code)}
                    />
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

      {repeats.length > 0 && (
        <section class="report-section">
          <button
            class="report-collapse"
            onClick={() => setRepeatsOpen((o) => !o)}
            aria-expanded={repeatsOpen}
          >
            <span>{pt.report.repeatsSection(repeats.length)}</span>
            <span class="chevron">{repeatsOpen ? '▾' : '▸'}</span>
          </button>
          {repeatsOpen && (
            <ul class="report-list report-list-muted">
              {repeats.map((e) => (
                <li key={e.code} class="report-row report-row-static">
                  <span class="report-code">{e.display}</span>
                  <span class="report-team">{e.teamName}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {unknowns.length > 0 && <p class="report-unknowns">⚠️ {pt.report.unknownsNote(unknowns.length)}</p>}

      <div class="report-footer">
        <button
          class="btn btn-primary btn-block"
          onClick={commit}
          disabled={checkedCount === 0 && repeats.length === 0}
        >
          {commitLabel(checkedCount, repeats.length)}
        </button>
        <button class="btn btn-ghost btn-block" onClick={onBack}>
          {pt.report.back}
        </button>
      </div>
    </div>
  );
}
