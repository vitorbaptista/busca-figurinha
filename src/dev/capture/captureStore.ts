// On-device store for the gated dataset-capture tool (?capture). Frames live in their own
// IndexedDB database (separate from the app's collection state) so capturing never touches user
// data and a "clear" can't nuke their album. Each frame is a full-resolution JPEG blob + its
// ground-truth label (the code the user typed, or '__neg__') + a pass id (one Record session).
import { createStore, set, entries, clear, keys } from 'idb-keyval';

const store = createStore('figurinhas-capture', 'frames');

export interface CaptureFrame {
  blob: Blob;
  code: string; // a real checklist code, or '__neg__' for a not-a-sticker negative
  pass: number; // one Record session; the fold step splits by pass to avoid near-dup leakage
  ts: number;
}

/** Persist one captured frame. Key is time+random so reloads never collide. */
export async function addFrame(frame: CaptureFrame): Promise<void> {
  const key = `${frame.ts}-${Math.random().toString(36).slice(2, 8)}`;
  await set(key, frame, store);
}

/** All stored frames (loads the blobs — used only for export; blobs are disk-backed references). */
export async function allFrames(): Promise<CaptureFrame[]> {
  return (await entries<string, CaptureFrame>(store)).map(([, v]) => v);
}

/** Cheap count (keys only, no blobs). */
export async function frameCount(): Promise<number> {
  return (await keys(store)).length;
}

export async function clearFrames(): Promise<void> {
  await clear(store);
}
