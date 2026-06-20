import { Fragment } from 'preact';
import type { ChecklistEntry, TeamGroup } from '../../types';

interface AlbumGridProps {
  /** Teams to render (already filtered by the screen's search). */
  teams: TeamGroup[];
  /** Is this sticker "on" (owned / marked-as-repeat)? */
  isOn: (code: string) => boolean;
  onToggle: (code: string) => void;
  /** Chip class when on (e.g. 'chip-owned' green, or 'chip-repeat' orange). Off is always dashed. */
  onClass: string;
  /** Per-sticker aria-label. */
  ariaLabel: (entry: ChecklistEntry, on: boolean) => string;
  /** Per-team count text on the right of the team head (e.g. "18/20" or "3"). */
  teamCount: (onInTeam: number, total: number) => string;
  /** Marks the team head "complete" (green) — collection only; repeats pass () => false. */
  isTeamComplete: (onInTeam: number, total: number) => boolean;
}

/** The album-as-grid: every team expanded, a "Grupo X" header before each group's first team, and a
 *  tappable chip per sticker. Shared by Coleção (toggles owned) and Repetidas (toggles repeats) so the
 *  two screens stay in lockstep. Pure presentational — the screen owns the store + search state. */
export function AlbumGrid({
  teams,
  isOn,
  onToggle,
  onClass,
  ariaLabel,
  teamCount,
  isTeamComplete,
}: AlbumGridProps) {
  return (
    <ul class="team-list">
      {teams.map((team, i) => {
        const onInTeam = team.entries.filter((e) => isOn(e.code)).length;
        const showGroupHeader = !!team.group && team.group !== teams[i - 1]?.group;
        const countText = teamCount(onInTeam, team.entries.length);
        return (
          <Fragment key={team.teamCode}>
            {showGroupHeader && (
              <li class="group-header" aria-hidden="true">
                Grupo {team.group}
              </li>
            )}
            <li class="team">
              <div class="team-head team-head-static">
                <span class="team-name">{team.teamName}</span>
                {countText && (
                  <span
                    class={`team-progress ${isTeamComplete(onInTeam, team.entries.length) ? 'is-complete' : ''}`}
                  >
                    {countText}
                  </span>
                )}
              </div>

              <div class="chip-grid">
                {team.entries.map((e) => {
                  const on = isOn(e.code);
                  const numberLabel = e.number === 0 ? '00' : String(e.number);
                  return (
                    <button
                      key={e.code}
                      class={`chip ${on ? onClass : 'chip-needed'}`}
                      onClick={() => onToggle(e.code)}
                      aria-pressed={on}
                      aria-label={ariaLabel(e, on)}
                    >
                      {numberLabel}
                    </button>
                  );
                })}
              </div>
            </li>
          </Fragment>
        );
      })}
    </ul>
  );
}
