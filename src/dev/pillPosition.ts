// DEV-ONLY one-shot probe: WHERE does the top-scoring code pill sit vertically inside
// the camera frame? Runs the real findCodeBoxes() over every static photo + every
// extracted video frame, and for the highest-scoring box records its vertical centroid,
// top edge and bottom edge as a fraction of frame HEIGHT (0=top, 1=bottom).
//
// Output: JSON → captures/pill-position.json (POSTed to /bench-log, which just writes
// the body verbatim — we reuse that sink). Served at /pill-position.html.
import { findCodeBoxes } from '../ocr/locate';

const root = document.getElementById('out')!;
const status = document.createElement('div');
root.replaceChildren(status);

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

interface Rec {
  name: string;
  kind: 'static' | 'frame';
  w: number;
  h: number;
  boxes: number;
  // top-scoring box geometry, as fraction of frame height
  centroidFrac: number | null;
  topFrac: number | null;
  bottomFrac: number | null;
  score: number | null;
}

function quantiles(xs: number[]) {
  if (!xs.length) return { min: NaN, median: NaN, max: NaN, p25: NaN, p75: NaN };
  const s = [...xs].sort((a, b) => a - b);
  const at = (p: number) => s[Math.min(s.length - 1, Math.round(p * (s.length - 1)))];
  return { min: s[0], p25: at(0.25), median: at(0.5), p75: at(0.75), max: s[s.length - 1] };
}

(async () => {
  status.textContent = 'loading dataset list…';
  const list = (await (await fetch('/dataset/list')).json()) as {
    images: string[];
    videos: string[];
    frames: string[];
  };

  const recs: Rec[] = [];

  const probe = async (name: string, url: string, kind: 'static' | 'frame') => {
    const frame = await loadImage(url);
    const boxes = findCodeBoxes(frame); // sorted score-desc; box[0] is the pill
    const top = boxes[0];
    recs.push({
      name,
      kind,
      w: frame.width,
      h: frame.height,
      boxes: boxes.length,
      centroidFrac: top ? (top.y + top.h / 2) / frame.height : null,
      topFrac: top ? top.y / frame.height : null,
      bottomFrac: top ? (top.y + top.h) / frame.height : null,
      score: top ? top.score : null,
    });
  };

  for (const name of list.images.sort()) {
    status.textContent = `static ${name}…`;
    await probe(name, `/dataset/${name}`, 'static');
  }
  for (const fname of list.frames) {
    status.textContent = `frame ${fname}…`;
    await probe(fname, `/dataset/frames/${fname}`, 'frame');
  }

  // ---- aggregate over the FRAMES (the video use-case the question is about) ----
  const framesWithBox = recs.filter((r) => r.kind === 'frame' && r.centroidFrac !== null);
  const cents = framesWithBox.map((r) => r.centroidFrac!) as number[];
  const tops = framesWithBox.map((r) => r.topFrac!) as number[];
  const bottoms = framesWithBox.map((r) => r.bottomFrac!) as number[];

  const cq = quantiles(cents);
  const fracTopBelow = (t: number) => tops.filter((y) => y >= t).length / (tops.length || 1);
  const fracCentBelow = (t: number) => cents.filter((y) => y >= t).length / (cents.length || 1);
  const fracBottomBelow = (t: number) => bottoms.filter((y) => y >= t).length / (bottoms.length || 1);

  // For a bottom BAND [roiTop..1.0] to keep the WHOLE pill, the pill's TOP edge must be
  // >= roiTop. So "fraction of frames fully inside band" == fraction whose topFrac >= roiTop.
  const bandKeep = (roiTop: number) => tops.filter((y) => y >= roiTop).length / (tops.length || 1);

  const summary = {
    framesTotal: recs.filter((r) => r.kind === 'frame').length,
    framesWithBox: framesWithBox.length,
    frameDims: framesWithBox[0] ? `${framesWithBox[0].w}x${framesWithBox[0].h}` : 'n/a',
    centroid: cq,
    topEdge: quantiles(tops),
    bottomEdge: quantiles(bottoms),
    // "whole pill below y=T" == top edge >= T
    fracWholePillBelow: { '0.5': fracTopBelow(0.5), '0.67': fracTopBelow(0.67), '0.75': fracTopBelow(0.75) },
    fracCentroidBelow: { '0.5': fracCentBelow(0.5), '0.67': fracCentBelow(0.67), '0.75': fracCentBelow(0.75) },
    fracBottomEdgeBelow: { '0.5': fracBottomBelow(0.5), '0.67': fracBottomBelow(0.67), '0.75': fracBottomBelow(0.75) },
    bandKeepFraction: {
      'roiTop=0.0': bandKeep(0.0),
      'roiTop=0.25': bandKeep(0.25),
      'roiTop=0.33': bandKeep(0.33),
      'roiTop=0.5': bandKeep(0.5),
      'roiTop=0.6': bandKeep(0.6),
      'roiTop=0.67': bandKeep(0.67),
      'roiTop=0.75': bandKeep(0.75),
    },
  };

  // static photos too, for completeness
  const statics = recs.filter((r) => r.kind === 'static');

  const out = { summary, statics, frames: framesWithBox, allRecs: recs };
  await fetch('/bench-log', { method: 'POST', body: JSON.stringify(out, null, 2) }).catch(() => {});
  status.textContent = 'done — see captures/bench-results.md';
  document.title = 'bench done';
})();
