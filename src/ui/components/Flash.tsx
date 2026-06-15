import type { ScanOutcome } from '../../types';
import { pt } from '../../i18n/pt';

export interface FlashState {
  outcome: ScanOutcome;
  /** Display code, e.g. "CIV 12" (empty for unknown). */
  display: string;
  /** Team name shown under the code for keepers. */
  teamName: string;
  /** Bumped each time so repeated identical outcomes still re-trigger the animation. */
  key: number;
}

/**
 * Full-screen colored flash shown for ~1.1s after each scan.
 * Green = needed (GUARDAR), red = owned (REPETIDA), gray = unknown.
 */
export function Flash({ state }: { state: FlashState }) {
  const { outcome, display, teamName } = state;

  return (
    <div key={state.key} class={`flash flash-${outcome}`}>
      {outcome === 'needed' && (
        <div class="flash-inner">
          <div class="flash-emoji">✅</div>
          <div class="flash-verb">{pt.scan.needed}</div>
          <div class="flash-code">{display}</div>
          {teamName && <div class="flash-team">{teamName}</div>}
        </div>
      )}
      {outcome === 'owned' && (
        <div class="flash-inner">
          <div class="flash-emoji">♻️</div>
          <div class="flash-verb">{pt.scan.owned}</div>
          <div class="flash-code">{display}</div>
        </div>
      )}
      {outcome === 'unknown' && (
        <div class="flash-inner">
          <div class="flash-emoji">🤔</div>
          <div class="flash-verb-sm">{pt.scan.tryAgain}</div>
        </div>
      )}
    </div>
  );
}
