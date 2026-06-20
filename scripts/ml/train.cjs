// Train codeNet: a fixed-position multi-head CNN that reads a sticker code from a letterboxed
// 48x192 grayscale crop. Each of MAXLEN slots is a 37-way softmax (A-Z 0-9 + blank/pad);
// decode = argmax per slot, drop blanks. No CTC, no alignment — plain cross-entropy, which is
// all tfjs-node reliably supports. Trains on synthetic (syn) + real_train, validates on real_val.
//   node scripts/ml/train.cjs [--epochs=40] [--batch=64] [--dense=256] [--lr=0.001]
require('./node-polyfill.cjs');
const tf = require('@tensorflow/tfjs-node');
const fs = require('node:fs');
const path = require('node:path');

const DATA = path.resolve('captures/train-data');
const OUT = path.resolve('public/models/codenet');
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const BLANK = ALPHABET.length; // 36
const NUM_CLASSES = ALPHABET.length + 1; // 37
const W = 128, H = 32; // MUST match src/ocr/codeImage.ts INPUT_W/INPUT_H
const REC = W * H;
const charIdx = (c) => ALPHABET.indexOf(c);

const arg = (k, d) => {
  const m = process.argv.find((a) => a.startsWith(`--${k}=`));
  return m ? Number(m.split('=')[1]) : d;
};
const EPOCHS = arg('epochs', 40);
const BATCH = arg('batch', 64);
const DENSE = arg('dense', 256);
const LR = arg('lr', 0.001);
const POS_REPEAT = arg('posRepeat', 12); // upweight scarce real PILL crops vs synthetic
const NEG_REPEAT = arg('negRepeat', 3); // real non-pill crops (logo/header)
const AUGMENT = arg('augment', 0); // 1 = per-batch photometric aug (mild generalization; needs more epochs)
const SYNTH_VAL = arg('synthVal', 600); // hold out this many synth records to track synth fit
const MAX_STEPS = arg('maxSteps', 150); // cap batches/epoch (pool is shuffled, so this samples)

function loadSplit(file) {
  const binPath = path.join(DATA, `${file}.bin`);
  const lblPath = path.join(DATA, `${file}.labels.txt`);
  if (!fs.existsSync(binPath)) return { buf: Buffer.alloc(0), labels: [], n: 0 };
  const buf = fs.readFileSync(binPath);
  const labels = fs.readFileSync(lblPath, 'utf8').split('\n').filter((l) => l.length > 0);
  const n = Math.floor(buf.length / REC);
  if (n !== labels.length) console.warn(`WARN ${file}: ${n} recs vs ${labels.length} labels`);
  return { buf, labels: labels.slice(0, n), n };
}

const syn = loadSplit('syn');
const realTrain = loadSplit('real_train');
const realVal = loadSplit('real_val');
console.log(`data: syn=${syn.n} real_train=${realTrain.n} real_val=${realVal.n}`);

// Combined training pool (indices into [syn, real_train]). Hold out the first SYNTH_VAL synth
// records as a synth-val set (to separate "not learning" from "domain gap"), and UPWEIGHT the
// scarce real crops REAL_REPEAT× so the model actually adapts to the real camera domain.
const pools = [syn, realTrain];
const synValN = Math.min(SYNTH_VAL, syn.n);
const train = [];
for (let i = synValN; i < syn.n; i++) train.push([0, i]);
for (let i = 0; i < realTrain.n; i++) {
  const reps = realTrain.labels[i] === '__neg__' ? NEG_REPEAT : POS_REPEAT;
  for (let r = 0; r < reps; r++) train.push([1, i]);
}
const synVal = { buf: syn.buf, labels: syn.labels, idxs: Array.from({ length: synValN }, (_, i) => i) };
const allLabels = [...syn.labels, ...realTrain.labels, ...realVal.labels].filter((l) => l !== '__neg__');
const MAXLEN = Math.max(...allLabels.map((l) => l.length));
const realPills = realTrain.labels.filter((l) => l !== '__neg__').length;
console.log(`MAXLEN=${MAXLEN} train_pool=${train.length} (real pills=${realPills}×${POS_REPEAT}, neg×${NEG_REPEAT}) synVal=${synValN}`);

/** label string → Int32 array of length MAXLEN (class idx per slot, blank-padded). __neg__ → all blank. */
function encodeLabel(label) {
  const out = new Array(MAXLEN).fill(BLANK);
  if (label !== '__neg__') for (let i = 0; i < label.length && i < MAXLEN; i++) out[i] = charIdx(label[i]);
  return out;
}

/** Build an [B,H,W,1] float tensor + [B,MAXLEN,NUM_CLASSES] one-hot from a list of [poolIdx,recIdx]. */
function batchTensors(items) {
  const B = items.length;
  const x = new Float32Array(B * REC);
  const y = new Float32Array(B * MAXLEN * NUM_CLASSES);
  for (let b = 0; b < B; b++) {
    const [pi, ri] = items[b];
    const p = pools[pi];
    const off = ri * REC;
    for (let k = 0; k < REC; k++) x[b * REC + k] = p.buf[off + k] / 255;
    const enc = encodeLabel(p.labels[ri]);
    for (let s = 0; s < MAXLEN; s++) y[(b * MAXLEN + s) * NUM_CLASSES + enc[s]] = 1;
  }
  return {
    xs: tf.tensor(x, [B, H, W, 1]),
    ys: tf.tensor(y, [B, MAXLEN, NUM_CLASSES]),
  };
}

/** Random photometric augmentation per batch (brightness/contrast/noise) so the heavily-repeated
 *  real crops look different every epoch — the key to generalizing across frames of the same
 *  sticker instead of MEMORIZING the few train crops. Applied to training batches only. */
