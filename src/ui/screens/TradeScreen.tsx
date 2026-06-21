import { type ComponentChildren } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import type { ChecklistEntry, CollectionStore, FriendList, SettingsStore } from '../../types';
import { checklist } from '../../data/checklist';
import { flagFor } from '../../data/flags';
import { sanitizeName } from '../../domain/name';
import { givableTo, friendGiveBreakdown, needsDiff } from '../../domain/friendMatch';
import type { FriendListsStore } from '../../state/friendLists';
import type { TradePayload } from '../../domain/tradeList';
import {
  toggleCode,
  tradeScore,
  shareBackPayload,
  prefilledHave,
  isEmptyFriendLink,
  friendDraftKey,
  serializeDraft,
  parseDraft,
} from '../../domain/friendTrade';
import {
  previewTextFor,
  copyTradeList,
  shareLinkFor,
  type ShareTradesResult,
} from '../../domain/share';
import { pt } from '../../i18n/pt';
import { useStore } from '../hooks';
import { QrCode } from '../components/QrCode';

interface TradeScreenProps {
  /** The user's owned codes (to derive what they still need). */
  collection: CollectionStore;
  /** The user's saved duplicates (tradeable spares). */
  repeats: CollectionStore;
  /** The user's wishlist (codes they want) — seeded when they tap a friend's spares on a shared link. */
  wants: CollectionStore;
  /** App settings — used here to read/capture the user's name so every shared link is signed. */
  settings: SettingsStore;
  /** Saved friend lists — to save a friend's list from their link and show "Listas de amigos". */
  friendLists: FriendListsStore;
  /** A friend's decoded list, when the user arrived via a shared ?t= link. */
  friendPayload: TradePayload | null;
  onShare: (payload: TradePayload) => Promise<ShareTradesResult>;
  /** Dismiss the friend's list and return to the user's own trade offer. */
  onClearFriend: () => void;
  /** Jump to the scanner to capture more repeats. */
  onGoScan: () => void;
  /** Open the manual repeats editor (RepeatsScreen). */
  onEditRepeats: () => void;
  /** Open the Coleção screen to edit what's still missing ("o que eu preciso"). */
  onEditNeed: () => void;
}

interface AlbumGroup {
  label: string;
  entries: ChecklistEntry[];
}

