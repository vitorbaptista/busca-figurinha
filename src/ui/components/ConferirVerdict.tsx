import { pt } from '../../i18n/pt';
import type { HuntVerdict } from '../../domain/friendMatch';

export interface ConferirVerdictState {
  /** 'unknown' = couldn't read (NÃO LI); the rest mirror HuntVerdict.kind. */
  kind: HuntVerdict['kind'] | 'unknown';
  /** Display code, e.g. "CIV 12" (empty for unknown). */
  display: string;
  /** Team name shown under the code. */
  teamName: string;
  /** Saved friends this sticker serves — drives the "serve pro João" ribbon. */
  forFriends: string[];
  /** Bumped each read so a repeated identical verdict still re-triggers the animation. */
  key: number;
}

/**
 * The Conferir verdict — the hero of the "check the other person's pile" scanner. Trade-framed:
 * PEGA! (take it) vs DEIXA (skip), with a sub-line saying for-whom. A separate component from the
 * album scanner's Verdict (which has no "owned-but-a-friend-needs-it" outcome). Meaning is carried by
 * text + icon + shape, never colour alone.
 */
export function ConferirVerdict({ state, onManual }: { state: ConferirVerdictState; onManual: () => void }) {
  const { kind, display, teamName, forFriends } = state;

  if (kind === 'unknown') {
    return (
      <div key={state.key} class="conferir-verdict cv-miss" role="status">
        <div class="cv-head">
          <span class="cv-mark" aria-hidden="true">
            ?
          </span>
          <div class="cv-word">{pt.scan.missWord}</div>
        </div>
        <div class="cv-body">
          <span class="cv-sub">{pt.scan.missSub}</span>
          <button class="miss-action" type="button" onClick={onManual}>
            📝 {pt.scan.manualOpen}
          </button>
        </div>
      </div>
    );
  }

  if (kind === 'skip') {
    return (
      <div key={state.key} class="conferir-verdict cv-skip" role="status">
        <div class="cv-head">
          <span class="cv-mark" aria-hidden="true">
            ✕
          </span>
          <div class="cv-word">{pt.conferir.skipWord}</div>
        </div>
        <div class="cv-body">
          {display && <span class="cv-code">{display}</span>}
          {teamName && <span class="cv-team">{teamName}</span>}
          <span class="cv-sub">{pt.conferir.skipSub}</span>
        </div>
      </div>
    );
  }

  // take-mine | take-friends — both are a GRAB; the sub-line + ribbon say for-whom.
  const friendsRibbon = forFriends.length > 0 && (
    <div class="cv-radar" role="note">
      📌 {pt.scan.radarServes(forFriends)}
    </div>
  );
  return (
    <div key={state.key} class={`conferir-verdict cv-take cv-${kind}`} role="status">
      <div class="cv-head">
        <span class="cv-mark" aria-hidden="true">
          ✓
        </span>
        <div class="cv-word">{pt.conferir.takeWord}</div>
      </div>
      <div class="cv-body">
        {display && <span class="cv-code">{display}</span>}
        {teamName && <span class="cv-team">{teamName}</span>}
        <span class="cv-sub">
          {kind === 'take-mine' ? pt.conferir.takeMineSub : pt.conferir.takeFriendsSub}
        </span>
      </div>
      {friendsRibbon}
    </div>
  );
}
