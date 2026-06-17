// Lista lacunas de cobertura manual para códigos difíceis no dataset Pixel.
// Uso:
//   node scripts/pixel-capture-gaps.mjs [dataset] [--codes=MEX15,IRQ20,TUN10] [--min=3]

import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const args = process.argv.slice(2);
const datasetRoot = resolve(process.cwd(), args.find((arg) => !arg.startsWith('--')) || 'captures/datasets/swe8-live-20260616-v1');
const codesArg = args.find((arg) => arg.startsWith('--codes='));
const minArg = args.find((arg) => arg.startsWith('--min='));
const watchedCodes = (codesArg?.slice('--codes='.length) || 'MEX15,IRQ20,TUN10')
  .split(',')
  .map((code) => code.trim().toUpperCase())
  .filter(Boolean);
const minUsefulFrames = Number(minArg?.slice('--min='.length) || 3);

const manifestPath = join(datasetRoot, 'dataset_manifest.csv');
const verifyPath = join(datasetRoot, 'ground_truth_verification.csv');

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
  if (lines.length === 0) throw new Error(`Arquivo vazio: ${filePath}`);
  const header = parseCsvLine(lines[0]);
  return lines.slice(1).map((line) => {
    const cols = parseCsvLine(line);
    const row = {};
    for (let i = 0; i < header.length; i += 1) row[header[i]] = cols[i] ?? '';
    return row;
  });
}

if (!existsSync(manifestPath)) throw new Error(`Manifesto não encontrado: ${manifestPath}`);
if (!existsSync(verifyPath)) throw new Error(`CSV manual não encontrado: ${verifyPath}`);
if (!Number.isFinite(minUsefulFrames) || minUsefulFrames < 1) throw new Error('--min precisa ser um número positivo');

const manifestRows = parseCsv(manifestPath);
const verificationRows = parseCsv(verifyPath);
const manifestByFrame = new Map(manifestRows.map((row) => [row.frame_id, row]));
const confirmedByCode = new Map();

for (const row of verificationRows) {
  const status = (row.status || '').trim();
  const code = (row.verified_code || '').trim().toUpperCase();
  if (status !== 'confirmed' || !code) continue;
  const manifest = manifestByFrame.get(row.frame_id);
  if (!manifest) continue;
  if (!confirmedByCode.has(code)) confirmedByCode.set(code, []);
  confirmedByCode.get(code).push({
    frameId: row.frame_id,
    split: manifest.split || 'unknown',
    sourceDir: manifest.source_dir || '',
    frameNumber: manifest.frame_number || '',
  });
}

console.log(`Dataset: ${datasetRoot}`);
console.log(`CSV manual: ${verifyPath}`);
console.log(`Meta por código difícil: ${minUsefulFrames} frames revisados\n`);

const suggestions = [];
for (const code of watchedCodes) {
  const rows = confirmedByCode.get(code) || [];
  const splitCounts = rows.reduce((acc, row) => {
    acc[row.split] = (acc[row.split] || 0) + 1;
    return acc;
  }, {});
  const splitText = Object.keys(splitCounts).sort().map((split) => `${split}:${splitCounts[split]}`).join(', ') || '-';
  console.log(`${code}: ${rows.length} frame(s), splits ${splitText}`);
  if (rows.length === 0) {
    suggestions.push(`- ${code}: capturar uma segurada curta com pelo menos ${minUsefulFrames} frames revisados manualmente.`);
  } else if (rows.length < minUsefulFrames) {
    suggestions.push(`- ${code}: capturar mais ${minUsefulFrames - rows.length} frame(s) revisado(s).`);
  } else if (Object.keys(splitCounts).length < 2) {
    suggestions.push(`- ${code}: capturar variação para sair de um único split (${splitText}).`);
  }
}

console.log('\nPróximas capturas úteis:');
if (suggestions.length === 0) {
  console.log('- Nenhuma lacuna nos códigos monitorados.');
} else {
  console.log('- Prioridade: debug ligado, figurinha horizontal, segurada curta, validação manual depois.');
  for (const suggestion of suggestions) console.log(suggestion);
}
