// Shared type contracts for the whole app. Pure types only — no logic, no imports.
// Every module implements/consumes these so the parallel pieces fit together.

// ---------- Checklist ----------
export type StickerType = 'team' | 'player' | 'special';

/** One sticker in the album, keyed by its printed back code. */
export interface ChecklistEntry {
  /** Canonical code: uppercase, no spaces. e.g. "CIV12", "FWC1", "00". */
  code: string;
  /** Human display form. e.g. "CIV 12", "FWC 1", "00". */
  display: string;
  /** Grouping key. e.g. "CIV", "FWC". */
  teamCode: string;
  /** Portuguese team/section name. e.g. "Costa do Marfim", "Especiais". */
  teamName: string;
  /** Number within the team (0 for the "00" logo sticker). */
  number: number;
  type: StickerType;
}

export interface TeamGroup {
  teamCode: string;
  teamName: string;
  /** Entries ordered by number. */
  entries: ChecklistEntry[];
  /** World Cup group letter (A–L) this team is drawn into, for album-order grouping.
   *  Undefined for the special "FWC" section. */
  group?: string;
}

export interface Checklist {
  entries: ChecklistEntry[];
  /** code -> entry, for O(1) lookup and fuzzy-match candidate keys. */
  byCode: Map<string, ChecklistEntry>;
  /** Groups in display order. */
  teams: TeamGroup[];
  total: number;
}

// ---------- Code parsing ----------
export interface ParsedCode {
  /** Letter prefix, "" for pure-number codes like "00". */
  teamCode: string;
  number: number;
  /** Normalized canonical form. */
  canonical: string;
}

// ---------- Matching ----------
export type MatchStatus = 'exact' | 'corrected' | 'unknown';

export interface MatchResult {
  /** Normalized raw OCR token that was matched against. */
  raw: string;
  status: MatchStatus;
  /** The matched checklist entry, or null when unknown. */
  entry: ChecklistEntry | null;
  /** Edit distance to the matched entry: 0 exact, >=1 corrected, -1 unknown. */
  distance: number;
}

// ---------- Session ----------
export type ScanOutcome = 'needed' | 'owned' | 'unknown';

export interface ScanRecord {
  raw: string;
  /** Canonical code when matched, else null. */
  code: string | null;
  outcome: ScanOutcome;
  ts: number;
}

export interface SessionReport {
  scannedCount: number;
  /** Deduped entries the user needs (candidates to acquire). */
  keepers: ChecklistEntry[];
  /** Deduped entries the user already owns. */
  repeats: ChecklistEntry[];
  /** Deduped raw tokens that matched nothing. */
  unknowns: string[];
}

/** Stateful scan session (see domain/session.ts: createSession). */
export interface ScanSession {
  add(match: MatchResult, owned: boolean): ScanRecord;
  /** Remove the most recent record with this code (for "Não é essa?" — undoing a
   *  confident misread so it never reaches the report). Returns true if one was removed. */
  removeByCode(code: string): boolean;
  records(): ScanRecord[];
  report(checklist: Checklist): SessionReport;
  finish(checklist: Checklist): SessionReport;
  isEmpty(): boolean;
  clear(): void;
  toJSON(): ScanRecord[];
}

// ---------- OCR ----------
export interface OcrResult {
  text: string;
  /** 0..100 */
  confidence: number;
}

/** OCR backend (see ocr/engine.ts: createOcrEngine). */
export interface OcrEngine {
  init(onProgress?: (ratio: number) => void): Promise<void>;
  recognize(source: HTMLCanvasElement): Promise<OcrResult>;
  /** OCR several crops in parallel (one per located code box). */
  recognizeMany(sources: HTMLCanvasElement[]): Promise<OcrResult[]>;
  terminate(): Promise<void>;
  /** Optional split phases for the two-phase live path (the hybrid engine provides them):
   *  `recognizeFast` is the cheap recognizer ALONE (no fallback); `recognizeSlow` the
   *  accurate fallback ALONE. When present, recognizeFrameInOrder reads every crop with the
   *  fast engine FIRST and only pays the slow engine when no crop's fast read resolved a
   *  code — so a frame the fast path can read never touches the slow (wasm) engine, even on
   *  the spurious crops alongside the pill. */
  recognizeFast?(sources: HTMLCanvasElement[]): Promise<OcrResult[]>;
  recognizeSlow?(sources: HTMLCanvasElement[]): Promise<OcrResult[]>;
  /** The fast read's confidence floor for accepting it without the slow engine — exposed so
   *  the orchestrator applies the SAME gate the hybrid uses internally. Absent on plain
   *  engines (they have no fast phase). */
  fastConf?: number;
}

/** Live or test frame provider (see ocr/frameSource.ts: createCameraSource). */
export interface FrameSource {
  start(): Promise<void>;
  stop(): void;
  readonly element: HTMLVideoElement;
  isReady(): boolean;
  /** Draw the current frame into canvas, scaled so width <= maxWidth.
   *  Returns false if no frame is available yet. */
  drawTo(canvas: HTMLCanvasElement, maxWidth: number): boolean;
}

/** Stable-frame auto-capture controller (see ocr/autoCapture.ts: createAutoCapture). */
export interface AutoCapture {
  start(): void;
  stop(): void;
}

/** Per-tick heartbeat of the capture loop (for the debug readout): what the loop is
 *  doing right now, so a user can see it's alive and why it is/isn't reading. */
