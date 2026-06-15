import { Fragment } from 'preact';
import { useMemo, useState } from 'preact/hooks';
import type { CollectionStore, TeamGroup } from '../../types';
import { checklist } from '../../data/checklist';
import { pt } from '../../i18n/pt';
import { useStore } from '../hooks';
import { ProgressBar } from '../components/ProgressBar';

interface CollectionScreenProps {
  collection: CollectionStore;
}

export function CollectionScreen({ collection }: CollectionScreenProps) {
  useStore(collection);

  const [query, setQuery] = useState('');

  const owned = collection.codes();
  const total = checklist.total;
  const pct = total === 0 ? 0 : Math.round((owned.size / total) * 100);

  const teams = useMemo(() => filterTeams(checklist.teams, query), [query]);

  return (
    <div class="screen collection-screen">
      <header class="collection-header">
        <div class="collection-progress-row">
          <h1>{pt.collection.title}</h1>
          <span class="collection-count">{pt.collection.progress(owned.size, total)}</span>
        </div>
        <ProgressBar value={total === 0 ? 0 : owned.size / total} />
        <div class="collection-percent">
          {owned.size >= total ? pt.collection.complete : `${pct}%`}
        </div>
        <input
          class="search-input"
          type="search"
          placeholder={pt.collection.searchPlaceholder}
          value={query}
          onInput={(e) => setQuery((e.currentTarget as HTMLInputElement).value)}
        />
      </header>

      {teams.length === 0 ? (
        <p class="collection-empty">{pt.collection.noResults}</p>
      ) : (
        <ul class="team-list">
          {teams.map((team, i) => {
            const ownedInTeam = team.entries.filter((e) => owned.has(e.code)).length;
            // A "Grupo X" header before the first team of each group, mirroring the album.
            const showGroupHeader = !!team.group && team.group !== teams[i - 1]?.group;
            return (
              <Fragment key={team.teamCode}>
                {showGroupHeader && (
                  <li class="group-header" aria-hidden="true">
                    Grupo {team.group}
                  </li>
                )}
                <li class="team">
                {/* Every team stays expanded — no accordion — so you can tick stickers off
                    straight down the list while looking at the album. */}
                <div class="team-head team-head-static">
                  <span class="team-name">{team.teamName}</span>
                  <span
                    class={`team-progress ${ownedInTeam === team.entries.length ? 'is-complete' : ''}`}
                  >
                    {pt.collection.teamProgress(ownedInTeam, team.entries.length)}
                  </span>
                </div>

                <div class="chip-grid">
                  {team.entries.map((e) => {
                    const has = owned.has(e.code);
                    const numberLabel = e.number === 0 ? '00' : String(e.number);
                    return (
                      <button
                        key={e.code}
                        class={`chip ${has ? 'chip-owned' : 'chip-needed'}`}
                        onClick={() => collection.toggle(e.code)}
                        aria-pressed={has}
                        aria-label={`${e.display} ${has ? 'na coleção' : 'falta'}`}
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
      )}
    </div>
  );
}

/** Filter teams by team name or by code/display of any entry. */
function filterTeams(teams: TeamGroup[], query: string): TeamGroup[] {
  const q = query.trim().toUpperCase();
  if (!q) return teams;
  const qNorm = q.replace(/\s+/g, '');
  return teams.filter((team) => {
    if (team.teamName.toUpperCase().includes(q) || team.teamCode.includes(qNorm)) return true;
    return team.entries.some(
      (e) => e.code.includes(qNorm) || e.display.toUpperCase().includes(q),
    );
  });
}
