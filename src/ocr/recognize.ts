// The ONE recognition strategy shared by the live scanner (ScanScreen), the accuracy
// bench, and the latency bench — so they can never drift. Speed comes from doing the
// LEAST OCR that still resolves the code:
//
//   • Boxes come from findCodeBoxes already sorted best-first (the real code pill is the
//     top-scoring box). We only consider the top few — a real frame has one pill (or a
//     handful in a multi-up shot); the long tail of weak boxes is card noise that costs
//     OCR time and never resolves a code.
//   • We OCR in ROUNDS: round 1 is every box's UPRIGHT crop, round 2 the 180° FLIP crops
//     of the boxes that didn't resolve. Within a round the crops run in PARALLEL across
//     the worker pool (recognizeMany), so the pool stays busy; between rounds we stop
//     early once a code resolves. The prominent pill is box[0] and reads upright on round
//     one, so a clean frame finishes after a single parallel round of a few crops — the
//     flip round (and the flips of resolved boxes) never run.
//
// The matcher (bestMatchFromText) stays the conservative one — it never invents a code —
// so doing less OCR can only ever skip work, never manufacture a false positive.

import type { OcrEngine, MatchResult, Checklist } from '../types';
import { findCodeBoxes, codeCropSource, cropHasOcrInk } from './locate';
import { bestMatchFromText } from '../domain/matching';

/** Cap on boxes OCR'd per frame. findCodeBoxes sorts best-first, and the real code pill is
 *  usually box[0] (or a near-duplicate re-segmentation in the next slot). Lower boxes are
 *  weaker — partial pills on far/tilted stickers, plus card noise (legal text, logo
 *  fragments) — so each extra box trades latency for a bit more recall. 4 is the measured
 *  knee: blank-crop skipping (cropHasOcrInk) means most of these 4 cost nothing on frames
 *  that hold no readable pill, so the latency bench stays ~88ms median while the real-life
 *  video frames go from 0→4 of 6 read (the lower boxes recover the far/small pills that
 *  box[0] alone misses). Pushing to 8 recovers one more static multi-up frame but lands the
 *  median ~140ms — over the 100ms budget — so we hold at 4 and lean on the live burst's
 *  cross-frame confirmer for any pill briefly outranked as the hold shifts. */
const MAX_BOXES = 4;

export interface RecognizeOutcome {
  /** Resolved checklist matches, one per unique entry, in first-seen order. */
  resolved: MatchResult[];
  /** The raw OCR texts that actually ran, for debug/log lines. */
  reads: string[];
  /** Number of crops actually sent to OCR (the latency-relevant work). */
  crops: number;
}

/** One pending box: a lazy source for its prepared crop variants (upright = index 0, 180°
 *  flip = index 1), a memo of the ones built so far, and whether it has already resolved a
 *  code (so its flip round is skipped). The flip's prep is only built if round 1 reaches it. */
interface Pending {
  src: { count: number; build: (i: number) => HTMLCanvasElement };
  built: HTMLCanvasElement[];
  done: boolean;
}

/**
 * Recognize a frame by OCR'ing located crops best-first, in parallel rounds (upright then
 * flip), stopping as soon as a code resolves.
 *
 * @param stopOnFirstCode  true for the live burst and the latency bench: stop the whole
 *   frame at the first resolved code (the prominent pill is box[0], so the frame resolves
 *   on round one). false for the multi-sticker static recall, which wants every distinct
 *   code in one frame but STILL skips the flip of any box that already resolved upright.
 */
