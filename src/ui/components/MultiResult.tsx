import { pt } from '../../i18n/pt';

export interface ScanResultItem {
  code: string;
  display: string;
  teamName: string;
  outcome: 'needed' | 'owned';
}

/**
 * Result panel shown when several sticker backs are recognized in one capture.
 * Each row is glanceable on its own (icon + colour + word), so a kid sorting a
 * pile can see at once which to keep. The single-sticker case uses the verdict card.
 */
export function MultiResult({ items }: { items: ScanResultItem[] }) {
  const needed = items.filter((i) => i.outcome === 'needed').length;

  return (
    <div class="multi-result" role="status">
      <div class="multi-head">
        <span class="multi-count">{items.length}</span>
        <span>{pt.scan.multiTitle(items.length)}</span>
        <span class="multi-sub">
          {needed > 0 ? pt.scan.multiNeeded(needed) : pt.scan.multiNoneNeeded}
        </span>
      </div>

      <ul class="multi-list">
        {items.map((it) => (
          <li key={it.code} class={`multi-row multi-${it.outcome}`}>
            <span class="multi-mark" aria-hidden="true">
              {it.outcome === 'needed' ? '✅' : '🔁'}
            </span>
            <span class="multi-code">{it.display}</span>
            <span class="multi-team">{it.teamName}</span>
            <span class="multi-tag">{it.outcome === 'needed' ? pt.scan.keep : pt.scan.have}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
