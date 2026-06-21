// DEV-ONLY real-frame accuracy benchmark (served at /bench-pixel.html; run headless via
// `npm run bench:pixel`). Unlike bench.ts (synthetic augmentations + a recorded video), this
// runs the EXACT production live path (findCodeBoxes → codeCropSource → recognizeFrameInOrder
// → bestMatchFromText, two-phase hybrid, stop-on-first) over the manually-verified Pixel frame
// dataset and scores it against the human ground truth.
//
// Ground truth (captures/datasets/.../ground_truth_verification.csv, served via /pixel/manifest):
//   status=confirmed + verified_code ⇒ a POSITIVE frame (the pill should read verified_code);
//   status=not_sticker             ⇒ a NEGATIVE frame (NOTHING should read).
//
// Reports, per split and overall:
//   • recall            — positive frames whose live read resolved verified_code.
//   • positive precision — of codes resolved on positive frames, share equal to verified_code.
//   • per-frame FP rate  — negative frames that resolved ANY code (the single-frame FP metric).
//   • confirmed/held FP  — runs the multi-frame CONFIRMER over each held-sticker run; the live
//                          app only commits after it agrees, so this should stay ~0.
//   • latency            — detection ms + OCR ms per pass (median / p95 / avg).
//   • per-miss stages    — why each missed positive failed: det:0boxes / crop:0ink /
//                          ocr:misread (resolved a WRONG code) / ocr:nomatch (read, no snap) /
//                          ocr:blank (OCR'd but read nothing).
//
// Runtime overrides via URL query (so ROI / gate sweeps need no rebuild):
//   ?split=train|val|test|all  ?roiTop=0.5  ?roiRect=0.18,0.32,0.82,0.58
//   ?fastConf=70  ?maxBoxes=2  ?limit=40 (first N frames, quick smoke)  ?note=...
// Output: Markdown → captures/bench-pixel-results.md (POST /pixel/log) + the page.

import { findCodeBoxes, codeCropCandidates, rawCropCandidates } from '../ocr/locate';
import type { CodeBox } from '../ocr/locate';
import { createHybridOcrEngine } from '../ocr/hybridEngine';
import { recognizeFrameInOrder, recognizeFrameCodeNet } from '../ocr/recognize';
import { createCodeNet, CODENET_GATES } from '../ocr/codeNetEngine';
import type { CodeNet } from '../ocr/codeNetEngine';
import { createConfirmer } from '../domain/confirm';
import { checklist } from '../data/checklist';
import { extractCodes } from '../domain/matching';
import type { MatchResult } from '../types';
import { CONFIG } from '../config';

const Q = new URLSearchParams(location.search);
const root = document.getElementById('out')!;
const status = document.createElement('div');
root.replaceChildren(status);

// ---- Apply runtime overrides to CONFIG (cast away readonly: dev harness only). ----
// Mutable view of the frozen-by-type CONFIG so a sweep can be driven from the URL.
const cfg = CONFIG as unknown as {
  ocr: { hybridFastConf: number };
  detect: {
    roiTopFraction: number;
    roiRect: { left: number; top: number; right: number; bottom: number } | null;
    maxBoxes: number;
    fgDelta: number;
  };
  codenet: {
    ttaEnabled: boolean;
    ttaMaxBoxes: number;
    ttaJitters: number;
    ttaVotes: number;
    ttaSoft: number;
    ttaHigh: number;
    ttaPost: number;
    ttaMargin: number;
  };
};
if (Q.has('fgDelta')) cfg.detect.fgDelta = Number(Q.get('fgDelta'));
if (Q.has('roiTop')) {
  cfg.detect.roiTopFraction = Number(Q.get('roiTop'));
  cfg.detect.roiRect = null;
}
if (Q.has('roiRect')) {
  const [left, top, right, bottom] = (Q.get('roiRect') || '').split(',').map(Number);
  cfg.detect.roiRect = { left, top, right, bottom };
}
if (Q.has('fastConf')) cfg.ocr.hybridFastConf = Number(Q.get('fastConf'));
if (Q.has('maxBoxes')) cfg.detect.maxBoxes = Number(Q.get('maxBoxes'));
// codeNet legacy gate overrides (kept for reference; CODENET_GATES is no longer on the live path).
if (Q.has('gatePost')) CODENET_GATES.minPosterior = Number(Q.get('gatePost'));
if (Q.has('gateMargin')) CODENET_GATES.minMargin = Number(Q.get('gateMargin'));
if (Q.has('gateMLP')) CODENET_GATES.minMeanLogProb = Number(Q.get('gateMLP'));
// Production codeNet-TTA knobs (CONFIG.codenet): driving these lets `--engine=codenet`/`ensemble`
// sweep the EXACT shipped recognizeFrameCodeNet path on the dataset (no prod/bench drift).
if (Q.has('ttaMaxBoxes')) cfg.codenet.ttaMaxBoxes = Number(Q.get('ttaMaxBoxes'));
if (Q.has('ttaJit')) cfg.codenet.ttaJitters = Number(Q.get('ttaJit'));
if (Q.has('ttaVotes')) cfg.codenet.ttaVotes = Number(Q.get('ttaVotes'));
if (Q.has('ttaSoft')) cfg.codenet.ttaSoft = Number(Q.get('ttaSoft'));
if (Q.has('ttaHigh')) cfg.codenet.ttaHigh = Number(Q.get('ttaHigh'));
if (Q.has('ttaPost')) cfg.codenet.ttaPost = Number(Q.get('ttaPost'));
if (Q.has('ttaMargin')) cfg.codenet.ttaMargin = Number(Q.get('ttaMargin'));
const SPLIT = (Q.get('split') || 'all').toLowerCase();
const LIMIT = Q.has('limit') ? Number(Q.get('limit')) : Infinity;
const NOTE = Q.get('note') || '';
// ?debugFrame=<substring> dumps detected boxes + prepared-crop ink for matching frames into
// the report (diagnose det:0boxes / crop:0ink) instead of running the normal benchmark.
const DEBUG_FRAME = Q.get('debugFrame') || '';
// ?deriveAliases=1 (use with --split=train): for each positive frame the pipeline RESOLVES
// NOTHING on, emit candidate garble→code aliases (a high-confidence read token whose digits
// match the true code but whose letters don't form a real code). Aggregated offline into a
// per-sticker alias model. MUST be derived on TRAIN only.
const DERIVE_ALIASES = Q.has('deriveAliases');

