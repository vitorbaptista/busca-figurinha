import { existsSync, readFileSync, rmSync, mkdirSync, writeFileSync, symlinkSync } from 'node:fs';
import { join, resolve } from 'node:path';

const datasetRoot = resolve(process.cwd(), process.argv[2] || 'captures/datasets/swe8-live-20260616-v1');
const manifestPath = join(datasetRoot, 'dataset_manifest.csv');
const verifyPath = join(datasetRoot, 'ground_truth_verification.csv');
const preferredVerifyPath = join(process.cwd(), 'ground_truth_verification(2).csv');

function parseCsvLine(line) {
  const out = [];
  let cell = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cell += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === ',' && !inQuotes) {
      out.push(cell);
      cell = '';
      continue;
    }
    cell += ch;
  }
  out.push(cell);
  return out.map((value) => value.trim().replace(/^"|"$/g, ''));
}

function parseCsv(filePath) {
  const text = readFileSync(filePath, 'utf8').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = text.split('\n').filter((line) => line.trim().length > 0);
  if (lines.length === 0) {
    throw new Error(`Arquivo vazio: ${filePath}`);
  }
  const header = parseCsvLine(lines[0]);
  const rows = lines.slice(1).map((line) => {
    const cols = parseCsvLine(line);
    const row = {};
    for (let i = 0; i < header.length; i += 1) {
      row[header[i]] = cols[i] ?? '';
    }
    return row;
  });
  return { header, rows };
}

function csvValue(value) {
  const safe = String(value ?? '');
  if (/[",\n]/.test(safe)) {
    return `"${safe.replace(/"/g, '""')}"`;
  }
  return safe;
}

function writeCsv(filePath, header, rows) {
  const lines = [header.map(csvValue).join(',')];
  for (const row of rows) {
    lines.push(header.map((name) => csvValue(row[name] ?? '')).join(','));
  }
  writeFileSync(filePath, `${lines.join('\n')}\n`, 'utf8');
}

function buildClassLabel(verification, manifestExpected) {
  if (!verification) {
    return manifestExpected ? manifestExpected.trim() : 'unknown';
  }
  const status = (verification.status || '').trim();
  const verifiedCode = (verification.verified_code || '').trim();
  if (status === 'confirmed' && verifiedCode) {
    return verifiedCode;
  }
  if (status === 'not_sticker') {
    return 'not_sticker';
  }
  return 'unknown';
}

function keyForClass(className) {
  return className || 'unknown';
}

function stableShuffle(items, seed) {
  const shuffled = [...items];
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    hash ^= hash << 13;
    hash ^= hash >>> 17;
    hash ^= hash << 5;
    hash >>>= 0;
    const j = hash % (i + 1);
    const temp = shuffled[i];
    shuffled[i] = shuffled[j];
    shuffled[j] = temp;
  }
  return shuffled;
}

if (!existsSync(manifestPath)) {
  throw new Error(`Manifesto não encontrado: ${manifestPath}`);
}
if (existsSync(preferredVerifyPath)) {
  const preferredCopied = readFileSync(preferredVerifyPath, 'utf8');
  writeFileSync(verifyPath, preferredCopied);
  console.log(`Usando arquivo de validação: ${preferredVerifyPath}`);
} else if (!existsSync(verifyPath)) {
  throw new Error(`Arquivo de verificação não encontrado: ${verifyPath}`);
}

const manifest = parseCsv(manifestPath);
const verify = parseCsv(verifyPath);

const manifestHeader = manifest.header;
const frameIdIdx = manifestHeader.indexOf('frame_id');
const rawPathIdx = manifestHeader.indexOf('raw_frame_path');
const splitIdx = manifestHeader.indexOf('split');
const gtIdx = manifestHeader.indexOf('ground_truth_code');
if (frameIdIdx < 0 || rawPathIdx < 0 || splitIdx < 0 || gtIdx < 0) {
  throw new Error('Manifesto inválido: cabeçalho sem frame_id, raw_frame_path, split ou ground_truth_code');
}

const verifyIndex = new Map();
for (const row of verify.rows) {
  if (row.frame_id) verifyIndex.set(row.frame_id, row);
}

const rows = manifest.rows;
if (rows.length === 0) {
  throw new Error('Manifesto vazio.');
}

const groups = new Map();
for (const row of rows) {
  const frameId = row.frame_id;
  const groundTruth = row.ground_truth_code || '';
  const label = keyForClass(buildClassLabel(verifyIndex.get(frameId), groundTruth));
  if (!groups.has(label)) groups.set(label, []);
  groups.set(label, groups.get(label).concat(row));
}

const classOrder = [...groups.keys()].sort((a, b) => groups.get(b).length - groups.get(a).length);
const total = rows.length;

const currentSplitCounts = { train: 0, val: 0, test: 0 };
for (const row of rows) {
  const split = row.split || 'unknown';
  if (split in currentSplitCounts) currentSplitCounts[split] += 1;
}
const targetSplit = {
  train: currentSplitCounts.train || Math.round(total * 0.7),
  val: currentSplitCounts.val || Math.round(total * 0.1),
  test:
    currentSplitCounts.test || Math.max(0, total - (currentSplitCounts.train || Math.round(total * 0.7)) - (currentSplitCounts.val || Math.round(total * 0.1))),
};
if (targetSplit.train + targetSplit.val + targetSplit.test !== total) {
  targetSplit.test = total - targetSplit.train - targetSplit.val;
}

