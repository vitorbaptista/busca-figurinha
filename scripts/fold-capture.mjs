// Fold ?capture export bundles (.bin) into the bench:pixel dataset format.
//
//   node scripts/fold-capture.mjs --out=captures/datasets/<name> [--chunk=3] <bundle1.bin> ...
//
// Reads the container written by src/dev/capture/exportBundle.ts:
//   [4B uint32 LE manifest length][manifest JSON][jpeg bytes...]
// and writes, per frame:
//   <out>/raw/<source_dir>/debug/frame-<n>/frame.png   (the captured JPEG bytes — the bench
//                                                        decodes by content in the browser, so no
//                                                        Node image dependency is needed)
//   rows in <out>/ground_truth_verification.csv  and  <out>/dataset_manifest.csv (canonical columns)
//
// SPLIT POLICY — split by contiguous frame-CHUNKS within each label, NOT by pass:
//   • Each label's frames are sorted by capture time and grouped into chunks of CHUNK consecutive
//     frames. Near-duplicate burst frames sit in the same chunk → the same split → no leakage.
//   • Chunk 0 of every label → train (so every captured code is trained on).
//   • Extra chunks are round-robined GLOBALLY (val, test, then train×3) to reach ~70/15/15 overall,
//     so val/test populate even from the natural one-Gravar-pass-per-code workflow.
// Frames are DEDUPED by (label, ts) so re-folding overlapping bundles (the tool exports the whole
// store each time) can't leak identical frames across splits. Deterministic (sorted) → stable.
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const flag = (name, d) => {
  const a = args.find((x) => x.startsWith(`--${name}=`));
  return a ? a.split('=')[1] : d;
};
const out = flag('out', null);
const CHUNK = Math.max(1, Number(flag('chunk', 3)));
const inputs = args.filter((a) => !a.startsWith('--'));
if (!out || inputs.length === 0) {
  console.error('usage: node scripts/fold-capture.mjs --out=captures/datasets/<name> [--chunk=3] <bundle.bin>...');
  process.exit(1);
}

const sanitize = (s) => s.replace(/\.\.+/g, '').replace(/[^a-z0-9._-]/gi, '');

// ---- Read + validate every bundle, collecting frames; dedup by (label, ts). ----
const seen = new Set();
const byLabel = new Map(); // label -> [{ ts, bytes }]
let dupes = 0;
for (const file of inputs) {
  const buf = fs.readFileSync(file);
  if (buf.length < 4) throw new Error(`${file}: too small to be a capture bundle`);
  const manLen = buf.readUInt32LE(0);
  if (4 + manLen > buf.length) throw new Error(`${file}: manifest length overruns the file`);
  const manifest = JSON.parse(buf.subarray(4, 4 + manLen).toString('utf8'));
  if (manifest.version !== 1) throw new Error(`${file}: unsupported bundle version ${manifest.version}`);
  let off = 4 + manLen;
  const expected = off + manifest.frames.reduce((s, f) => s + f.size, 0);
  if (expected !== buf.length) {
    throw new Error(`${file}: truncated/corrupt (expected ${expected} bytes, got ${buf.length}) — re-pull it`);
  }
  for (const fr of manifest.frames) {
    const bytes = buf.subarray(off, off + fr.size);
    off += fr.size;
    const key = `${fr.code}|${fr.ts}`;
    if (seen.has(key)) {
      dupes++;
      continue;
    }
    seen.add(key);
    if (!byLabel.has(fr.code)) byLabel.set(fr.code, []);
    byLabel.get(fr.code).push({ ts: fr.ts, bytes });
  }
  console.log(`read ${manifest.frames.length} frames from ${path.basename(file)}`);
}

// ---- Assign splits: chunk0 → train; extra chunks round-robined globally to ~70/15/15. ----
const EXTRA = ['val', 'test', 'train', 'train', 'train']; // 1/5 val, 1/5 test, 3/5 train
let extraIdx = 0;
const HEADER_GT =
  'frame_id,ground_truth_code,verified_code,crop_count,status,reviewer,split,source_dir,frame_number,notes,verified_at';
const HEADER_MAN =
  'frame_id,source_dir,frame_dir,frame_number,raw_frame_path,split,crop_count,ground_truth_code,notes,session_observations';
const gtRows = [HEADER_GT];
const manRows = [HEADER_MAN];
const tally = { train: 0, val: 0, test: 0 };
const codeSet = new Set();
let negCount = 0;

for (const label of [...byLabel.keys()].sort()) {
  const frames = byLabel.get(label).sort((a, b) => a.ts - b.ts);
  const chunkSplit = new Map(); // chunk index -> split
  frames.forEach((f, fi) => {
    const chunk = Math.floor(fi / CHUNK);
    if (!chunkSplit.has(chunk)) {
      chunkSplit.set(chunk, chunk === 0 ? 'train' : EXTRA[extraIdx++ % EXTRA.length]);
    }
    const split = chunkSplit.get(chunk);
    const sourceDir = sanitize(`cap-${label}-c${chunk}`);
    const n = (fi % CHUNK) + 1;
    const dir = path.join(out, 'raw', sourceDir, 'debug', `frame-${n}`);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'frame.png'), f.bytes);

    const isNeg = label === '__neg__';
    if (isNeg) negCount++;
    else codeSet.add(label);
    tally[split]++;
    const frameId = `${sourceDir}__frame-${n}`;
    const rawPath = `raw/${sourceDir}/debug/frame-${n}/frame.png`;
    const iso = new Date(f.ts).toISOString();
    gtRows.push(
      [frameId, '', isNeg ? '' : label, '', isNeg ? 'not_sticker' : 'confirmed', 'capture-tool', split, sourceDir, String(n), 'from ?capture', iso].join(','),
    );
    manRows.push(
      [frameId, sourceDir, `${sourceDir}/debug/frame-${n}`, String(n), rawPath, split, '', isNeg ? '' : label, 'from ?capture', ''].join(','),
    );
  });
}

fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, 'ground_truth_verification.csv'), gtRows.join('\n') + '\n');
fs.writeFileSync(path.join(out, 'dataset_manifest.csv'), manRows.join('\n') + '\n');

const total = tally.train + tally.val + tally.test;
console.log(
  `\nwrote ${total} frames to ${out}${dupes ? ` (skipped ${dupes} duplicate frames)` : ''}\n` +
    `  splits: train=${tally.train} val=${tally.val} test=${tally.test}\n` +
    `  distinct codes: ${codeSet.size} · negatives: ${negCount}`,
);
for (const s of ['train', 'val', 'test']) {
  if (tally[s] === 0) console.warn(`  ⚠ split "${s}" is EMPTY — capture more frames per code (≥${CHUNK * 2} for val/test).`);
}
console.log(`bench it: PIXEL_DATASET=${out} npm run bench:pixel -- --split=all --engine=ensemble`);
