import { useState } from 'preact/hooks';
import { checklist } from '../../data/checklist';
import { sharePile, pileShareTextFor } from '../../domain/pileShare';
import { pt } from '../../i18n/pt';
import { QrCode } from './QrCode';

/** Shown from the Conferir scanner. Encodes the friend's pile into a `?p=` deep link and presents
 *  it as a QR (for in-person trading, the common case) + a WhatsApp share, so the friend opens it
 *  and the stickers land in THEIR own álbum. `pile` = everything you scanned (→ their álbum); `taken`
 *  = the ones you grabbed in the trade (excluded from THEIR repetidas — that dupe is gone). */
export function PileShareSheet({
  pile,
  taken,
  name,
  onClose,
}: {
  pile: string[];
  taken: string[];
  /** The current user's name (optional) — signs the link so the receiver is greeted by name. */
  name?: string;
  onClose: () => void;
}) {
  const [notice, setNotice] = useState<string | null>(null);
  const { link } = pileShareTextFor(pile, taken, checklist, name);

  const share = async () => {
    const result = await sharePile(pile, taken, checklist, name);
    if (result === 'copied') setNotice(pt.pile.shareCopied);
    else if (result === 'unavailable') setNotice(pt.pile.shareFail);
  };

  return (
    <div class="name-overlay" role="dialog" aria-modal="true" aria-label={pt.pile.shareTitle}>
      <div class="name-card pile-share-card">
        <h2>{pt.pile.shareTitle}</h2>
        <p>{pt.pile.shareLead(pile.length)}</p>
        <div class="trade-qr pile-share-qr">
          <QrCode value={link} ariaLabel={pt.pile.qrAria} class="trade-qr-svg" />
        </div>
        <p class="pile-share-hint">{pt.pile.qrHint}</p>
        {notice && (
          <p class="pile-share-notice" role="status" aria-live="polite">
            {notice}
          </p>
        )}
        <button class="btn-wa" onClick={share}>
          <span class="wa" aria-hidden="true">
            📲
          </span>{' '}
          {pt.pile.shareWhats}
        </button>
        <button class="link-btn name-skip" onClick={onClose}>
          {pt.pile.close}
        </button>
      </div>
    </div>
  );
}