const targetTrain = targetSplit.train;
const targetVal = targetSplit.val;
const targetTest = targetSplit.test;

let states = new Map();
states.set('0,0', { score: 0, prev: null, pick: null });
const statesByStep = [];
let processed = 0;

for (const className of classOrder) {
  const classRows = groups.get(className);
  const n = classRows.length;
  const expectTrain = (n * targetTrain) / total;
  const expectVal = (n * targetVal) / total;
  const expectTest = (n * targetTest) / total;
  const next = new Map();

  for (const [key, state] of states.entries()) {
    const [usedTrain, usedVal] = key.split(',').map(Number);
    const usedTest = processed - usedTrain - usedVal;
    const remTrain = targetTrain - usedTrain;
    const remVal = targetVal - usedVal;
    const remTest = targetTest - usedTest;
    if (remTrain < 0 || remVal < 0 || remTest < 0) continue;

    for (let t = 0; t <= n; t += 1) {
      if (t > remTrain) break;
      for (let v = 0; v <= n - t; v += 1) {
        const te = n - t - v;
        if (v > remVal || te > remTest) continue;
        const nextTrain = usedTrain + t;
        const nextVal = usedVal + v;
        const candidateKey = `${nextTrain},${nextVal}`;
        const baseScore = state.score;
        const penalty =
          Math.pow(t - expectTrain, 2) +
          Math.pow(v - expectVal, 2) +
          Math.pow(te - expectTest, 2);
        const score = baseScore + penalty;
        const previous = next.get(candidateKey);
        if (!previous || score < previous.score) {
          next.set(candidateKey, {
            score,
            prev: key,
            pick: { className, train: t, val: v, test: te },
          });
        }
      }
    }
  }

  states = next;
  statesByStep.push(states);
  if (states.size === 0) {
    throw new Error(`Não foi possível distribuir a classe ${className} sem quebrar as cotas.`);
  }
  processed += n;
}

const finalKey = `${targetTrain},${targetVal}`;
const finalState = states.get(finalKey);
if (!finalState) {
  throw new Error('Não foi possível atingir a distribuição solicitada com as classes atuais.');
}

const allocations = new Map();
let cursor = finalKey;
for (let i = classOrder.length - 1; i >= 0; i -= 1) {
  const layer = statesByStep[i];
  const node = layer.get(cursor);
  if (!node || !node.pick) {
    throw new Error(`Falha ao reconstruir split na classe ${classOrder[i]} (${cursor}).`);
  }
  allocations.set(node.pick.className, {
    train: node.pick.train,
    val: node.pick.val,
    test: node.pick.test,
  });
  cursor = node.prev;
}

for (const [className, rowsOfClass] of groups.entries()) {
  const alloc = allocations.get(className);
  if (!alloc) {
    throw new Error(`Classe sem alocação: ${className}`);
  }
  const ordered = stableShuffle(rowsOfClass, className).map((r) => ({ ...r }));
  let trainCount = 0;
  let valCount = 0;
  let testCount = 0;

  for (const row of ordered) {
    if (trainCount < alloc.train) {
      row.split = 'train';
      trainCount += 1;
    } else if (valCount < alloc.val) {
      row.split = 'val';
      valCount += 1;
    } else {
      row.split = 'test';
      testCount += 1;
    }
  }
  if (trainCount !== alloc.train || valCount !== alloc.val || testCount !== alloc.test) {
    throw new Error(`Atribuição inconsistente na classe ${className}`);
  }
}

for (let idx = 0; idx < manifest.rows.length; idx += 1) {
  const current = manifest.rows[idx];
  const classRow = rows.find((r) => r.frame_id === current.frame_id);
  if (classRow) current.split = classRow.split;
}

writeCsv(manifestPath, manifestHeader, rows);

const splitDir = join(datasetRoot, 'splits');
for (const splitName of ['train', 'val', 'test']) {
  const targetDir = join(splitDir, splitName);
  rmSync(targetDir, { recursive: true, force: true });
  mkdirSync(targetDir, { recursive: true });
}

for (const row of rows) {
  const linkPath = join(splitDir, row.split, row.frame_id);
  const target = join('..', '..', row.raw_frame_path);
  symlinkSync(target, linkPath);
}

const finalCounts = { train: 0, val: 0, test: 0 };
for (const row of rows) {
  if (row.split === 'train') finalCounts.train += 1;
  else if (row.split === 'val') finalCounts.val += 1;
  else if (row.split === 'test') finalCounts.test += 1;
}

const datasetInfoPath = join(datasetRoot, 'dataset_info.txt');
const cwd = process.cwd();
const createdPath = datasetRoot.startsWith(`${cwd}/`)
  ? `created=${datasetRoot.slice(cwd.length + 1)}`
  : `created=${datasetRoot}`;
const info = [
  createdPath,
  `total_frames=${total}`,
  `train=${finalCounts.train}`,
  `val=${finalCounts.val}`,
  `test=${finalCounts.test}`,
  'dataset_ready=true',
].join('\n') + '\n';
writeFileSync(datasetInfoPath, info, 'utf8');

const classSummary = [...groups.keys()].sort().map((name) => `${name}=${groups.get(name).length}`).join(', ');
console.log(`Split refeito com estratificação por classe.`);
console.log(`Total: ${total} | train=${finalCounts.train} val=${finalCounts.val} test=${finalCounts.test}`);
console.log(`Classes: ${classSummary}`);