export async function recognizeFrameInOrder(
  ocr: OcrEngine,
  frame: HTMLCanvasElement,
  checklist: Checklist,
  stopOnFirstCode: boolean,
  /** Called the instant detection (findCodeBoxes) finishes — lets the latency bench split
   *  detection time from OCR time without forking the code path it's measuring. */
  onDetected?: () => void,
): Promise<RecognizeOutcome> {
  const boxes = findCodeBoxes(frame).slice(0, MAX_BOXES);
  onDetected?.();

  const resolved: MatchResult[] = [];
  const seen = new Set<string>();
  const reads: string[] = [];
  let crops = 0;

  // A lazy crop source per box — the RAW crops are extracted now (cheap), but each variant's
  // expensive prep (prepForOcr) is deferred to the round that actually uses it.
  const pending: Pending[] = boxes.map((box) => ({
    src: codeCropSource(frame, box),
    built: [],
    done: false,
  }));

  // Round r OCRs variant index r of every still-pending box, in parallel.
  for (let round = 0; round < 2; round++) {
    const jobs: Array<{ p: Pending; crop: HTMLCanvasElement }> = [];
    for (const p of pending) {
      if (p.done) continue;
      if (round >= p.src.count) continue;
      // Prepare (and memoize) only this variant now — the flip is built only if we reach here
      // in round 1, so the common upright-resolves case never pays the flip's prep.
      let crop = p.built[round];
      if (!crop) {
        crop = p.src.build(round);
        p.built[round] = crop;
      }
      // A blank/near-blank prepared crop (empty card, or a dense crop the sparse-ink gate
      // already blanked) can only OCR to nothing — skip the call, save the dispatch.
      if (cropHasOcrInk(crop)) {
        jobs.push({ p, crop });
      } else if (round === 0) {
        // No ink on the upright crop ⇒ the 180° flip is the SAME pixels rotated, so its ink
        // fraction is identical and it would be skipped too. Mark the box done so we never
        // build the flip's prep — same OCR set as before, minus the wasted work.
        p.done = true;
      }
    }
    if (jobs.length === 0) {
      // Nothing ink-bearing left to OCR this round; the next round only has flips of these
      // same boxes, so there's no more useful work — stop.
      break;
    }
    // Handle one OCR result: record the read, snap it to a checklist code (or not), and
    // mark the box done when it resolved OR read to nothing legible (so its flip is skipped).
    // Returns true when this crop resolved a code.
    const handle = (job: { p: Pending; crop: HTMLCanvasElement }, r: { text: string }): boolean => {
      const clean = r.text.replace(/\s+/g, ' ').trim();
      if (clean) reads.push(clean);
      const m = bestMatchFromText(r.text, checklist);
      if (m?.entry) {
        job.p.done = true; // this box resolved — its flip round is skipped
        if (!seen.has(m.entry.code)) {
          seen.add(m.entry.code);
          resolved.push(m);
        }
        return true;
      }
      if (round === 0 && !/[A-Z0-9]/i.test(clean)) {
        // The upright crop OCR'd to NOTHING legible (no letter or digit). The flip is the
        // SAME pixels rotated 180°, so a crop with no glyph either way carries no code — its
        // flip would only burn another OCR call to read nothing. Upside-down REAL text reads
        // as garbage characters upright (not empty), so it still has glyph chars here and
        // keeps its flip. This skips the wasted second call on the many video frames whose
        // box holds an unreadable smudge, without dropping any genuinely flipped code.
        job.p.done = true;
      }
      return false;
    };

    let resolvedThisRound = false;
    if (stopOnFirstCode && ocr.recognizeFast && ocr.recognizeSlow) {
      // TWO-PHASE live/latency path (hybrid engine). The expensive engine is tesseract (wasm),
      // and one tesseract call dwarfs detection on a phone — so the whole game is to NOT call
      // it when the cheap glyph matcher already read the code.
      //   Phase 1: glyph-read EVERY crop (microseconds each). A read at/above the confidence
      //   gate that snaps to a checklist code resolves the frame — with ZERO tesseract, even
      //   though spurious crops sit alongside the pill (this is what box[0]-first couldn't do
      //   when a spurious crop out-ranked the small pill).
      //   Phase 2: only if NOTHING resolved, pay tesseract on the unsure crops in score order,
      //   stopping at the first match — recovering the soft pills the glyph matcher can't read.
      const gate = ocr.fastConf ?? 0;
      const unsure: typeof jobs = [];
      // Phase 1: glyph-read crops in SCORE order, stopping the instant one resolves a code —
      // so a clean frame ends after the pill's glyph read, with no tesseract at all.
      for (const job of jobs) {
        crops += 1;
        const [r] = await ocr.recognizeFast([job.crop]);
        if (r.confidence >= gate) {
          // Confident glyph read: it either snaps to a code (resolve, done) or is a confident
          // NON-code (logo fragment) we trust enough to NOT re-check with tesseract.
          if (handle(job, r)) {
            resolvedThisRound = true;
            break;
          }
        } else {
          // Soft/rejected/blank: tesseract might still read it — defer to phase 2.
          unsure.push(job);
        }
      }
      // Phase 2: only if NOTHING resolved, pay tesseract on the unsure crops in score order.
      if (!resolvedThisRound) {
        for (const job of unsure) {
          crops += 1;
          const [r] = await ocr.recognizeSlow([job.crop]);
          if (handle(job, r)) {
            resolvedThisRound = true;
            break;
          }
        }
      }
    } else if (stopOnFirstCode) {
      // Single-engine live/latency: jobs are in SCORE order (the real pill is the top box).
      // OCR them one at a time and stop the instant one resolves.
      for (const job of jobs) {
        crops += 1;
        const [r] = await ocr.recognizeMany([job.crop]);
        if (handle(job, r)) {
          resolvedThisRound = true;
          break;
        }
      }
    } else {
      // Recall mode (multi-sticker static): we want EVERY distinct code, so OCR the whole
      // round in parallel across the worker pool and process all results.
      crops += jobs.length;
      const results = await ocr.recognizeMany(jobs.map((j) => j.crop));
      for (let i = 0; i < results.length; i++) {
        if (handle(jobs[i], results[i])) resolvedThisRound = true;
      }
    }
    if (resolvedThisRound && stopOnFirstCode) break; // frame resolved — done
  }

  return { resolved, reads, crops };
}
