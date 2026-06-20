import type { ScanOutcome } from '../../types';
import { pt } from '../../i18n/pt';

export interface VerdictState {
  outcome: ScanOutcome;
  /** Canonical code, e.g. "CIV12" (empty for unknown). Used to undo a misread. */
  code: string;
  /** Display code, e.g. "CIV 12" (empty for unknown). */
  display: string;
  /** Team name shown under the code. */
  teamName: string;
  /** Bumped each time so a repeated identical outcome still re-triggers the animation. */
  key: number;
}

/**
 * The verdict — the hero of the scan screen. A print-ticket card docked at the
 * bottom of the camera that PERSISTS (it stays put until the next read replaces
 * it), unlike the old full-screen flash. GUARDAR (green) = keep, REPETIDA (red)
 * = already owned, NÃO LI (kraft) = honest miss, never a faked answer. The miss
 * card carries the manual-entry escape hatch ("Digitar o código"); GUARDAR/REPETIDA
 * carry "Não é essa?" (onWrong) to undo a confident misread before it reaches a trade.
 */
export function Verdict({
  state,
  onManual,
  onWrong,
}: {
  state: VerdictState;
  onManual: () => void;
  onWrong: () => void;
}) {
  const { outcome, display, teamName } = state;

  if (outcome === 'unknown') {
    return (
      <div key={state.key} class="verdict miss" role="status">
        <div class="verdict-head">
          <span class="verdict-mark" aria-hidden="true">
            ?
          </span>
          <div class="verdict-word">{pt.scan.missWord}</div>
        </div>
        <div class="verdict-info">
          <div class="verdict-text">
            <span class="verdict-sub">{pt.scan.missSub}</span>
            <button class="miss-action" type="button" onClick={onManual}>
              ⌨️ {pt.scan.manualOpen}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const rep = outcome === 'owned';
  return (
    <div key={state.key} class={rep ? 'verdict rep' : 'verdict'} role="status">
      <div class="verdict-head">
        <span class="verdict-mark" aria-hidden="true">
          {rep ? '✕' : '✓'}
        </span>
        <div class="verdict-word">{rep ? pt.scan.owned : pt.scan.needed}</div>
        <button
          class="verdict-wrong"
          type="button"
          onClick={onWrong}
          aria-label={pt.scan.wrongLabel}
        >
          {pt.scan.wrong}
        </button>
      </div>
      <div class="verdict-info">
        <div class="verdict-text">
          {display && <span class="verdict-code">{display}</span>}
          {teamName && <span class="verdict-team">{teamName}</span>}
          <span class="verdict-sub">{rep ? pt.scan.ownedHint : pt.scan.neededSub}</span>
        </div>
      </div>
    </div>
  );
}