/** Ink fraction of a prepared (black-on-white) crop — what cropHasOcrInk thresholds. */
function inkFraction(crop: HTMLCanvasElement): number {
  const ctx = crop.getContext('2d', { willReadFrequently: true });
  if (!ctx || crop.width < 1 || crop.height < 1) return -1;
  const d = ctx.getImageData(0, 0, crop.width, crop.height).data;
  let ink = 0;
  for (let i = 0; i < d.length; i += 4) if (d[i] < 128) ink++;
  return ink / (crop.width * crop.height);
}

interface ManifestRow {
  frameId: string;
  verifiedCode: string;
  status: 'confirmed' | 'not_sticker';
  split: string;
  sourceDir: string;
  frameNumber: number;
}

function stats(xs: number[]): { avg: number; median: number; p95: number; max: number } {
  if (!xs.length) return { avg: 0, median: 0, p95: 0, max: 0 };
  const s = [...xs].sort((a, b) => a - b);
  const at = (p: number) => s[Math.min(s.length - 1, Math.floor(p * s.length))];
  return {
    avg: Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10,
    median: Math.round(at(0.5)),
    p95: Math.round(at(0.95)),
    max: Math.round(s[s.length - 1]),
  };
}

async function loadImage(url: string): Promise<HTMLCanvasElement> {
  const img = new Image();
  img.src = url;
  await img.decode();
  const c = document.createElement('canvas');
  c.width = img.naturalWidth;
  c.height = img.naturalHeight;
  c.getContext('2d')!.drawImage(img, 0, 0);
  return c;
}

// ---- Multi-crop test-time augmentation (TTA) for codeNet (dev experiment) ----
// Within ONE frame, give the recognizer several looks at each detected pill — upright + flip raw
// crops PLUS jittered re-crops at a few scales/offsets — score them UNGATED, and accept the
// closed-set code the most crops independently agree on (with an aggregate posterior/margin gate).
// Agreement is the 0-FP guard: noise crops scatter across random codes and rarely agree ≥N times,
// while a real pill's code recurs across its variants — so a LOWER per-crop bar buys recall without
// manufacturing codes on negatives. This is strictly per-frame (uses only that frame's pixels).
const TTA_POST = Q.has('ttaPost') ? Number(Q.get('ttaPost')) : 0.5;
const TTA_VOTES = Q.has('ttaVotes') ? Number(Q.get('ttaVotes')) : 2;
const TTA_MARGIN = Q.has('ttaMargin') ? Number(Q.get('ttaMargin')) : 0.5;
const TTA_SOFT = Q.has('ttaSoft') ? Number(Q.get('ttaSoft')) : 0.2; // a crop "votes" above this posterior
const TTA_HIGH = Q.has('ttaHigh') ? Number(Q.get('ttaHigh')) : 0.8; // a crop "high-votes" above this posterior
const TTA_MODE = (Q.get('ttaMode') || 'hard').toLowerCase(); // 'hard' (argmax votes) | 'soft' (posterior-sum)

