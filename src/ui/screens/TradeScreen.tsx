import { Fragment, type ComponentChildren } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import type { ChecklistEntry, CollectionStore } from '../../types';
import { checklist } from '../../data/checklist';
import { flagFor } from '../../data/flags';
import { matchTrades, type TradePayload } from '../../domain/tradeList';
import { previewTextFor, copyTradeList, type ShareTradesResult } from '../../domain/share';
import { pt } from '../../i18n/pt';
import { useStore } from '../hooks';

interface TradeScreenProps {
  /** The user's owned codes (to derive what they still need). */
  collection: CollectionStore;
  /** The user's saved duplicates (tradeable spares). */
  repeats: CollectionStore;
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
  friendPayload,
  onShare,
  onClearFriend,
  onGoScan,
  onEditRepeats,
  onEditNeed,
}: TradeScreenProps) {
  useStore(collection);
  useStore(repeats);

  const [notice, setNotice] = useState<string | null>(null);
  const flash = (text: string) => {
    setNotice(text);
    window.setTimeout(() => setNotice(null), 2800);
  };

  // Which "O que eu preciso" album groups are expanded. Starts empty (all collapsed) so the section
  // is a short list of group rows instead of every missing sticker (~620 rows on a half-full album).
  const [openGroups, setOpenGroups] = useState<Set<string>>(() => new Set());
  const toggleGroup = (label: string) =>
    setOpenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });

  // Gate the first paint until both stores have hydrated from IndexedDB. A friend opening a shared
  // ?t= link lands here immediately at startup; without this the match would briefly compute against
  // an empty `owned` and show an inflated "serve pra você" count before correcting itself.
  const [loaded, setLoaded] = useState(() => collection.loaded() && repeats.loaded());
  useEffect(() => {
    if (loaded) return;
    let active = true;
    void Promise.all([collection.ready, repeats.ready]).then(() => {
      if (active) setLoaded(true);
    });
    return () => {
      active = false;
    };
  }, [loaded, collection, repeats]);

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
  };

  const share = async () => {
    const result = await onShare(myPayload);
    if (result === 'copied') flash(pt.trade.copied);
    else if (result === 'unavailable') flash(pt.trade.copyFail);
  };

  const copy = async () => {
    flash((await copyTradeList(myPayload, checklist)) ? pt.trade.copied : pt.trade.copyFail);
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

  // ---- A friend's shared list is open: show the two-way match ----
  if (friendPayload) {
    return (
      <FriendMatch
        friendPayload={friendPayload}
        owned={owned}
        myRepeatCodes={myRepeatCodes}
        hasMyRepeats={myRepeatEntries.length > 0}
        notice={notice}
        onShareBack={share}
        onClearFriend={onClearFriend}
        onGoScan={onGoScan}
      />
    );
  }

  // ---- The user's own trade offer ----
  const hasRepeats = myRepeatEntries.length > 0;

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

  const needGroups = groupByAlbum(missingCodes);
  // Always built — with no repeats the share is a "wishlist" (só "Preciso"), still worth sending.
  const previewText = previewTextFor(myPayload, checklist);

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

      {/* Mockup order: minhas repetidas → o que eu preciso → prévia → ações. The "preciso" list is
          collapsed by group, so the share actions below it stay within easy reach. */}
      <div class="trade-body">
        <SectionHead
          lead={pt.trade.myRepeatsTitle}
          em={pt.trade.myRepeatsEm}
          action={
            <button class="link-btn trade-edit" onClick={onEditRepeats}>
              ✏️ {pt.trade.editRepeats}
            </button>
          }
        />
        {hasRepeats ? (
          <div class="ledger">
            {splitByTeam(myRepeatEntries).map((team) => (
              <TeamTally key={team[0].teamCode} entries={team} tone="have" />
            ))}
          </div>
        ) : (
          <div class="trade-cta">
            <b>{pt.trade.repeatsPromptTitle}</b>
            <p>{pt.trade.repeatsPromptText}</p>
            <button class="btn btn-primary btn-block" onClick={onGoScan}>
              {pt.trade.emptyButton}
            </button>
          </div>
        )}

        <SectionHead
          lead={pt.trade.needTitle}
          em={pt.trade.needEm}
          action={
            <button class="link-btn trade-edit" onClick={onEditNeed}>
              ✏️ {pt.trade.editNeed}
            </button>
          }
        />
        {needGroups.length === 0 ? (
          <p class="trade-line-empty">{pt.trade.needEmpty}</p>
        ) : (
          <div class="ledger need-list">
            {needGroups.map((group) => {
              const open = openGroups.has(group.label);
              return (
                <Fragment key={group.label}>
                  <button
                    type="button"
                    class={`need-grp-row ${open ? 'is-open' : ''}`}
                    onClick={() => toggleGroup(group.label)}
                    aria-expanded={open}
                  >
                    <span class="ngname">{group.label}</span>
                    <span class="ngcount">{pt.trade.groupFaltam(group.entries.length)}</span>
                    <span class="ngcaret" aria-hidden="true">
                      {open ? '▾' : '▸'}
                    </span>
                  </button>
                  {open && (
                    <div class="need-open">
                      {splitByTeam(group.entries).map((team) => (
                        <TeamTally key={team[0].teamCode} entries={team} tone="need" />
                      ))}
                    </div>
                  )}
                </Fragment>
              );
            })}
          </div>
        )}

        <div class="preview">
          <span class="ptag">{pt.trade.previewTag}</span>
          <pre class="preview-text">{previewText}</pre>
        </div>

        <div class="trade-actions">
          <button class="btn-wa" onClick={share}>
            <span class="wa" aria-hidden="true">
              📲
            </span>{' '}
            {pt.trade.shareWhats}
          </button>
          <button class="btn-copy" onClick={copy}>
            {pt.trade.copy}
          </button>
        </div>
      </div>
    </div>
  );
}

