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
  records(): ScanRecord[];
  report(checklist: Checklist): SessionReport;
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
  terminate(): Promise<void>;
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

export interface AutoCaptureDeps {
  source: FrameSource;
  /** Called once per settled sticker with a freshly captured frame. */
  onCapture: (frame: HTMLCanvasElement) => void | Promise<void>;
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

export interface Settings {
  language: Language;
  sound: boolean;
  onboarded: boolean;
}

/** Reactive settings store (see state/settings.ts: createSettingsStore). */
export interface SettingsStore {
  readonly ready: Promise<void>;
  get(): Settings;
  set(patch: Partial<Settings>): void;
  subscribe(listener: () => void): () => void;
}

// ---------- Backup ----------
export interface BackupFile {
  app: 'troca-figurinhas';
  version: 1;
  exportedAt: string;
  owned: string[];
  settings: Settings;
}
