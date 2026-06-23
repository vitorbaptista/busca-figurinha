import { useMemo, useState } from 'preact/hooks';
import { checklist } from '../../data/checklist';
import { parseImport } from '../../domain/importList';
import { pt } from '../../i18n/pt';

/**
 * "Importar a lista do amigo" — the Conferir paste flow (the pen's "Colar lista"). Unlike the album's
 * ImportSheet (which writes to the collection/wishlist), this has ONE input and never persists: it just
 * recognizes the codes the FRIEND has and hands them to `onLoad`, which the Conferir screen feeds into
 * the live pile scan (so Novas/Repetidas update, then you keep scanning). parseImport is cheap
 * string/regex work (not OCR), so it's safe to run per keystroke for the live "Carregar N" count.
 */
export function FriendImportSheet({
  onClose,
  onLoad,
}: {
  onClose: () => void;
  /** The recognized checklist codes from the pasted list (the friend's pile). */
  onLoad: (codes: string[]) => void;
}) {
  const [text, setText] = useState('');
  const parsed = useMemo(() => parseImport(text, checklist), [text]);

  return (
    <div class="import-overlay" role="dialog" aria-modal="true" aria-label={pt.friendImport.title}>
      <div class="import-card">
        <header class="import-head">
          <h2>{pt.friendImport.title}</h2>
          <button class="import-close" onClick={onClose} aria-label={pt.friendImport.close}>
            ✕
          </button>
        </header>
        <p class="import-lead">{pt.friendImport.lead}</p>

        <textarea
          class="import-textarea"
          value={text}
          aria-label={pt.friendImport.title}
          placeholder={pt.friendImport.placeholder}
          onInput={(e) => setText((e.currentTarget as HTMLTextAreaElement).value)}
        />
        <button
          class="btn btn-primary btn-block"
          disabled={parsed.codes.length === 0}
          onClick={() => onLoad(parsed.codes)}
        >
          {parsed.codes.length === 0
            ? pt.friendImport.load
            : pt.friendImport.loadCount(parsed.codes.length)}
        </button>
      </div>
    </div>
  );
}