export interface AutoCaptureStatus {
  /** waiting = armed, show a sticker; moving = sticker in motion; holding = still,
   *  counting toward the read; reading = OCR burst in flight; locked = already read,
   *  move/swap the sticker to re-arm; stalled = no camera frame this tick (video
   *  paused/not ready) — the loop is alive but starved, NOT locked. The loop never gives up
   *  on an unread sticker: it stays in the holding/reading cycle until it reads or the sticker
   *  leaves, and only enters `locked` after a real read. */
  phase: 'waiting' | 'moving' | 'holding' | 'reading' | 'locked' | 'stalled';
  /** Sampled frame-change fraction (0..1) this tick. */
  change: number;
  /** ms the sticker has been held still (0 when moving). */
  heldMs: number;
  /** Monotonic tick counter — a visible proof the loop is still ticking. */
  tick: number;
}

/** Outcome of OCR-ing one burst frame, fed back to the capture loop so it knows whether
 *  to lock (a real read happened), keep trying (a sticker is in view but unread), or idle
 *  (nothing in view). */
export interface CaptureResult {
  /** Stop the burst now — a code confirmed, or (single-shot debug path) one read is done. */
  stop: boolean;
  /** A code was committed during this burst — i.e. the sticker was actually read. Only this
   *  locks the loop ("troque a figurinha"); a burst that reads nothing never claims a read. */
  committed: boolean;
  /** At least one code box was detected in the frame — a sticker is in view (even if it
   *  couldn't be read). Lets the loop keep trying on a present-but-unread sticker yet idle on
   *  an empty mat instead of bursting forever. */
  detected: boolean;
}

export interface AutoCaptureDeps {
  source: FrameSource;
  /** Called for each frame of a settled sticker's burst. The returned CaptureResult tells the
   *  loop whether to stop the burst, whether a code committed, and whether a sticker was even
   *  in view (see CaptureResult). The loop NEVER gives up on a present-but-unread sticker — it
   *  keeps re-trying while it's held — and only locks after a real read. */
  onCapture: (frame: HTMLCanvasElement) => CaptureResult | Promise<CaptureResult>;
  /** Called once when a new sticker settles, before its first burst frame — the
   *  place to reset any per-sticker accumulation (e.g. the multi-frame confirmer). */
  onBurstStart?: () => void;
  /** Optional per-tick heartbeat (every sampleIntervalMs) for a debug readout. */
  onTick?: (status: AutoCaptureStatus) => void;
}

// ---------- Storage ----------
export interface KeyValueStore {
  get<T>(key: string): Promise<T | undefined>;
  set<T>(key: string, value: T): Promise<void>;
  del(key: string): Promise<void>;
}

/** Reactive owned-codes store (see state/collection.ts: createCollectionStore). */
export interface CollectionStore {
  readonly ready: Promise<void>;
  /** True once the initial IndexedDB load has resolved — sync-readable so a screen can gate its
   *  first paint (e.g. a shared trade link landing before `owned` is hydrated). */
  loaded(): boolean;
  has(code: string): boolean;
  add(code: string): void;
  remove(code: string): void;
  toggle(code: string): void;
  setOwned(codes: Iterable<string>, owned: boolean): void;
  codes(): Set<string>;
  size(): number;
  clear(): void;
  exportOwned(): string[];
  importOwned(codes: string[]): void;
  subscribe(listener: () => void): () => void;
}

// ---------- Settings ----------
export type Language = 'pt';

/** Which camera the scanner uses. 'front' (screen-side) is the default: the phone
 *  lies flat on the table and the user shows the sticker back to the front camera. */
export type CameraFacing = 'front' | 'back';

export interface Settings {
  language: Language;
  sound: boolean;
  onboarded: boolean;
  camera: CameraFacing;
  /** The user's display name, signed into every share link so the receiver sees who it's from
   *  ("Trocar com o Léo") and a re-shared list can be matched back. Optional; absent → "seu amigo". */
  name?: string;
}

/** Reactive settings store (see state/settings.ts: createSettingsStore). */
export interface SettingsStore {
  readonly ready: Promise<void>;
  get(): Settings;
  set(patch: Partial<Settings>): void;
  subscribe(listener: () => void): () => void;
}

// ---------- Friend lists ----------
/** A saved friend's wishlist (what THEY need), kept to find trades for them. Keyed on a stable `id`;
 *  `name` is a display/match hint. `needs` holds canonical album codes only (validated at the store
 *  boundary). See state/friendLists.ts + domain/friendMatch.ts. */
export interface FriendList {
  id: string;
  name: string;
  needs: string[];
  source: 'link' | 'paste';
  archived: boolean;
  updatedAt: number;
}

// ---------- Backup ----------
export interface BackupFile {
  app: 'troca-figurinhas';
  version: 1;
  exportedAt: string;
  owned: string[];
  /** Codes the user has a DUPLICATE of (their tradeable spares). Optional so backups
   *  written before this field still import cleanly (treated as none). */
  repeats?: string[];
  /** Codes the user WANTS (their wishlist, seeded by tapping a friend's spares). Optional like
   *  repeats; restored as-is (no owned-filter). It isn't pruned when a sticker is later obtained, so
   *  a future consumer should intersect with "not owned" at read time. */
  wants?: string[];
  /** Saved friend lists (what other people need). Optional so older backups import cleanly. */
  friendLists?: FriendList[];
  settings: Settings;
}