interface FriendMatchProps {
  friendPayload: TradePayload;
  owned: Set<string>;
  myRepeatCodes: Set<string>;
  hasMyRepeats: boolean;
  notice: string | null;
  onShareBack: () => void;
  onClearFriend: () => void;
  onGoScan: () => void;
}

function FriendMatch({
  friendPayload,
  owned,
  myRepeatCodes,
  hasMyRepeats,
  notice,
  onShareBack,
  onClearFriend,
  onGoScan,
}: FriendMatchProps) {
  const friendName = friendPayload.name?.trim() || pt.trade.friendFallback;
  const { iCanGet, iCanGive } = matchTrades({
    me: { owned, repeats: myRepeatCodes },
    friend: friendPayload,
    checklist,
  });

  return (
    <div class="screen trade-screen">
      {notice && (
        <div class="trade-notice" role="status" aria-live="polite">
          {notice}
        </div>
      )}

      <header class="trade-header trade-header-friend">
        <button class="trade-back" onClick={onClearFriend}>
          ← {pt.trade.backToMine}
        </button>
        <h1>{pt.trade.receiverHero(friendName)}</h1>
        <p class="trade-win">{pt.trade.receiverWin(iCanGet.length)}</p>
      </header>

      <div class="trade-body">
        <SectionHead lead={pt.trade.iCanGetTitle} count={iCanGet.length} />
        <MatchGroups entries={iCanGet} emptyText={pt.trade.iCanGetEmpty} tone="need" />

        <SectionHead lead={pt.trade.iCanGiveTitle} count={hasMyRepeats ? iCanGive.length : undefined} />
        {hasMyRepeats ? (
          <MatchGroups entries={iCanGive} emptyText={pt.trade.iCanGiveEmpty} tone="have" />
        ) : (
          <div class="trade-cta">
            <b>{pt.trade.giveCtaTitle}</b>
            <p>{pt.trade.giveCtaText}</p>
            <button class="btn btn-primary btn-block" onClick={onGoScan}>
              {pt.trade.giveCtaButton}
            </button>
          </div>
        )}

        {hasMyRepeats && (
          <div class="trade-actions">
            <button class="btn-wa" onClick={onShareBack}>
              <span class="wa" aria-hidden="true">
                📲
              </span>{' '}
              {pt.trade.shareBack}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function MatchGroups({
  entries,
  emptyText,
  tone,
}: {
  entries: ChecklistEntry[];
  emptyText: string;
  tone: TallyTone;
}) {
  if (entries.length === 0) return <p class="trade-line-empty">{emptyText}</p>;

  // No colour coding: the "Você pega" / "Você dá" section headers already label each list, and the
  // pills carry their have/need meaning by fill vs. dashed slot — never by colour alone.
  return (
    <>
      {groupByAlbum(entries.map((e) => e.code)).map((group) => (
        <Fragment key={group.label}>
          <div class="trade-grp">{group.label}</div>
          <div class="ledger">
            {splitByTeam(group.entries).map((team) => (
              <TeamTally key={team[0].teamCode} entries={team} tone={tone} />
            ))}
          </div>
        </Fragment>
      ))}
    </>
  );
}

function SectionHead({
  lead,
  em,
  count,
  action,
}: {
  lead: string;
  em?: string;
  count?: number;
  action?: ComponentChildren;
}) {
  return (
    <div class="sec-h">
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