export function TradeScreen({
  collection,
  repeats,
  wants,
  settings,
  friendLists,
  friendPayload,
  onShare,
  onClearFriend,
  onGoScan,
  onEditRepeats,
  onEditNeed,
}: TradeScreenProps) {
  useStore(collection);
  useStore(repeats);
  useStore(friendLists);

  const [notice, setNotice] = useState<string | null>(null);
  const flash = (text: string) => {
    setNotice(text);
    window.setTimeout(() => setNotice(null), 2800);
  };

  // The current user's name (sanitized), signed into every outgoing link so the receiver sees who it's
  // from. Read at share time. A one-time sheet captures it before the first share (see withName).
  const userName = () => sanitizeName(settings.get().name) || undefined;

  // One-time "Como te chamam?" capture, at the share moment (NOT onboarding — a ?t= friend skips it).
  // `withName` runs `action` directly if a name is set or the user already chose to skip this session;
  // otherwise it opens the sheet and runs the pending action once they save or skip.
  const [namePrompted, setNamePrompted] = useState(false);
  const [nameSheet, setNameSheet] = useState<{ run: () => void } | null>(null);
  const [nameDraft, setNameDraft] = useState('');
  // Latch so a synchronous double-tap on Salvar/Pular can't fire the pending share twice (state updates
  // are async, so both taps would otherwise read a non-null nameSheet before the re-render clears it).
  const resolvingRef = useRef(false);
  const withName = (action: () => void) => {
    if (sanitizeName(settings.get().name) || namePrompted) action();
    else {
      resolvingRef.current = false;
      setNameDraft('');
      setNameSheet({ run: action });
    }
  };
  const resolveName = (save: boolean) => {
    if (resolvingRef.current) return;
    resolvingRef.current = true;
    if (save) settings.set({ name: sanitizeName(nameDraft) });
    setNamePrompted(true);
    const pending = nameSheet?.run;
    setNameSheet(null);
    pending?.();
  };

  // "Salvar a lista do amigo": confirm/edit the friend's name (prefilled from the link), then save (or
  // update an existing friend matched by normalized name). The store canonicalizes the needs. Never
  // saves an empty name.
  const [saveSheet, setSaveSheet] = useState<
    | { phase: 'name'; needs: string[] }
    | { phase: 'collision'; needs: string[]; name: string }
    | { phase: 'updated'; name: string; friendId: string; found: number; stillNeeds: number; giveCount: number }
    | null
  >(null);
  const [saveNameDraft, setSaveNameDraft] = useState('');
  const openSaveFriend = () => {
    if (!friendPayload) return;
    setSaveNameDraft(sanitizeName(friendPayload.name) || '');
    setSaveSheet({ phase: 'name', needs: friendPayload.missing });
  };
  // On submit: a brand-new name saves straight away; a name that matches a saved friend asks
  // update-or-new (never silently overwrites the wrong friend — two friends can share a name).
  const submitSaveName = () => {
    if (saveSheet?.phase !== 'name') return;
    const name = sanitizeName(saveNameDraft);
    if (!name) return;
    if (friendLists.findByNormalizedName(name).length > 0) {
      setSaveSheet({ phase: 'collision', needs: saveSheet.needs, name });
    } else {
      friendLists.add({ name, needs: saveSheet.needs, source: 'link' });
      flash(pt.trade.friendSaved(name));
      setSaveSheet(null);
    }
  };
  // "Atualizar a lista do João": refresh his saved needs from the re-shared link and CELEBRATE the diff
  // (what he found since last time, what he still needs, how many you can give now). 0-FP: the
  // give count is givableTo (needs ∩ your spares), same gate as everywhere else.
  const saveAsUpdate = () => {
    if (saveSheet?.phase !== 'collision') return;
    const match = friendLists.findByNormalizedName(saveSheet.name)[0];
    if (!match) {
      setSaveSheet(null);
      return;
    }
    const oldNeeds = match.needs;
    friendLists.updateNeeds(match.id, saveSheet.needs);
    const updated = friendLists.get(match.id);
    const diff = needsDiff(oldNeeds, updated?.needs ?? []);
    const spares = new Set([...repeats.codes()].filter((code) => collection.has(code)));
    setSaveSheet({
      phase: 'updated',
      name: saveSheet.name,
      friendId: match.id,
      found: diff.found.length,
      stillNeeds: diff.stillNeeds.length,
      giveCount: updated ? givableTo(updated, spares).length : 0,
    });
  };
  const saveAsNew = () => {
    if (saveSheet?.phase !== 'collision') return;
    friendLists.add({ name: saveSheet.name, needs: saveSheet.needs, source: 'link' });
    flash(pt.trade.friendSaved(saveSheet.name));
    setSaveSheet(null);
  };

  // Tapping a saved friend opens their detail ("o que você tem pro João" + dei-pro-João). Cleared
  // when the friend is gone (e.g. fully traded away) so we never render a detail for a missing id.
  const [selectedFriendId, setSelectedFriendId] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  // "Dei essas pro João": the spares leave repeats (a given duplicate is gone; `owned` is untouched —
  // I still have my one) AND leave the friend's needs (they got them). Re-intersect against the FRESH
  // stores at action time (not the render-captured `codes`) so a double-tap or any stale selection can
  // only ever commit codes that are still my spare AND still the friend's need — never a wrong give,
  // never a misleading "você deu N" for nothing.
  const giveToFriend = (friend: FriendList, codes: string[]) => {
    const current = friendLists.get(friend.id);
    if (!current) return;
    const ownedNow = collection.codes();
    const spares = new Set([...repeats.codes()].filter((code) => ownedNow.has(code)));
    const needs = new Set(current.needs);
    const actual = codes.filter((code) => spares.has(code) && needs.has(code));
    if (actual.length === 0) return;
    for (const code of actual) repeats.remove(code);
    friendLists.removeNeeds(friend.id, actual);
    flash(pt.trade.gaveToFriend(friend.name, actual.length));
  };

  // Gate the first paint until the stores have hydrated from IndexedDB. A friend opening a shared
  // ?t= link lands here immediately at startup; without this the match would briefly compute against
  // an empty `owned` and show an inflated "serve pra você" count before correcting itself. friendLists
  // is gated too so the "Listas de amigos" section paints with the rest instead of popping in.
  const [loaded, setLoaded] = useState(
    () => collection.loaded() && repeats.loaded() && friendLists.loaded(),
  );
  useEffect(() => {
    if (loaded) return;
    let active = true;
    void Promise.all([collection.ready, repeats.ready, friendLists.ready]).then(() => {
      if (active) setLoaded(true);
    });
    return () => {
      active = false;
    };
  }, [loaded, collection, repeats, friendLists]);

  const owned = collection.codes();
  // A tradeable spare must be a sticker you still own — un-owning one in Coleção doesn't touch the
  // repeats store, so intersect here. This single set feeds the offer, the shared message AND the
  // friend-match "você dá", so a sticker you no longer have can never be offered.
  const myRepeatCodes = new Set([...repeats.codes()].filter((code) => owned.has(code)));
  const myRepeatEntries = entriesFor(myRepeatCodes);
  const missingCodes = checklist.entries.filter((e) => !owned.has(e.code)).map((e) => e.code);

  const myPayload: TradePayload = {
    repeats: [...myRepeatCodes],
    missing: missingCodes,
    name: userName(),
  };

  // Read the name FRESH at send time (`userName()`), not from the render-captured `myPayload`: when the
  // name sheet captures a name and then runs this share in the same tick, `settings.set` has already
  // updated synchronously, so this first signed share carries the just-typed name.
  const share = async () => {
    const result = await onShare({ ...myPayload, name: userName() });
    if (result === 'copied') flash(pt.trade.copied);
    else if (result === 'unavailable') flash(pt.trade.copyFail);
  };

  const copy = async () => {
    flash(
      (await copyTradeList({ ...myPayload, name: userName() }, checklist))
        ? pt.trade.copied
        : pt.trade.copyFail,
    );
  };

  // The receiver tapped "tenho"/"quero" on a friend's link and hit Responder. DEFERRED WRITE: commit
  // everything now (not on each tap) so a mis-tap that's never sent can't seed a ghost. "tenho" →
  // repeats + owned (the spare-implies-ownership invariant); "quero" → the wishlist. The share-back is
  // the COMBINED trade only (shareBackPayload), never the auto-computed matchTrades superset.
  const respondToFriend = (have: string[], want: string[]) => {
    for (const code of have) {
      repeats.add(code);
      collection.add(code);
    }
    // The wishlist is persisted now so a returning user keeps it; surfacing it (a curated "preciso")
    // is a follow-up that pairs with the own-offer return screen — see issue #29.
    for (const code of want) wants.add(code);
    void onShare(shareBackPayload(have, want, userName())).then((result) => {
      if (result === 'unavailable') flash(pt.trade.copyFail);
    });
  };

  if (!loaded) {
    return (
      <div class="screen trade-screen">
        <header class="trade-header">
          <div class="trade-header-row">
            <h1>{pt.trade.title}</h1>
          </div>
        </header>
        <div class="trade-loading">
          <div class="spinner" />
        </div>
      </div>
    );
  }

  // The one-time "Como te chamam?" sheet, rendered alongside whichever share surface is active.
  const nameSheetEl = nameSheet ? (
    <div class="name-overlay" role="dialog" aria-modal="true" aria-label={pt.trade.namePromptTitle}>
      <div class="name-card">
        <h2>{pt.trade.namePromptTitle}</h2>
        <p>{pt.trade.namePromptText}</p>
        <input
          class="name-input"
          type="text"
          value={nameDraft}
          maxLength={24}
          placeholder={pt.trade.namePlaceholder}
          autofocus
          onInput={(e) => setNameDraft((e.currentTarget as HTMLInputElement).value)}
        />
        <button class="btn btn-primary btn-block" onClick={() => resolveName(true)}>
          {pt.trade.namePromptSave}
        </button>
        <button class="link-btn name-skip" onClick={() => resolveName(false)}>
          {pt.trade.namePromptSkip}
        </button>
      </div>
    </div>
  ) : null;

  // "De quem é essa lista?" — name the friend before saving; if the name matches a saved friend,
  // ask update-or-new so two friends who share a name can't clobber each other.
  const saveSheetEl = saveSheet ? (
    <div
      class="name-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={
        saveSheet.phase === 'name'
          ? pt.trade.saveFriendTitle
          : saveSheet.phase === 'collision'
            ? pt.trade.saveCollisionTitle(saveSheet.name)
            : saveSheet.found > 0
              ? pt.trade.updatedFoundTitle(saveSheet.name, saveSheet.found)
              : pt.trade.updatedTitle(saveSheet.name)
      }
    >
      <div class="name-card">
        {saveSheet.phase === 'name' ? (
          <>
            <h2>{pt.trade.saveFriendTitle}</h2>
            <p>{pt.trade.saveFriendText(saveSheet.needs.length)}</p>
            <input
              class="name-input"
              type="text"
              value={saveNameDraft}
              maxLength={24}
              placeholder={pt.trade.saveFriendPlaceholder}
              autofocus
              onInput={(e) => setSaveNameDraft((e.currentTarget as HTMLInputElement).value)}
            />
            <button
              class="btn btn-primary btn-block"
              disabled={!sanitizeName(saveNameDraft)}
              onClick={submitSaveName}
            >
              {pt.trade.saveFriendSave}
            </button>
            <button class="link-btn name-skip" onClick={() => setSaveSheet(null)}>
              {pt.trade.saveFriendCancel}
            </button>
          </>
        ) : saveSheet.phase === 'collision' ? (
          <>
            <h2>{pt.trade.saveCollisionTitle(saveSheet.name)}</h2>
            <p>{pt.trade.saveCollisionText}</p>
            <button class="btn btn-primary btn-block" onClick={saveAsUpdate}>
              {pt.trade.saveCollisionUpdate(saveSheet.name)}
            </button>
            <button class="btn btn-ghost btn-block" onClick={saveAsNew}>
              {pt.trade.saveCollisionNew}
            </button>
            <button class="link-btn name-skip" onClick={() => setSaveSheet(null)}>
              {pt.trade.saveFriendCancel}
            </button>
          </>
        ) : (
          <>
            <h2>
              {saveSheet.found > 0
                ? pt.trade.updatedFoundTitle(saveSheet.name, saveSheet.found)
                : pt.trade.updatedTitle(saveSheet.name)}
            </h2>
            <p>{pt.trade.updatedText(saveSheet.stillNeeds, saveSheet.giveCount)}</p>
            {saveSheet.giveCount > 0 && (
              <button
                class="btn btn-primary btn-block"
                onClick={() => {
                  const id = saveSheet.friendId;
                  setSaveSheet(null);
                  onClearFriend();
                  setSelectedFriendId(id);
                }}
              >
                {pt.trade.updatedSeeGive}
              </button>
            )}
            <button class="link-btn name-skip" onClick={() => setSaveSheet(null)}>
              {saveSheet.giveCount > 0 ? pt.trade.updatedClose : pt.trade.updatedOk}
            </button>
          </>
        )}
      </div>
    </div>
  ) : null;

  // ---- A friend's shared list is open: the tappable two-way match ----
  if (friendPayload) {
    return (
      <>
        <FriendMatch
          // Keyed on the link so a different friend's payload forces a fresh mount (selections/responded
          // never leak between links) rather than reusing this instance's one-shot state.
          key={friendDraftKey(friendPayload)}
          friendPayload={friendPayload}
          myRepeatCodes={myRepeatCodes}
          notice={notice}
          onRespond={(have, want) => withName(() => respondToFriend(have, want))}
          onSaveFriend={openSaveFriend}
          onClearFriend={onClearFriend}
          onGoScan={onGoScan}
        />
        {nameSheetEl}
        {saveSheetEl}
      </>
    );
  }

  // ---- A saved friend's detail: what I can give them + "dei pro João" ----
  const selectedFriend = selectedFriendId ? friendLists.get(selectedFriendId) : undefined;
  if (selectedFriend) {
    return (
      <FriendDetail
        key={selectedFriend.id}
        friend={selectedFriend}
        myRepeatCodes={myRepeatCodes}
        notice={notice}
        onGive={(codes) => giveToFriend(selectedFriend, codes)}
        onArchive={() => {
          friendLists.setArchived(selectedFriend.id, true);
          flash(pt.trade.friendArchived(selectedFriend.name));
          setSelectedFriendId(null);
        }}
        onBack={() => setSelectedFriendId(null)}
        onGoScan={onGoScan}
      />
    );
  }

  // ---- The user's own trade offer ----
  const hasRepeats = myRepeatEntries.length > 0;
  const activeFriends = friendLists.active();
  const archivedFriends = friendLists.all().filter((f) => f.archived);
  const unarchiveFriend = (id: string, name: string) => {
    friendLists.setArchived(id, false);
    flash(pt.trade.friendUnarchived(name));
  };

  // Only a brand-new user who hasn't kept a single sticker yet gets the onboarding empty state. The
  // moment they have an album, this screen ALWAYS shows what they need + the share/copy actions —
  // even before they've scanned any repeats (a "preciso" wishlist is shareable on its own).
  if (owned.size === 0) {
    return (
      <div class="screen trade-screen">
        <header class="trade-header">
          <div class="trade-header-row">
            <h1>{pt.trade.title}</h1>
          </div>
        </header>
        <section class="trade-empty">
          <div class="trade-empty-emoji" aria-hidden="true">
            {pt.trade.emptyEmoji}
          </div>
          <h2>{pt.trade.emptyTitle}</h2>
          <p>{pt.trade.emptyText}</p>
          <button class="btn btn-primary btn-block" onClick={onGoScan}>
            {pt.trade.emptyButton}
          </button>
        </section>
      </div>
    );
  }

  // Always built — with no repeats the share is a "wishlist" (só "Preciso"), still worth sending.
  const previewText = previewTextFor(myPayload, checklist);
  // The exact deep link the WhatsApp message carries — encoded as a QR so someone trading in person
  // can scan it and open this same list (no typing, no WhatsApp needed).
  const shareLink = shareLinkFor(myPayload, checklist);

  return (
    <div class="screen trade-screen">
      {notice && (
        <div class="trade-notice" role="status" aria-live="polite">
          {notice}
        </div>
      )}

      <header class="trade-header">
        <div class="trade-header-row">
          <h1>{pt.trade.title}</h1>
          {hasRepeats && (
            <span class="trade-badge">{pt.trade.repeatsBadge(myRepeatEntries.length)}</span>
          )}
        </div>
      </header>

      {/* Mockup order: minhas repetidas → o que eu preciso → prévia → ações. Both sticker lists share
          the same grouped ledger (album group → team tallies), always expanded — no collapse. Each
          list is wrapped in its own <section> so its sticky header pins only within that section and
          hands off cleanly to the next instead of overlapping it. */}
      <div class="trade-body">
        <section class="trade-section">
          <SectionHead
            lead={pt.trade.myRepeatsTitle}
            em={pt.trade.myRepeatsEm}
            sticky
            action={
              <button class="link-btn trade-edit" onClick={onEditRepeats}>
                ✏️ {pt.trade.editRepeats}
              </button>
            }
          />
          {hasRepeats ? (
            <GroupedLedger codes={myRepeatCodes} tone="have" />
          ) : (
            <div class="trade-cta">
              <b>{pt.trade.repeatsPromptTitle}</b>
              <p>{pt.trade.repeatsPromptText}</p>
              <button class="btn btn-primary btn-block" onClick={onGoScan}>
                {pt.trade.emptyButton}
              </button>
            </div>
          )}
        </section>

        <section class="trade-section">
          <SectionHead
            lead={pt.trade.needTitle}
            em={pt.trade.needEm}
            sticky
            action={
              <button class="link-btn trade-edit" onClick={onEditNeed}>
                ✏️ {pt.trade.editNeed}
              </button>
            }
          />
          {missingCodes.length === 0 ? (
            <p class="trade-line-empty">{pt.trade.needEmpty}</p>
          ) : (
            <GroupedLedger codes={missingCodes} tone="need" />
          )}
        </section>

        <div class="preview">
          <span class="ptag">{pt.trade.previewTag}</span>
          <pre class="preview-text">{previewText}</pre>
        </div>

        <div class="trade-actions">
          <button class="btn-wa" onClick={() => withName(share)}>
            <span class="wa" aria-hidden="true">
              📲
            </span>{' '}
            {pt.trade.shareWhats}
          </button>
          <button class="btn-copy" onClick={() => withName(copy)}>
            {pt.trade.copy}
          </button>
        </div>

        {/* QR for in-person trading: show it, the other person scans it and lands on this exact list
            (same deep link as the WhatsApp share) without typing anything. */}
        <section class="trade-qr">
          <span class="ptag">{pt.trade.qrTag}</span>
          <QrCode value={shareLink} ariaLabel={pt.trade.qrAria} class="trade-qr-svg" />
          <p class="trade-qr-hint">{pt.trade.qrHint}</p>
        </section>

        {activeFriends.length > 0 && (
          <section class="friends-section">
            <SectionHead lead={pt.trade.friendsTitle} />
            <div class="ledger friends-list">
              {activeFriends.map((f) => {
                const canGive = givableTo(f, myRepeatCodes).length;
                return (
                  <button
                    type="button"
                    class="friend-row"
                    key={f.id}
                    onClick={() => setSelectedFriendId(f.id)}
                    aria-label={
                      f.needs.length === 0
                        ? `${f.name} — ${pt.trade.friendAllTraded}`
                        : `${f.name} — ${pt.trade.friendNeeds(f.needs.length)}${
                            canGive > 0 ? `, ${pt.trade.friendCanGive(canGive)}` : ''
                          }`
                    }
                  >
                    <span class="friend-av" aria-hidden="true">
                      {f.name.slice(0, 1).toUpperCase()}
                    </span>
                    <span class="friend-info">
                      <span class="friend-name">{f.name}</span>
                      <span class="friend-stat">
                        {f.needs.length === 0 ? (
                          pt.trade.friendAllTraded
                        ) : (
                          <>
                            {pt.trade.friendNeeds(f.needs.length)}
                            {canGive > 0 ? ` · ${pt.trade.friendCanGive(canGive)}` : ''}
                          </>
                        )}
                      </span>
                    </span>
                    {canGive > 0 && (
                      <span class="friend-give">
                        <b>{canGive}</b>
                        <small>{pt.trade.friendGiveLabel}</small>
                      </span>
                    )}
                    <span class="friend-chev" aria-hidden="true">
                      ›
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {archivedFriends.length > 0 && (
          <section class="friends-section friends-archived">
            <button
              type="button"
              class="archived-toggle"
              onClick={() => setShowArchived((s) => !s)}
              aria-expanded={showArchived}
            >
              🗄️ {pt.trade.archivedToggle(archivedFriends.length)}
              <span class="archived-caret" aria-hidden="true">
                {showArchived ? '▾' : '▸'}
              </span>
            </button>
            {showArchived && (
              <div class="ledger friends-list">
                {archivedFriends.map((f) => (
                  <div class="friend-row friend-row-archived" key={f.id}>
                    <span class="friend-av" aria-hidden="true">
                      {f.name.slice(0, 1).toUpperCase()}
                    </span>
                    <span class="friend-info">
                      <span class="friend-name">{f.name}</span>
                      <span class="friend-stat">{pt.trade.friendNeeds(f.needs.length)}</span>
                    </span>
                    <button class="friend-unarchive" onClick={() => unarchiveFriend(f.id, f.name)}>
                      {pt.trade.unarchive}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
      </div>
      {nameSheetEl}
      {saveSheetEl}
    </div>
  );
}

/** A saved friend's detail: the spares you hold that they need ("você pode dar"), tappable to confirm
 *  "dei pro João" (trade-close), plus what they still need as info. The give list is `canGive` only —
 *  needs ∩ your spares — so you can never mark a sticker you don't hold as given (0-FP). */
function FriendDetail({
  friend,
  myRepeatCodes,
  notice,
  onGive,
  onArchive,
  onBack,
  onGoScan,
}: {
  friend: FriendList;
  myRepeatCodes: Set<string>;
  notice: string | null;
  onGive: (codes: string[]) => void;
  onArchive: () => void;
  onBack: () => void;
  onGoScan: () => void;
}) {
  const { canGive, stillNeeds } = friendGiveBreakdown(friend, myRepeatCodes);
  // Default every givable sticker selected (the common case: hand over everything you have). Toggling
  // never grows past canGive, and `give` re-intersects so a code given in a previous tap (now gone from
  // canGive) can't be re-sent.
  const [selected, setSelected] = useState<Set<string>>(() => new Set(canGive));
  const toggle = (code: string) =>
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  const give = canGive.filter((code) => selected.has(code));

  return (
    <div class="screen trade-screen friend-detail">
      {notice && (
        <div class="trade-notice" role="status" aria-live="polite">
          {notice}
        </div>
      )}

      <header class="trade-header trade-header-friend">
        <div class="trade-header-friend-row">
          <button class="trade-back" onClick={onBack}>
            ← {pt.trade.detailBack}
          </button>
          <button class="trade-save-friend" onClick={onArchive}>
            🗄️ {pt.trade.detailArchive}
          </button>
        </div>
        <h1>{pt.trade.detailTitle(friend.name)}</h1>
      </header>

      <div class="trade-body trade-body-friend">
        {friend.needs.length === 0 ? (
          <div class="detail-empty">
            <span class="detail-empty-emoji" aria-hidden="true">
              🎉
            </span>
            <p>{pt.trade.detailDone(friend.name)}</p>
            <button class="btn btn-primary btn-block" onClick={onArchive}>
              🗄️ {pt.trade.detailArchiveDone(friend.name)}
            </button>
            <p class="detail-guide detail-archive-hint">{pt.trade.detailArchiveHint}</p>
          </div>
        ) : (
          <>
            {canGive.length > 0 ? (
              <>
                <SectionHead lead={pt.trade.detailGiveTitle(friend.name)} />
                <p class="detail-guide">{pt.trade.detailGiveGuide}</p>
                <SelectableList codes={canGive} selected={selected} kind="have" onToggle={toggle} />
              </>
            ) : (
              <div class="detail-empty">
                <span class="detail-empty-emoji" aria-hidden="true">
                  🔍
                </span>
                <p>{pt.trade.detailNothing(friend.name)}</p>
                <button class="btn btn-ghost btn-block" onClick={onGoScan}>
                  {pt.trade.detailScanCta}
                </button>
              </div>
            )}

            {stillNeeds.length > 0 && (
              <>
                <SectionHead lead={pt.trade.detailStillNeeds(friend.name)} />
                <GroupedLedger codes={stillNeeds} tone="need" />
              </>
            )}
          </>
        )}
      </div>

      {canGive.length > 0 && (
        <div class="friend-foot">
          <button class="btn-wa" disabled={give.length === 0} onClick={() => onGive(give)}>
            ✅ {pt.trade.detailGaveBtn(give.length)}
          </button>
        </div>
      )}
    </div>
  );
}

interface FriendMatchProps {
  friendPayload: TradePayload;
  myRepeatCodes: Set<string>;
  notice: string | null;
  /** Commit the receiver's selections and share the combined trade back (deferred write, in TradeScreen). */
  onRespond: (have: string[], want: string[]) => void;
  /** Open the "save this friend's list" sheet (to find trades for them later). */
  onSaveFriend: () => void;
  onClearFriend: () => void;
  onGoScan: () => void;
}

/** Single localStorage key holding the in-progress draft (one link at a time). */
const DRAFT_KEY = 'tradeDraft';

/** The tappable cold-receiver screen. Tap the friend's spares you want ("quero") and their needs you
 *  have ("tenho"); a live scoreboard sums the trade; Responder commits the selections (deferred) and
 *  shares the combined trade back. All the logic lives in domain/friendTrade (tested); this is wiring. */
function FriendMatch({
  friendPayload,
  myRepeatCodes,
  notice,
  onRespond,
  onSaveFriend,
  onClearFriend,
  onGoScan,
}: FriendMatchProps) {
  // Sanitize the RECEIVED name too (a hand-crafted/old ?t= link could carry a huge or control-char
  // name straight into the title) — reuses the same helper that cleans our own outgoing name.
  const friendName = sanitizeName(friendPayload.name) || pt.trade.friendFallback;
  const draftKey = friendDraftKey(friendPayload);

  // Restore an in-progress draft (survives a low-end-Android WebView remount) only if it's for THIS
  // link, so a different friend's link never restores stale picks. Read once on mount (lazy init).
  const [restored] = useState(() => {
    if (typeof localStorage === 'undefined') return null;
    const draft = parseDraft(localStorage.getItem(DRAFT_KEY));
    return draft && draft.key === draftKey ? draft : null;
  });

  // One-shot init is safe: TradeScreen only mounts FriendMatch after the `loaded` gate, so `repeats`
  // are hydrated and prefilledHave is correct on first paint.
  const [want, setWant] = useState<Set<string>>(() => new Set(restored?.want ?? []));
  const [have, setHave] = useState<Set<string>>(
    () => new Set(restored?.have ?? prefilledHave(friendPayload.missing, myRepeatCodes)),
  );
  const [responded, setResponded] = useState(false);

  const saveDraft = (h: Set<string>, w: Set<string>) => {
    if (typeof localStorage === 'undefined') return;
    try {
      localStorage.setItem(DRAFT_KEY, serializeDraft(draftKey, h, w));
    } catch {
      /* storage full/evicted — the draft is a nicety, not load-bearing. */
    }
  };
  const clearDraft = () => {
    if (typeof localStorage === 'undefined') return;
    try {
      localStorage.removeItem(DRAFT_KEY);
    } catch {
      /* ignore */
    }
  };

  // Each toggle builds a NEW Set (toggleCode) — Preact bails on an in-place mutation and the chip
  // would freeze. saveDraft uses the unchanged other set from this render's closure. Once responded,
  // the selections are committed and the draft is cleared, so taps no-op (don't resurrect the draft).
  const toggleWant = (code: string) => {
    if (responded) return;
    setWant((prev) => {
      const next = toggleCode(prev, code);
      saveDraft(have, next);
      return next;
    });
  };
  const toggleHave = (code: string) => {
    if (responded) return;
    setHave((prev) => {
      const next = toggleCode(prev, code);
      saveDraft(next, want);
      return next;
    });
  };
  const wantEverything = () => {
    if (responded) return;
    setWant(() => {
      const next = new Set(friendPayload.repeats);
      saveDraft(have, next);
      return next;
    });
  };
  const clearWant = () => {
    if (responded) return;
    setWant(() => {
      const next = new Set<string>();
      saveDraft(have, next);
      return next;
    });
  };

  const respond = () => {
    clearDraft();
    setResponded(true);
    onRespond([...have], [...want]);
  };

  // A link with nothing to compare (name-only, or an album-complete sharer). Guarded AFTER the hooks
  // so hook order stays stable.
  if (isEmptyFriendLink(friendPayload)) {
    return (
      <div class="screen trade-screen">
        {notice && (
          <div class="trade-notice" role="status" aria-live="polite">
            {notice}
          </div>
        )}
        <header class="trade-header">
          <div class="trade-header-row">
            <h1>{pt.trade.title}</h1>
          </div>
        </header>
        <section class="trade-empty">
          <div class="trade-empty-emoji" aria-hidden="true">
            🔁
          </div>
          <h2>{pt.trade.emptyLinkTitle}</h2>
          <p>{pt.trade.emptyLinkText}</p>
          <button class="btn btn-primary btn-block" onClick={onGoScan}>
            {pt.trade.emptyLinkButton}
          </button>
        </section>
      </div>
    );
  }

  const score = tradeScore(want, have);

  return (
    <div class="screen trade-screen trade-screen-friend">
      {notice && (
        <div class="trade-notice" role="status" aria-live="polite">
          {notice}
        </div>
      )}

      <header class="trade-header trade-header-friend">
        <div class="trade-header-friend-row">
          <button class="trade-back" onClick={onClearFriend}>
            ← {pt.trade.backToMine}
          </button>
          <button class="trade-save-friend" onClick={onSaveFriend}>
            💾 {pt.trade.saveFriendCta}
          </button>
        </div>
        <h1>{pt.trade.friendTradeTitle(friendName)}</h1>
        <p class="trade-guide">{pt.trade.friendGuide}</p>
      </header>

      <div class="trade-body trade-body-friend">
        <div class="trade-legend" aria-hidden="true">
          <span>
            <i class="leg-sw leg-want">✓</i> {pt.trade.chipWant}
          </span>
          <span>
            <i class="leg-sw leg-have">✓</i> {pt.trade.chipHave}
          </span>
          <span>
            <i class="leg-sw leg-tap" /> {pt.trade.legendTap}
          </span>
        </div>

        <SectionHead lead={`${pt.trade.friendHasTitle(friendName)} 🔁`} />
        <div class="trade-bulk">
          <button class="bulk-btn" onClick={wantEverything}>
            {pt.trade.wantAll}
          </button>
          {want.size > 0 && (
            <button class="bulk-btn bulk-clear" onClick={clearWant}>
              {pt.trade.clearSel}
            </button>
          )}
        </div>
        <SelectableList codes={friendPayload.repeats} selected={want} kind="want" onToggle={toggleWant} />

        <SectionHead lead={`${pt.trade.friendNeedsTitle(friendName)} 📍`} />
        <SelectableList codes={friendPayload.missing} selected={have} kind="have" onToggle={toggleHave} />
      </div>

      <div class="friend-foot">
        {responded ? (
          <div class="friend-converted">
            <span class="conv-msg">🎉 {pt.trade.albumStarted}</span>
            <button class="conv-see" onClick={onClearFriend}>
              {pt.trade.backToMine}
            </button>
          </div>
        ) : (
          <>
            <div class="friend-score">
              {score.twoWay ? (
                <span class="score-trade">{pt.trade.scoreTrade(score.total)}</span>
              ) : (
                <span class="score-recv">{pt.trade.scoreReceiveOnly(score.p, friendName)}</span>
              )}
            </div>
            {score.twoWay && <div class="friend-pega">{pt.trade.scorePega(score.p, score.d)}</div>}
            <button class="btn-wa" disabled={!score.canRespond} onClick={respond}>
              <span class="wa" aria-hidden="true">
                📲
              </span>{' '}
              {pt.trade.respond}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

/** One tappable list (a friend's spares OR their needs) as album-grouped team tallies whose numbers are
 *  toggle buttons. `kind` picks the selected style (want = gold, have = green); meaning is carried by
 *  ✓ + fill-vs-dashed shape + the section heading, never colour alone. */
function SelectableList({
  codes,
  selected,
  kind,
  onToggle,
}: {
  codes: string[];
  selected: Set<string>;
  kind: 'want' | 'have';
  onToggle: (code: string) => void;
}) {
  const label = kind === 'want' ? pt.trade.chipWant : pt.trade.chipHave;
  return (
    <div class="ledger grouped-ledger">
      {groupByAlbum(codes).map((group) => (
        <div class="grp" key={group.label}>
          <div class="grp-head">
            <span class="grp-name">{group.label}</span>
          </div>
          {splitByTeam(group.entries).map((team) => (
            <div class="tally" key={team[0].teamCode}>
              <div class="tally-head">
                <span class="tally-team">{teamLabel(team[0])}</span>
              </div>
              <div class="tally-nums tally-select">
                {team.map((entry) => {
                  const on = selected.has(entry.code);
                  const num = entry.number === 0 ? '00' : entry.number;
                  return (
                    <button
                      key={entry.code}
                      type="button"
                      class={`sel-num${on ? ` is-${kind}` : ''}`}
                      aria-pressed={on}
                      aria-label={`${entry.teamName} ${num}${on ? ` (${label})` : ''}`}
                      onClick={() => onToggle(entry.code)}
                    >
                      {num}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function SectionHead({
  lead,
  em,
  count,
  action,
  sticky,
}: {
  lead: string;
  em?: string;
  count?: number;
  action?: ComponentChildren;
  /** Pin the header below the "Trocar" bar while its section scrolls (the two own-offer lists). */
  sticky?: boolean;
}) {
  return (
    <div class={`sec-h${sticky ? ' sec-h--sticky' : ''}`}>
      <span class="t">
        {lead}
        {em ? <span class="em"> {em}</span> : null}
      </span>
      <span class="rule" />
      {count !== undefined ? <span class="trade-count">{pt.trade.count(count)}</span> : null}
      {action}
    </div>
  );
}

/** "have" = stickers you hold (filled slots); "need" = stickers you're missing (dashed slots). The
 *  fill-vs-dashed shape carries the meaning, never colour alone (mirrors the album chips). */
type TallyTone = 'have' | 'need';

/** One team as a compact tally: flag + name + count, then the sticker numbers as wrapping pills
 *  (🇲🇽 México · 4 · "3 4 8 12"). Replaces one row per sticker so a 100+ list stays scannable. */
function TeamTally({ entries, tone }: { entries: ChecklistEntry[]; tone: TallyTone }) {
  return (
    <div class="tally">
      <div class="tally-head">
        <span class="tally-team">{teamLabel(entries[0])}</span>
        <span class="tally-count">{entries.length}</span>
      </div>
      <div class={`tally-nums tally-nums-${tone}`}>
        {entries.map((e) => (
          <span class="tally-num" key={e.code}>
            {e.number === 0 ? '00' : e.number}
          </span>
        ))}
      </div>
    </div>
  );
}

/** The shared sticker list for "Minhas repetidas" (have) and "O que eu preciso" (need): one cream
 *  ledger card, grouped by album group (Grupo A…, then specials), each group a static header (name +
 *  per-group count) over its team tallies. Always expanded — both sections render through this so they
 *  stay identical. Only the count wording/colour differs by tone: "faltam N" (green) vs "tenho N". */
function GroupedLedger({ codes, tone }: { codes: Iterable<string>; tone: TallyTone }) {
  return (
    // `own-ledger` pins each "Grupo X" label below the sticky section header as the list scrolls.
    <div class="ledger grouped-ledger own-ledger">
      {groupByAlbum(codes).map((group) => (
        <div class="grp" key={group.label}>
          <div class="grp-head">
            <span class="grp-name">{group.label}</span>
            <span class={`grp-count grp-count-${tone}`}>
              {tone === 'need'
                ? pt.trade.groupFaltam(group.entries.length)
                : pt.trade.groupTenho(group.entries.length)}
            </span>
          </div>
          {splitByTeam(group.entries).map((team) => (
            <TeamTally key={team[0].teamCode} entries={team} tone={tone} />
          ))}
        </div>
      ))}
    </div>
  );
}

function teamLabel(entry: ChecklistEntry): string {
  const flag = flagFor(entry.teamCode);
  return flag ? `${flag} ${entry.teamName}` : entry.teamName;
}

/** Split entries that are already in album order into consecutive same-team runs, so each team
 *  becomes one tally block. Used by every sticker list on this screen (repeats, preciso, match). */
function splitByTeam(entries: ChecklistEntry[]): ChecklistEntry[][] {
  const teams: ChecklistEntry[][] = [];
  for (const entry of entries) {
    const last = teams[teams.length - 1];
    if (last && last[0].teamCode === entry.teamCode) last.push(entry);
    else teams.push([entry]);
  }
  return teams;
}

/** Resolve a set of codes to checklist entries in album order. */
function entriesFor(codes: Set<string>): ChecklistEntry[] {
  return checklist.entries.filter((entry) => codes.has(entry.code));
}

/** Bucket entries (given by code) into album groups (Grupo A..L, then Especiais), in album order. */
export function groupByAlbum(codes: Iterable<string>): AlbumGroup[] {
  const selected = new Set(codes);
  const groups: AlbumGroup[] = [];

  for (const team of checklist.teams) {
    const teamEntries = team.entries.filter((entry) => selected.has(entry.code));
    if (teamEntries.length === 0) continue;

    // Group-less sections (Especiais, Coca-Cola) keep their own name as the header.
    const label = team.group ? pt.trade.albumGroup(team.group) : team.teamName;
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.entries.push(...teamEntries);
    else groups.push({ label, entries: [...teamEntries] });
  }

  return groups;
}
