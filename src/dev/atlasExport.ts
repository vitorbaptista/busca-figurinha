// DEV-ONLY (not shipped — vite build input is pinned to index.html). Runs the real
// browser-rendered glyph atlas (buildAtlas) once and packs it into the binary format the
// native Android app loads (android/app/src/main/assets/glyph_atlas.bin). We MUST render in
// a real browser (node-canvas mis-renders, per CLAUDE.md), so scripts/export-atlas.mjs drives
// this page in headless Chrome and writes window.__ATLAS_B64__ to disk.
//
// Binary layout (little-endian), consumed by Atlas.kt parseAtlas:
//   "ATL1"            4 bytes magic
//   count             int32
//   featLen           int32   (== FEAT_LEN == 298)
//   labels            count bytes (one ASCII char per template)
//   feats             count*featLen float32  (each template's L2-normalized vector, exact)
//
// We dump buildAtlas() VERBATIM (its FloatArrays are already L2-normalized, and it already
// blends the real harvested templates), so the native FlatAtlas is byte-faithful to the PWA's
// runtime atlas — no re-tuning of the glyph FP gates needed.

import { buildAtlas } from '../ocr/glyphAtlas';
import { FEAT_LEN } from '../ocr/glyphFeatures';

function pack(): { b64: string; count: number; featLen: number } {
  const templates = buildAtlas();
  const count = templates.length;
  const featLen = FEAT_LEN;
  const HEADER = 12;
  const buf = new ArrayBuffer(HEADER + count + count * featLen * 4);
  const dv = new DataView(buf);
  dv.setUint8(0, 0x41); // 'A'
  dv.setUint8(1, 0x54); // 'T'
  dv.setUint8(2, 0x4c); // 'L'
  dv.setUint8(3, 0x31); // '1'
  dv.setInt32(4, count, true);
  dv.setInt32(8, featLen, true);
  let off = HEADER;
  for (let t = 0; t < count; t++) dv.setUint8(off++, templates[t].label.charCodeAt(0) & 0xff);
  for (let t = 0; t < count; t++) {
    const f = templates[t].feat;
    if (f.length !== featLen) throw new Error(`template ${t} feat len ${f.length} != ${featLen}`);
    for (let i = 0; i < featLen; i++) {
      dv.setFloat32(off, f[i], true);
      off += 4;
    }
  }
  // Chunked base64 (avoids String.fromCharCode stack overflow on the ~180KB buffer).
  const bytes = new Uint8Array(buf);
  let bin = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + CHUNK)));
  }
  return { b64: btoa(bin), count, featLen };
}

const w = window as unknown as {
  __ATLAS_B64__?: string;
  __ATLAS_INFO__?: { count: number; featLen: number };
  __ATLAS_READY__?: boolean;
  __ATLAS_ERROR__?: string;
};

try {
  const { b64, count, featLen } = pack();
  w.__ATLAS_B64__ = b64;
  w.__ATLAS_INFO__ = { count, featLen };
  w.__ATLAS_READY__ = true;
  const out = document.getElementById('out');
  if (out) out.textContent = `atlas ready: ${count} templates × ${featLen} (${b64.length} b64 chars)`;
} catch (e) {
  w.__ATLAS_ERROR__ = String((e as Error)?.message ?? e);
  w.__ATLAS_READY__ = true;
  const out = document.getElementById('out');
  if (out) out.textContent = `ERROR: ${w.__ATLAS_ERROR__}`;
}
