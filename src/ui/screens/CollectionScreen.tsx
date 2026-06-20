import { useMemo, useState } from 'preact/hooks';
import type { CollectionStore, TeamGroup } from '../../types';
import { checklist } from '../../data/checklist';
import { pt } from '../../i18n/pt';
import { useStore } from '../hooks';
import { ProgressBar } from '../components/ProgressBar';
import { AlbumGrid } from '../components/AlbumGrid';

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
        // Every team stays expanded — no accordion — so you tick stickers off straight down the list.
        <AlbumGrid
          teams={teams}
          isOn={(code) => owned.has(code)}
          onToggle={(code) => collection.toggle(code)}
          onClass="chip-owned"
          ariaLabel={(e, on) => `${e.display} ${on ? 'na coleção' : 'falta'}`}
          teamCount={(n, total) => pt.collection.teamProgress(n, total)}
          isTeamComplete={(n, total) => n === total}
        />
      )}
    </div>
  );
}

/** Filter teams by team name or by code/display of any entry. */
export function filterTeams(teams: TeamGroup[], query: string): TeamGroup[] {
  const q = normalizeSearchText(query);
  const qCode = normalizeCodeSearch(query);
  if (!q && !qCode) return teams;

  return teams.filter((team) => {
    if (normalizeSearchText(team.teamName).includes(q) || team.teamCode.includes(qCode)) {
      return true;
    }
    return team.entries.some(
      (e) => e.code.includes(qCode) || normalizeSearchText(e.display).includes(q),
    );
  });
}

function normalizeSearchText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim();
}

function normalizeCodeSearch(value: string): string {
  return normalizeSearchText(value).replace(/\s+/g, '');
}