function jitterBox(b: CodeBox, sx: number, sy: number, dx: number, dy: number): CodeBox {
  const cx = b.x + b.w / 2;
  const cy = b.y + b.h / 2;
  const w = b.w * sx;
  const h = b.h * sy;
  return { ...b, x: cx - w / 2 + b.w * dx, y: cy - h / 2 + b.h * dy, w, h, pillW: b.pillW * Math.min(sx, sy) };
}

const TTA_JITTERS_ALL = [
  { sx: 1, sy: 1, dx: 0, dy: 0 },
  { sx: 1.18, sy: 1.18, dx: 0, dy: 0 },
  { sx: 0.88, sy: 0.9, dx: 0, dy: 0 },
  { sx: 1.12, sy: 1.0, dx: 0.05, dy: 0 },
  { sx: 1.12, sy: 1.0, dx: -0.05, dy: 0 },
  { sx: 1.0, sy: 1.2, dx: 0, dy: 0.04 },
];
// ?ttaJit=N → use the first N jitter variants (fewer crops = faster; for the ≤250ms budget).
const TTA_JITTERS = Q.has('ttaJit')
  ? TTA_JITTERS_ALL.slice(0, Math.max(1, Number(Q.get('ttaJit'))))
  : TTA_JITTERS_ALL;

async function recognizeFrameCodeNetTTA(
  models: CodeNet[],
  frame: HTMLCanvasElement,
  onDetected?: () => void,
): Promise<{ resolved: MatchResult[]; reads: string[]; crops: number; scoredReads: [] }> {
  const boxes = findCodeBoxes(frame).slice(0, CONFIG.detect.maxBoxes);
  onDetected?.();
  const crops: HTMLCanvasElement[] = [];
  for (const box of boxes) {
    for (const j of TTA_JITTERS) {
      const raws = rawCropCandidates(frame, jitterBox(box, j.sx, j.sy, j.dx, j.dy));
      if (raws[0]) crops.push(raws[0]);
    }
    const raws = rawCropCandidates(frame, box);
    if (raws[1]) crops.push(raws[1]); // un-jittered 180° flip (orientation ambiguity)
  }
  if (!crops.length) return { resolved: [], reads: [], crops: 0, scoredReads: [] };
  // Score every crop with every model; votes accumulate across models AND crop variants, so a code
  // both models read confidently dominates, and a single model's idiosyncratic confusion is outvoted.
  const scored = (await Promise.all(models.map((m) => m.recognizeScored(crops, TTA_MODE === 'soft')))).flat();
  const agg = new Map<string, { votes: number; highVotes: number; maxPost: number; maxMargin: number; postSum: number }>();
  const bump = (code: string, post: number, margin: number) => {
    const a = agg.get(code) ?? { votes: 0, highVotes: 0, maxPost: 0, maxMargin: -Infinity, postSum: 0 };
    if (post >= TTA_SOFT) a.votes++;
    if (post >= TTA_HIGH) a.highVotes++;
    a.maxPost = Math.max(a.maxPost, post);
    a.maxMargin = Math.max(a.maxMargin, margin);
    a.postSum += post;
    agg.set(code, a);
  };
  const reads: string[] = [];
  for (const s of scored) {
    if (!s.rawCode) continue;
    if (s.posterior >= TTA_SOFT) reads.push(`${s.rawCode}@${s.posterior.toFixed(2)}`);
    if (TTA_MODE === 'soft') {
      // Soft voting: every top-K candidate of every crop accumulates its posterior. A correct code
      // that is consistently the RUNNER-UP (e.g. AUT8 behind AUT4) builds a high posterior-sum and
      // can overtake the locally-preferred wrong code.
      for (const t of s.top ?? []) bump(t.code, t.posterior, -Infinity);
    } else {
      bump(s.rawCode, s.posterior, s.margin); // hard voting: only the per-crop argmax
    }
  }
  // FP guard = agreement: a code must appear (≥TTA_SOFT posterior) in ≥TTA_VOTES crops to be
  // eligible (noise scatters, so it rarely agrees). HARD mode ranks eligible codes by high-conf
  // vote count then peak posterior (a real pill read confidently beats a spurious soft-vote pileup,
  // and several high-conf reads beat a 1.0-tie). SOFT mode ranks by posterior-sum (rewards a
  // consistent runner-up). maxMargin gate applies only in hard mode (soft has no per-code margin).
  let bestCode = '';
  let bestHigh = -1;
  let bestPost = -1;
  let bestSum = -1;
  for (const [code, a] of agg) {
    if (a.votes < TTA_VOTES) continue;
    if (TTA_MODE === 'soft') {
      if (a.postSum > bestSum) {
        bestSum = a.postSum;
        bestCode = code;
      }
    } else if (a.highVotes > bestHigh || (a.highVotes === bestHigh && a.maxPost > bestPost)) {
      bestHigh = a.highVotes;
      bestPost = a.maxPost;
      bestCode = code;
    }
  }
  const resolved: MatchResult[] = [];
  if (bestCode) {
    const a = agg.get(bestCode)!;
    const entry = checklist.byCode.get(bestCode);
    if (entry && a.maxPost >= TTA_POST && (TTA_MODE === 'soft' || a.maxMargin >= TTA_MARGIN)) {
      resolved.push({ raw: bestCode, status: 'exact', entry, distance: 0 });
    }
  }
  return { resolved, reads, crops: crops.length, scoredReads: [] };
}

