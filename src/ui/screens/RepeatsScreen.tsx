import { useMemo, useState } from 'preact/hooks';
import type { CollectionStore } from '../../types';
import { checklist } from '../../data/checklist';
import { pt } from '../../i18n/pt';
import { useStickyOffset, useStore } from '../hooks';
import { AlbumGrid } from '../components/AlbumGrid';
import { filterTeams } from './CollectionScreen';

interface RepeatsScreenProps {
  /** Owned set — marking a repeat ensures the sticker is owned (see toggleRepeat). */
  collection: CollectionStore;
  /** The tradeable-spares set this screen edits. */
  repeats: CollectionStore;
  onBack: () => void;
}

/** Manual editor for your tradeable spares: the same album-as-grid as Coleção, but a tap toggles
 *  whether a sticker is a REPEAT (orange) instead of owned (green). Reached from the Trocar screen. */
export function RepeatsScreen({ collection, repeats, onBack }: RepeatsScreenProps) {
  useStore(collection);
  useStore(repeats);

  const [query, setQuery] = useState('');
  const marked = repeats.codes();
  const teams = useMemo(() => filterTeams(checklist.teams, query), [query]);

  // Measure the pinned header so the "Grupo X" labels can pin flush below it as you scroll.
  const headerRef = useStickyOffset();

  // Marking a repeat implies you own the sticker — you can't have a spare of one you don't have — so
  // also add it to the collection. That keeps it from becoming a "ghost" the Trocar screen hides
  // (Trocar offers repeats ∩ owned). Un-marking leaves the original copy owned.
  const toggleRepeat = (code: string) => {
    if (repeats.has(code)) {
      repeats.remove(code);
    } else {
      repeats.add(code);
      collection.add(code);
    }
  };

  return (
    <div class="screen collection-screen">
      <header class="collection-header" ref={headerRef}>
        <button class="trade-back" onClick={onBack}>
          ← {pt.repeatsScreen.back}
        </button>
        <div class="collection-progress-row">
          <h1>{pt.repeatsScreen.title}</h1>
          <span class="collection-count">{pt.repeatsScreen.count(marked.size)}</span>
        </div>
        <p class="repeats-hint">{pt.repeatsScreen.hint}</p>
        <input
          class="search-input"
          type="search"
          placeholder={pt.repeatsScreen.searchPlaceholder}
          value={query}
          onInput={(e) => setQuery((e.currentTarget as HTMLInputElement).value)}
        />
      </header>

      {teams.length === 0 ? (
        <p class="collection-empty">{pt.repeatsScreen.noResults}</p>
      ) : (
        <AlbumGrid
          teams={teams}
          isOn={(code) => marked.has(code)}
          onToggle={toggleRepeat}
          onClass="chip-repeat"
          ariaLabel={(e, on) =>
            `${e.display} ${on ? pt.repeatsScreen.onLabel : pt.repeatsScreen.offLabel}`
          }
          teamCount={(n) => pt.repeatsScreen.teamCount(n)}
          isTeamComplete={() => false}
        />
      )}
    </div>
  );
}
