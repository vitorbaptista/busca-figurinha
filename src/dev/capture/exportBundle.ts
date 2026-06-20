// Bundle all captured frames into ONE downloadable file for adb pull. Custom container so we need
// no zip/tar dependency and no base64 bloat, and so it streams from disk-backed Blobs (no OOM on a
// phone building a big archive):
//
//   [4 bytes: manifest byte-length, uint32 LE]
//   [manifest: UTF-8 JSON { version, count, frames: [{ name, code, pass, ts, size }] }]
//   [jpeg bytes for frame 0][jpeg bytes for frame 1]...
//
// scripts/fold-capture.mjs reads it back: parse the manifest, then slice each JPEG by cumulative
// size. Lands in the phone's Downloads; pull with `adb pull /sdcard/Download/figurinhas-capture-*.bin`.
import { allFrames } from './captureStore';

export async function exportCapture(): Promise<number> {
  const frames = await allFrames();
  if (frames.length === 0) return 0;

  const manifest = {
    version: 1,
    count: frames.length,
    frames: frames.map((f, i) => ({
      name: `${f.code}-${String(i).padStart(5, '0')}.jpg`,
      code: f.code,
      pass: f.pass,
      ts: f.ts,
      size: f.blob.size,
    })),
  };
  const manifestBytes = new TextEncoder().encode(JSON.stringify(manifest));
  const header = new Uint8Array(4);
  new DataView(header.buffer).setUint32(0, manifestBytes.length, true);

  const parts: BlobPart[] = [header, manifestBytes, ...frames.map((f) => f.blob)];
  const blob = new Blob(parts, { type: 'application/octet-stream' });

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `figurinhas-capture-${Date.now()}.bin`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return frames.length;
}