// ---- Recenter-on-pill (?recenter=1): simulate correct aiming ----
// In production a reticle constrains WHERE the user places the sticker (== the ROI), so a frame
// whose pill landed outside the ROI is a mis-aim that won't happen live. Per the product owner
// ("assume the user put the image in the correct ROI"), we recover those frames by translating the
// frame so its pill sits at the ROI centre — WITHOUT penalising or altering frames that already
// aimed well (no-regression): we only recenter when fixed-ROI detection finds NO confident pill,
// and we locate the pill from a FULL-FRAME detection pass (the strongest pill-shaped blob — exactly
// what the reticle + user align). Frames with a good in-ROI box are returned untouched.
const RECENTER = Q.has('recenter') && Q.get('recenter') !== '0';
const RECENTER_MIN_SCORE = 0.7;

function recenterOnPill(frame: HTMLCanvasElement): HTMLCanvasElement {
  // Already well-aimed? (a confident pill in the current ROI) → leave untouched.
  const inRoi = findCodeBoxes(frame).slice(0, CONFIG.detect.maxBoxes);
  if (inRoi.some((b) => b.score >= RECENTER_MIN_SCORE)) return frame;
  // Mis-aimed: find the pill anywhere via a full-frame detection pass.
  const savedRect = cfg.detect.roiRect;
  const savedTop = cfg.detect.roiTopFraction;
  cfg.detect.roiRect = null;
  cfg.detect.roiTopFraction = 0;
  const all = findCodeBoxes(frame);
  cfg.detect.roiRect = savedRect;
  cfg.detect.roiTopFraction = savedTop;
  if (!all.length) return frame;
  all.sort((a, b) => b.score - a.score);
  const b = all[0];
  if (b.score < RECENTER_MIN_SCORE) return frame; // no confident pill anywhere → leave as-is
  const roi = cfg.detect.roiRect;
  const tcx = (roi ? (roi.left + roi.right) / 2 : 0.5) * frame.width;
  const tcy = (roi ? (roi.top + roi.bottom) / 2 : 0.45) * frame.height;
  const dx = Math.round(tcx - (b.x + b.w / 2));
  const dy = Math.round(tcy - (b.y + b.h / 2));
  if (Math.abs(dx) < 2 && Math.abs(dy) < 2) return frame;
  const out = document.createElement('canvas');
  out.width = frame.width;
  out.height = frame.height;
  const ctx = out.getContext('2d', { willReadFrequently: true });
  if (!ctx) return frame;
  ctx.drawImage(frame, 0, 0); // base fill so exposed edges aren't black (no fake dark blobs)
  ctx.drawImage(frame, dx, dy); // shifted: the pill now sits at the ROI centre
  return out;
}

type MissStage = 'det:0boxes' | 'crop:0ink' | 'ocr:misread' | 'ocr:nomatch' | 'ocr:blank';

interface FrameResult {
  row: ManifestRow;
  resolved: string[]; // checklist codes resolved this frame (live, stop-on-first)
  reads: string[];
  cropsOcrd: number;
  boxCount: number;
  det: number;
  ocr: number;
  hit: boolean; // positive: resolved verifiedCode
  miss?: MissStage;
}

function classifyMiss(r: Omit<FrameResult, 'miss' | 'hit'>): MissStage {
  if (r.boxCount === 0) return 'det:0boxes';
  if (r.cropsOcrd === 0) return 'crop:0ink';
  if (r.resolved.length > 0) return 'ocr:misread'; // resolved a code, just the wrong one
  if (r.reads.length > 0) return 'ocr:nomatch'; // OCR read text but nothing snapped
  return 'ocr:blank'; // OCR ran but read nothing legible
}

const ENGINE = (Q.get('engine') || 'hybrid').toLowerCase(); // 'hybrid' | 'codenet'