function augment(xs) {
  return tf.tidy(() => {
    const B = xs.shape[0];
    const bright = tf.randomUniform([B, 1, 1, 1], -0.12, 0.12);
    const contrast = tf.randomUniform([B, 1, 1, 1], 0.8, 1.25);
    const mean = xs.mean([1, 2, 3], true);
    return xs.sub(mean).mul(contrast).add(mean).add(bright).add(tf.randomNormal(xs.shape, 0, 0.05)).clipByValue(0, 1);
  });
}

function buildModel() {
  const inp = tf.input({ shape: [H, W, 1] });
  let x = inp;
  const conv = (f) => tf.layers.conv2d({ filters: f, kernelSize: 3, padding: 'same', activation: 'relu' });
  const pool = () => tf.layers.maxPooling2d({ poolSize: [2, 2] });
  x = pool().apply(conv(16).apply(x));   // 16x64
  x = pool().apply(conv(32).apply(x));   // 8x32
  x = pool().apply(conv(64).apply(x));   // 4x16
  x = pool().apply(conv(64).apply(x));   // 2x8
  x = tf.layers.flatten().apply(x);
  x = tf.layers.dropout({ rate: 0.3 }).apply(x);
  x = tf.layers.dense({ units: DENSE, activation: 'relu' }).apply(x);
  x = tf.layers.dropout({ rate: 0.3 }).apply(x);
  x = tf.layers.dense({ units: MAXLEN * NUM_CLASSES }).apply(x);
  x = tf.layers.reshape({ targetShape: [MAXLEN, NUM_CLASSES] }).apply(x);
  const out = tf.layers.softmax({ axis: -1 }).apply(x);
  const model = tf.model({ inputs: inp, outputs: out });
  model.compile({ optimizer: tf.train.adam(LR), loss: 'categoricalCrossentropy' });
  return model;
}

function decodePred(arr) {
  // arr: Float32Array length MAXLEN*NUM_CLASSES → string (argmax per slot, drop blanks).
  let s = '';
  for (let t = 0; t < MAXLEN; t++) {
    let best = 0, bi = 0;
    for (let c = 0; c < NUM_CLASSES; c++) { const v = arr[t * NUM_CLASSES + c]; if (v > best) { best = v; bi = c; } }
    if (bi !== BLANK) s += ALPHABET[bi];
  }
  return s;
}

/** Evaluate exact-decode accuracy over `idxs` records of (buf,labels). Skips __neg__ for the
 *  recall number but counts a code emitted on a negative as a false positive. */
async function evalIdx(model, buf, labels, idxs) {
  let correct = 0, total = 0, fp = 0, neg = 0;
  for (let i = 0; i < idxs.length; i += 256) {
    const chunk = idxs.slice(i, i + 256);
    const B = chunk.length;
    const x = new Float32Array(B * REC);
    for (let b = 0; b < B; b++) { const off = chunk[b] * REC; for (let k = 0; k < REC; k++) x[b * REC + k] = buf[off + k] / 255; }
    const xs = tf.tensor(x, [B, H, W, 1]);
    const pred = model.predict(xs);
    const data = await pred.data();
    xs.dispose(); pred.dispose();
    for (let b = 0; b < B; b++) {
      const lab = labels[chunk[b]];
      const got = decodePred(data.subarray(b * MAXLEN * NUM_CLASSES, (b + 1) * MAXLEN * NUM_CLASSES));
      if (lab === '__neg__') { neg++; if (got) fp++; continue; }
      total++;
      if (got === lab) correct++;
    }
  }
  return { exact: total ? correct / total : 0, n: total, fp, neg };
}
const evalSplit = (model, split) =>
  evalIdx(model, split.buf, split.labels, Array.from({ length: split.n }, (_, i) => i));

(async () => {
  const model = buildModel();
  model.summary();
  const stepsPerEpoch = Math.min(Math.ceil(train.length / BATCH), MAX_STEPS);
  let best = 0;
  for (let epoch = 0; epoch < EPOCHS; epoch++) {
    // shuffle
    for (let i = train.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [train[i], train[j]] = [train[j], train[i]]; }
    let lossSum = 0;
    for (let s = 0; s < stepsPerEpoch; s++) {
      const items = train.slice(s * BATCH, (s + 1) * BATCH);
      const { xs, ys } = batchTensors(items);
      const xa = AUGMENT ? augment(xs) : xs;
      const h = await model.trainOnBatch(xa, ys);
      lossSum += Array.isArray(h) ? h[0] : h;
      xs.dispose(); if (xa !== xs) xa.dispose(); ys.dispose();
    }
    const sv = await evalIdx(model, synVal.buf, synVal.labels, synVal.idxs);
    const v = await evalSplit(model, realVal);
    console.log(
      `epoch ${epoch + 1}/${EPOCHS} loss=${(lossSum / stepsPerEpoch).toFixed(4)} ` +
        `synth_val=${(sv.exact * 100).toFixed(1)}% real_val=${(v.exact * 100).toFixed(1)}% (n=${v.n}) realFP=${v.fp}/${v.neg}`,
    );
    if (v.exact > best && v.exact > 0) {
      best = v.exact;
      fs.mkdirSync(OUT, { recursive: true });
      await model.save(`file://${OUT}`);
      fs.writeFileSync(path.join(OUT, 'meta.json'), JSON.stringify({ alphabet: ALPHABET, blank: BLANK, maxlen: MAXLEN, w: W, h: H, valExact: v.exact }, null, 2));
    }
  }
  const t = await evalSplit(model, realTrain);
  console.log(`\nDONE. best val_exact=${(best * 100).toFixed(1)}%  real_train_exact=${(t.exact * 100).toFixed(1)}%  → ${OUT}`);
})();