(async () => {
  status.textContent = 'init OCR…';
  const ocr = createHybridOcrEngine();
  await ocr.init();
  const codeNet = createCodeNet(checklist);
  const ttaModels = [codeNet];
  if (ENGINE !== 'hybrid') {
    status.textContent = 'loading codeNet…';
    await codeNet.init(Q.get('model') || '/models/codenet/model.json');
    // Optional second model for multi-model TTA voting (?model2=…).
    if (Q.has('model2')) {
      const cn2 = createCodeNet(checklist);
      await cn2.init(Q.get('model2')!);
      ttaModels.push(cn2);
    }
  }


  let manifest = (await (await fetch('/pixel/manifest')).json()) as ManifestRow[];
  if (SPLIT !== 'all') manifest = manifest.filter((r) => r.split === SPLIT);
  // Deterministic order: by session then frame number (also defines held-sticker runs).
  manifest.sort((a, b) =>
    a.sourceDir === b.sourceDir
      ? a.frameNumber - b.frameNumber
      : a.sourceDir < b.sourceDir
        ? -1
        : 1,
  );
  if (Number.isFinite(LIMIT)) manifest = manifest.slice(0, LIMIT);

  // ---- Debug mode: dump boxes + prepared-crop ink for frames matching ?debugFrame= ----
  if (DEBUG_FRAME) {
    const out: string[] = ['# bench:pixel debug — boxes & crop ink', '', `match: \`${DEBUG_FRAME}\``, ''];
    const hits = manifest.filter((r) => r.frameId.includes(DEBUG_FRAME)).slice(0, 12);
    for (const row of hits) {
      const frame = await loadImage(`/pixel/frame?id=${encodeURIComponent(row.frameId)}`);
      const boxes = findCodeBoxes(frame).slice(0, CONFIG.detect.maxBoxes);
      out.push(`## ${row.frameId} want=${row.verifiedCode} (${frame.width}x${frame.height}) — ${boxes.length} boxes`);
      for (let i = 0; i < boxes.length; i++) {
        const b = boxes[i];
        const crops = codeCropCandidates(frame, b);
        const inks = crops.map((c) => `${c.width}x${c.height} ink=${(inkFraction(c) * 100).toFixed(1)}%`);
        out.push(
          `- box${i}: score=${b.score.toFixed(2)} ${Math.round(b.w)}x${Math.round(b.h)} @(${Math.round(b.x)},${Math.round(b.y)}) fill=${b.fill.toFixed(2)} pillW=${b.pillW.toFixed(0)} tilt=${b.tilt === null ? '-' : Math.round(b.tilt)} boost=${b.boost} → crops[${inks.join(' | ')}]`,
        );
        // Dump the raw region + prepared crop of the top 2 boxes as images (saved to captures/).
        if (i < 2) {
          const raw = rawCropCandidates(frame, b)[0];
          const save = async (cv: HTMLCanvasElement, tag: string) => {
            await fetch('/__capture', {
              method: 'POST',
              body: JSON.stringify({ name: `dbg_${row.frameId}_box${i}_${tag}`, dataUrl: cv.toDataURL('image/png') }),
            }).catch(() => {});
          };
          await save(raw, 'raw');
          await save(crops[0], 'prep');
        }
      }
      out.push('');
    }
    await fetch('/pixel/log', { method: 'POST', body: out.join('\n') }).catch(() => {});
    await ocr.terminate();
    status.textContent = 'debug done';
    document.title = 'bench done';
    return;
  }

  // ---- Alias-derivation mode: collect candidate garble→code aliases from missed positives. ----
  if (DERIVE_ALIASES) {
    // raw → Map(code → {count, sumConf, bestConf})
    const cand = new Map<string, Map<string, { count: number; bestConf: number }>>();
    for (let i = 0; i < manifest.length; i++) {
      const row = manifest[i];
      if (row.status !== 'confirmed') continue;
      status.textContent = `derive ${i + 1}/${manifest.length}…`;
      const frame = await loadImage(`/pixel/frame?id=${encodeURIComponent(row.frameId)}`);
      const { resolved, scoredReads } = await recognizeFrameInOrder(ocr, frame, checklist, true);
      if (resolved.length > 0) continue; // only frames that resolve NOTHING (the apply path)
      const wantDigits = row.verifiedCode.match(/\d+$/)?.[0] ?? '';
      for (const s of scoredReads) {
        for (const tok of extractCodes(s.text)) {
          const m = /^([A-Z]{2,4})(\d{1,3})$/.exec(tok);
          if (!m || m[2] !== wantDigits) continue; // digits must match the true number
          if (checklist.byCode.has(tok)) continue; // already a real code (not a garble)
          if (!cand.has(tok)) cand.set(tok, new Map());
          const inner = cand.get(tok)!;
          const cur = inner.get(row.verifiedCode) ?? { count: 0, bestConf: 0 };
          cur.count++;
          cur.bestConf = Math.max(cur.bestConf, s.conf);
          inner.set(row.verifiedCode, cur);
        }
      }
    }
    // Keep only UNAMBIGUOUS aliases: a raw that maps to exactly ONE code across train.
    const lines: string[] = ['# alias candidates (TRAIN) — raw → code (count, bestConf)', ''];
    const kept: string[] = [];
    const dropped: string[] = [];
    for (const [raw, inner] of [...cand.entries()].sort()) {
      if (inner.size === 1) {
        const [code, v] = [...inner.entries()][0];
        kept.push(`  "${raw}": "${code}", // n=${v.count} conf=${v.bestConf.toFixed(0)}`);
      } else {
        dropped.push(`  ${raw} → AMBIGUOUS {${[...inner.keys()].join(', ')}}`);
      }
    }
    lines.push(`## kept (${kept.length} unambiguous)`, '', ...kept, '');
    lines.push(`## dropped (${dropped.length} ambiguous)`, '', ...dropped, '');
    await fetch('/pixel/log', { method: 'POST', body: lines.join('\n') }).catch(() => {});
    await ocr.terminate();
    status.textContent = 'derive done';
    document.title = 'bench done';
    return;
  }

  const results: FrameResult[] = [];
  let warm = 3; // drop first few from the latency sample (JIT / first tesseract dispatch)
  const detT: number[] = [];
  const ocrT: number[] = [];
  const totalT: number[] = [];

  for (let i = 0; i < manifest.length; i++) {
    const row = manifest[i];
    status.textContent = `frame ${i + 1}/${manifest.length} (${row.frameId})…`;
    let frame = await loadImage(`/pixel/frame?id=${encodeURIComponent(row.frameId)}`);
    if (RECENTER) frame = recenterOnPill(frame);

    const t0 = performance.now();
    let t1 = t0;
    let codes: string[];
    let reads: string[];
    let crops: number;
    if (ENGINE === 'codenet') {
      const out = await recognizeFrameCodeNet(codeNet, frame, checklist, true, () => {
        t1 = performance.now();
      });
      codes = out.resolved.map((m) => m.entry!.code);
      reads = out.reads;
      crops = out.crops;
    } else if (ENGINE === 'codenet-tta') {
      const out = await recognizeFrameCodeNetTTA(ttaModels, frame, () => {
        t1 = performance.now();
      });
      codes = out.resolved.map((m) => m.entry!.code);
      reads = out.reads;
      crops = out.crops;
    } else if (ENGINE === 'ensemble-tta') {
      // codeNet TTA first; classical hybrid only when TTA resolves nothing.
      const cn = await recognizeFrameCodeNetTTA(ttaModels, frame, () => {
        t1 = performance.now();
      });
      if (cn.resolved.length) {
        codes = cn.resolved.map((m) => m.entry!.code);
        reads = cn.reads;
        crops = cn.crops;
      } else {
        const hy = await recognizeFrameInOrder(ocr, frame, checklist, true);
        codes = hy.resolved.map((m) => m.entry!.code);
        reads = [...cn.reads, ...hy.reads];
        crops = cn.crops + hy.crops;
      }
    } else if (ENGINE === 'ensemble') {
      // Cascade: codeNet (strong on raw crops) first; only if it resolves nothing, fall back to
      // the classical hybrid. Combines complementary hits while paying the hybrid only on misses.
      const cn = await recognizeFrameCodeNet(codeNet, frame, checklist, true, () => {
        t1 = performance.now();
      });
      if (cn.resolved.length) {
        codes = cn.resolved.map((m) => m.entry!.code);
        reads = cn.reads;
        crops = cn.crops;
      } else {
        const hy = await recognizeFrameInOrder(ocr, frame, checklist, true);
        codes = hy.resolved.map((m) => m.entry!.code);
        reads = [...cn.reads, ...hy.reads];
        crops = cn.crops + hy.crops;
      }
    } else {
      const out = await recognizeFrameInOrder(ocr, frame, checklist, true, () => {
        t1 = performance.now();
      });
      codes = out.resolved.map((m) => m.entry!.code);
      reads = out.reads;
      crops = out.crops;
    }
    const t2 = performance.now();
    if (warm > 0) {
      warm--;
    } else {
      detT.push(t1 - t0);
      ocrT.push(t2 - t1);
      totalT.push(t2 - t0);
    }

    const isPos = row.status === 'confirmed';
    const hit = isPos && codes.includes(row.verifiedCode);
    // Box count for miss classification (untimed; rect/band ROI applied via CONFIG).
    const boxCount = hit ? -1 : findCodeBoxes(frame).slice(0, CONFIG.detect.maxBoxes).length;
    const base = { row, resolved: codes, reads, cropsOcrd: crops, boxCount, det: t1 - t0, ocr: t2 - t1 };
    const fr: FrameResult = { ...base, hit };
    if (isPos && !hit) fr.miss = classifyMiss(base);
    results.push(fr);
  }

  // ---- Metrics ----
  const splitsPresent = [...new Set(results.map((r) => r.row.split))].sort();
  const groups: Array<{ name: string; rows: FrameResult[] }> = [
    { name: 'ALL', rows: results },
    ...splitsPresent.map((s) => ({ name: s, rows: results.filter((r) => r.row.split === s) })),
  ];

  const pct = (n: number, d: number) => (d ? ((100 * n) / d).toFixed(1) : '0.0');

  const summaryRows: string[] = [
    '| split | pos | recall | pos-precision | neg | per-frame FP | wrong-on-pos |',
    '|---|---|---|---|---|---|---|',
  ];
  for (const g of groups) {
    const pos = g.rows.filter((r) => r.row.status === 'confirmed');
    const neg = g.rows.filter((r) => r.row.status === 'not_sticker');
    const hits = pos.filter((r) => r.hit).length;
    // resolved codes on positive frames: correct vs wrong (wrong = a code != verified).
    let posResolvedCorrect = 0;
    let posResolvedWrong = 0;
    for (const r of pos) {
      if (r.resolved.includes(r.row.verifiedCode)) posResolvedCorrect++;
      else if (r.resolved.length > 0) posResolvedWrong++;
    }
    const negFp = neg.filter((r) => r.resolved.length > 0).length;
    summaryRows.push(
      `| ${g.name} | ${pos.length} | **${pct(hits, pos.length)}%** (${hits}/${pos.length}) | ` +
        `${pct(posResolvedCorrect, posResolvedCorrect + posResolvedWrong)}% | ${neg.length} | ` +
        `**${pct(negFp, neg.length)}%** (${negFp}/${neg.length}) | ${posResolvedWrong} |`,
    );
  }

  // ---- Confirmed / held-sticker FP (and recall) over consecutive same-sticker runs. ----
  // A held run = consecutive frames (already sorted by session+frameNumber) sharing the same
  // (sourceDir, status, verifiedCode). The confirmer commits a code only after CONFIG.match
  // .confirmations frames agree — the shipped guard. We report held recall + any held FP.
  const conf = CONFIG.match.confirmations;
  type Held = { kind: 'pos' | 'neg'; code: string; rows: FrameResult[] };
  const held: Held[] = [];
  for (const r of results) {
    const last = held[held.length - 1];
    const kind = r.row.status === 'confirmed' ? 'pos' : 'neg';
    const code = r.row.verifiedCode;
    if (
      last &&
      last.rows[0].row.sourceDir === r.row.sourceDir &&
      last.kind === kind &&
      last.code === code
    ) {
      last.rows.push(r);
    } else {
      held.push({ kind, code, rows: [r] });
    }
  }
  let heldPosEval = 0;
  let heldPosConfirmed = 0;
  let heldPosWrongCommit = 0; // committed a WRONG code on a positive run (bad)
  let heldNegEval = 0;
  let heldNegCommit = 0; // committed ANY code on a not-sticker run (bad)
  const heldFpDetail: string[] = [];
  for (const h of held) {
    if (h.rows.length < conf) continue; // not enough frames to ever confirm
    const c = createConfirmer(conf);
    const committed = new Set<string>();
    for (const r of h.rows) c.add(r.resolved).forEach((x) => committed.add(x));
    const where = `${h.rows[0].row.sourceDir} f${h.rows[0].row.frameNumber}-${h.rows[h.rows.length - 1].row.frameNumber}`;
    if (h.kind === 'pos') {
      heldPosEval++;
      if (committed.has(h.code)) heldPosConfirmed++;
      for (const x of committed)
        if (x !== h.code) {
          heldPosWrongCommit++;
          heldFpDetail.push(`- POS run ${where} want=${h.code} committed WRONG **${x}**`);
        }
    } else {
      heldNegEval++;
      if (committed.size > 0) {
        heldNegCommit++;
        heldFpDetail.push(`- NEG run ${where} committed **${[...committed].join(' ')}**`);
      }
    }
  }

  // ---- Per-frame false positives (negatives that resolved a code; positives that resolved
  //      a WRONG code). The cardinal 0-FP rule lives here. ----
  const negFpList = results
    .filter((r) => r.row.status === 'not_sticker' && r.resolved.length > 0)
    .map((r) => `- NEG ${r.row.frameId} got=[${r.resolved.join(' ')}] reads=\`${r.reads.join(' | ').slice(0, 70)}\``);
  const wrongPosList = results
    .filter((r) => r.row.status === 'confirmed' && !r.hit && r.resolved.length > 0)
    .map(
      (r) =>
        `- POS ${r.row.frameId} want=${r.row.verifiedCode} got=[${r.resolved.join(' ')}] reads=\`${r.reads.join(' | ').slice(0, 70)}\``,
    );

  // ---- Per-miss failure-stage table (positives only). ----
  const stageOrder: MissStage[] = ['det:0boxes', 'crop:0ink', 'ocr:misread', 'ocr:nomatch', 'ocr:blank'];
  const stageCount = new Map<MissStage, number>();
  for (const r of results) if (r.miss) stageCount.set(r.miss, (stageCount.get(r.miss) ?? 0) + 1);
  const missTotal = [...stageCount.values()].reduce((a, b) => a + b, 0);

  // ---- Latency ----
  const dS = stats(detT);
  const oS = stats(ocrT);
  const tS = stats(totalT);

  // ---- Build report ----
  const roiDesc = cfg.detect.roiRect
    ? `rect ${cfg.detect.roiRect.left},${cfg.detect.roiRect.top},${cfg.detect.roiRect.right},${cfg.detect.roiRect.bottom}`
    : `band roiTop=${cfg.detect.roiTopFraction}`;
  const missList = results
    .filter((r) => r.miss)
    .map(
      (r) =>
        `- ${r.row.frameId} [${r.miss}] want=${r.row.verifiedCode} got=[${r.resolved.join(' ') || '—'}] reads=\`${r.reads.join(' | ').slice(0, 70) || '—'}\``,
    );

  const md = [
    '# Web OCR — real-frame (Pixel) benchmark',
    '',
    `- split: **${SPLIT}** · ROI: **${roiDesc}** · fastConf=${cfg.ocr.hybridFastConf} · maxBoxes=${cfg.detect.maxBoxes} · confirmations=${conf}`,
    NOTE ? `- note: ${NOTE}` : '',
    `- frames scored: ${results.length}${Number.isFinite(LIMIT) ? ' (LIMITED)' : ''}`,
    '',
    '## Accuracy (per-frame)',
    '',
    ...summaryRows,
    '',
    '## Confirmed / held-sticker (multi-frame confirmer — the shipped guard)',
    '',
    `- held positive runs (≥${conf} frames): **${heldPosConfirmed}/${heldPosEval} confirmed**`,
    `- held positive WRONG commits (false code on a real sticker): **${heldPosWrongCommit}** _(must be 0)_`,
    `- held not-sticker runs (≥${conf} frames): ${heldNegEval}; committed a code on **${heldNegCommit}** _(must be 0)_`,
    ...(heldFpDetail.length ? ['', ...heldFpDetail] : []),
    '',
    '## False positives — per-frame (cardinal 0-FP rule)',
    '',
    `Negatives that resolved a code: **${negFpList.length}** · positives that resolved a WRONG code: **${wrongPosList.length}**`,
    '',
    ...(negFpList.length ? negFpList : ['- (none on negatives)']),
    ...(wrongPosList.length ? ['', ...wrongPosList] : []),
    '',
    '## Latency (ms/pass; first 3 frames dropped as warm-up)',
    '',
    '| stage | avg | median | p95 | max |',
    '|---|---|---|---|---|',
    `| detection | ${dS.avg} | ${dS.median} | ${dS.p95} | ${dS.max} |`,
    `| OCR | ${oS.avg} | ${oS.median} | ${oS.p95} | ${oS.max} |`,
    `| **total** | ${tS.avg} | ${tS.median} | ${tS.p95} | ${tS.max} |`,
    '',
    '## Per-miss failure stage (positives that did not resolve their code)',
    '',
    `Total missed positives: **${missTotal}**`,
    '',
    '| stage | count | meaning |',
    '|---|---|---|',
    `| det:0boxes | ${stageCount.get('det:0boxes') ?? 0} | detector found no pill (ROI/threshold) |`,
    `| crop:0ink | ${stageCount.get('crop:0ink') ?? 0} | box(es) found but every crop blanked (sparse-ink gate / empty) |`,
    `| ocr:misread | ${stageCount.get('ocr:misread') ?? 0} | resolved a DIFFERENT real code (also a per-frame FP) |`,
    `| ocr:nomatch | ${stageCount.get('ocr:nomatch') ?? 0} | OCR read text but it did not snap to a code |`,
    `| ocr:blank | ${stageCount.get('ocr:blank') ?? 0} | OCR ran but read nothing legible |`,
    '',
    `_stage order of precedence: ${stageOrder.join(' → ')}_`,
    '',
    '<details><summary>missed positives</summary>',
    '',
    ...missList,
    '',
    '</details>',
    '',
    '_done_',
  ]
    .filter((l) => l !== '')
    .join('\n');

  await fetch('/pixel/log', { method: 'POST', body: md }).catch(() => {});
  await ocr.terminate();
  status.textContent = 'pixel bench done — see captures/bench-pixel-results.md';
  document.title = 'bench done';
})();
