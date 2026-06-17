// Generate a local HTML page for manual frame-by-frame verification of dataset labels.
// Usage:
//   node scripts/verify-pixel-dataset.mjs [path-to-dataset]
// Example:
//   node scripts/verify-pixel-dataset.mjs captures/datasets/swe8-live-20260616-v1

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';

const datasetPath = resolve(process.cwd(), process.argv[2] || 'captures/datasets/swe8-live-20260616-v1');
const manifestPath = join(datasetPath, 'dataset_manifest.csv');

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
  return out.map((c) => c.trim().replace(/^"|"$/g, ''));
}

function parseManifest(csvText) {
  const lines = csvText.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter((l) => l.trim().length);
  const header = parseCsvLine(lines[0]);
  const idx = (name) => header.indexOf(name);
  return lines
    .slice(1)
    .map((line) => parseCsvLine(line))
    .filter((cols) => cols.length >= 8)
        .map((cols) => ({
      frameId: cols[idx('frame_id')] || '',
      frameDir: cols[idx('raw_frame_path')] || '',
      split: cols[idx('split')] || '',
      expected: cols[idx('ground_truth_code')] || '',
      cropCount: cols[idx('crop_count')] || '0',
      frameNumber: cols[idx('frame_number')] || '',
      sourceDir: cols[idx('source_dir')] || '',
      notes: cols[idx('notes')] || '',
      sessionObservations: cols[idx('session_observations')] || '',
    }))
    .filter((row) => row.frameId && row.frameDir);
}

const rawManifest = readFileSync(manifestPath, 'utf8');
const frames = parseManifest(rawManifest);
if (frames.length === 0) {
  throw new Error(`Manifesto vazio ou inválido: ${manifestPath}`);
}

const pagePath = join(datasetPath, 'manual_verify.html');
const data = JSON.stringify(frames);

const html = `<!doctype html>
<html lang=\"pt-BR\">
<head>
  <meta charset=\"UTF-8\">
  <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">
  <title>Verificação manual de dataset</title>
  <style>
    :root { font-family: Arial, sans-serif; }
    body { margin: 0; padding: 24px; background: #0f172a; color: #e2e8f0; }
    h1 { margin: 0 0 12px; font-size: 22px; }
    .layout { display: grid; grid-template-columns: 1fr 380px; gap: 20px; align-items: start; }
    .preview img { width: min(100%, 900px); border-radius: 8px; background: #020617; display: block; }
    .card { background: #1e293b; border: 1px solid #334155; border-radius: 10px; padding: 14px; }
    .controls { display: grid; gap: 12px; }
    label { font-size: 12px; color: #cbd5e1; margin-bottom: 4px; display: block; }
    input, textarea, select, button {
      width: 100%;
      font: inherit;
      border: 1px solid #334155;
      background: #020617;
      color: #e2e8f0;
      padding: 8px;
      border-radius: 6px;
    }
    textarea { min-height: 120px; resize: vertical; }
    .row { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
    .actions { display: grid; gap: 8px; }
    button { cursor: pointer; background: #0ea5e9; border-color: #0284c7; }
    button.secondary { background: #334155; border-color: #64748b; }
    .headerInfo { margin-bottom: 12px; color: #94a3b8; }
    .meta { font-size: 12px; color: #94a3b8; margin-bottom: 8px; }
    .pill { display: inline-block; padding: 2px 8px; border-radius: 999px; background: #334155; color: #f8fafc; margin-right: 6px; }
    .ok { color: #22c55e; }
    .warn { color: #f59e0b; }
  </style>
</head>
<body>
  <h1>Verificação manual do dataset Pixel</h1>
  <div class=\"headerInfo\">
    Dataset: <strong>${datasetPath}</strong>
  </div>
  <div class=\"meta\" id=\"status\"></div>
  <div class=\"layout\">
    <div class=\"card preview\">
      <div class=\"meta\">
        <span class=\"pill\" id=\"framePos\"></span>
        <span class=\"pill\" id=\"frameId\"></span>
      </div>
      <img id=\"frameImage\" alt=\"frame\" />
      <div class=\"meta\" id=\"frameDetails\"></div>
    </div>
    <div class=\"card controls\">
      <div>
        <label for=\"verifiedCode\">Código do sticker nesta imagem</label>
        <input id=\"verifiedCode\" autocomplete=\"off\" placeholder=\"ex.: SWE8\" />
      </div>
      <div>
        <label for=\"statusSelect\">Validação</label>
        <select id=\"statusSelect\">
          <option value=\"confirmed\">confirmado (exato)</option>
          <option value=\"uncertain\">incerto</option>
          <option value=\"not_sticker\">sem sticker visível</option>
          <option value=\"skip\">pular</option>
        </select>
      </div>
      <div>
        <label for=\"expectedCode\">Rótulo antigo do manifesto (referência)</label>
        <input id=\"expectedCode\" disabled />
      </div>
      <div class=\"row\">
        <div>
          <label for=\"reviewer\">Revisor</label>
          <input id=\"reviewer\" placeholder=\"seu nome\" />
        </div>
        <div>
          <label for=\"split\">Split</label>
          <input id=\"split\" disabled />
        </div>
      </div>
      <div>
        <label for=\"notes\">Observações</label>
        <textarea id=\"notes\" placeholder=\"Ex.: leitura parcial, foto borrada...\"></textarea>
      </div>
      <div class=\"actions\">
        <button id=\"saveBtn\">Salvar rótulo atual</button>
        <div class=\"row\">
          <button class=\"secondary\" id=\"prevBtn\">Anterior</button>
          <button class=\"secondary\" id=\"nextBtn\">Próximo</button>
        </div>
        <button class=\"secondary\" id=\"noStickerBtn\" type=\"button\">Sem sticker visível</button>
        <button id=\"jumpBtn\">Pular para próximo não revisado</button>
        <button id=\"exportBtn\">Exportar CSV</button>
      </div>
    </div>
  </div>
  <div class=\"meta\" id=\"help\" style=\"margin-top: 12px\">
    Dica rápida: revise frame por frame, salve, depois vá para o próximo. Ao terminar, clique em <strong>Exportar CSV</strong>.
  </div>
  <script>
    const frames = ${data};
    const STORAGE_KEY = 'pixel-dataset-manual-verify-v1';
    const storage = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    let index = 0;

    const frameImage = document.getElementById('frameImage');
    const framePos = document.getElementById('framePos');
    const frameId = document.getElementById('frameId');
    const frameDetails = document.getElementById('frameDetails');
    const expectedCode = document.getElementById('expectedCode');
    const verifiedCode = document.getElementById('verifiedCode');
    const statusSelect = document.getElementById('statusSelect');
    const reviewer = document.getElementById('reviewer');
    const split = document.getElementById('split');
    const notes = document.getElementById('notes');
    const status = document.getElementById('status');

    const btnPrev = document.getElementById('prevBtn');
    const btnNext = document.getElementById('nextBtn');
    const btnNoSticker = document.getElementById('noStickerBtn');
    const btnSave = document.getElementById('saveBtn');
    const btnJump = document.getElementById('jumpBtn');
    const btnExport = document.getElementById('exportBtn');

    function updateStatusBar() {
      const reviewed = frames.filter((f) => !!storage[f.frameId]?.savedAt).length;
      status.textContent =
        'Revisados: ' + reviewed + '/' + frames.length + ' · Pendente: ' + (frames.length - reviewed);
      status.classList.toggle('warn', reviewed < frames.length);
      status.classList.toggle('ok', reviewed >= frames.length);
    }

    function loadCurrent() {
      const f = frames[index];
      framePos.textContent = (index + 1) + ' de ' + frames.length;
      frameId.textContent = f.frameId;
      expectedCode.value = f.expected;
      split.value = f.split || '-';
      frameImage.src = f.frameDir + '/frame.png';
      frameImage.alt = f.frameId;
      const rawCropCount = parseInt(f.cropCount, 10);
      const cropHint = Number.isFinite(rawCropCount) ? 'crops: ' + rawCropCount : 'crops: -';
      frameDetails.textContent =
        'source: ' + f.sourceDir + ' • frame ' + f.frameNumber + ' • ' + cropHint + (f.notes ? ' • ' + f.notes : '');
      const saved = storage[f.frameId];
      if (saved) {
        if (saved.status === 'not_sticker') {
          verifiedCode.value = '';
        } else {
          verifiedCode.value = saved.verifiedCode || '';
        }
        statusSelect.value = saved.status || 'uncertain';
        reviewer.value = saved.reviewer || '';
        notes.value = saved.notes || '';
      } else {
        verifiedCode.value = '';
        statusSelect.value = 'uncertain';
        reviewer.value = '';
        notes.value = '';
      }
    }

    function saveCurrent() {
      const f = frames[index];
      storage[f.frameId] = {
        frameId: f.frameId,
        expectedCode: f.expected,
        verifiedCode: verifiedCode.value.trim(),
        status: statusSelect.value,
        reviewer: reviewer.value.trim(),
        notes: notes.value.trim(),
        split: f.split,
        sourceDir: f.sourceDir,
        frameNumber: f.frameNumber,
        savedAt: new Date().toISOString(),
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(storage));
      updateStatusBar();
    }

    function markNoSticker() {
      verifiedCode.value = '';
      statusSelect.value = 'not_sticker';
      saveCurrent();
      next();
    }

    function next() {
      saveCurrent();
      index = (index + 1) % frames.length;
      loadCurrent();
    }

    function prev() {
      saveCurrent();
      index = (index - 1 + frames.length) % frames.length;
      loadCurrent();
    }

    function nextUnreviewed() {
      for (let i = 1; i <= frames.length; i += 1) {
        const candidate = (index + i) % frames.length;
        if (!storage[frames[candidate].frameId]?.savedAt) {
          index = candidate;
          loadCurrent();
          return;
        }
      }
      index = 0;
      loadCurrent();
    }

    function csvEscape(v) {
      const s = (v ?? '').toString().replace(/\"/g, '\"\"');
      return '"' + s + '"';
    }

    function exportCsv() {
      saveCurrent();
      const rows = [
        [
          'frame_id',
          'ground_truth_code',
          'verified_code',
          'crop_count',
          'status',
          'reviewer',
          'split',
          'source_dir',
          'frame_number',
          'notes',
          'verified_at',
        ].join(','),
      ];
      for (const f of frames) {
        const s = storage[f.frameId] || {};
        rows.push([
          f.frameId,
          f.expected,
          s.verifiedCode || '',
          f.cropCount || '0',
          s.status || 'skip',
          s.reviewer || '',
          f.split || '',
          f.sourceDir || '',
          f.frameNumber || '',
          s.notes || '',
          s.savedAt || '',
        ].map(csvEscape).join(','));
      }
      const blob = new Blob([rows.join('\\n')], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'ground_truth_verification.csv';
      a.click();
      URL.revokeObjectURL(url);
    }

    btnPrev.addEventListener('click', prev);
    btnNext.addEventListener('click', next);
    btnNoSticker.addEventListener('click', markNoSticker);
    btnJump.addEventListener('click', nextUnreviewed);
    btnSave.addEventListener('click', saveCurrent);
    btnExport.addEventListener('click', exportCsv);
    window.addEventListener('beforeunload', saveCurrent);
    loadCurrent();
    updateStatusBar();
  </script>
</body>
</html>
`;

writeFileSync(pagePath, html, 'utf8');
console.log('Página de validação criada em: ' + pagePath);
console.log('Abra no navegador e, ao final, baixe o CSV em "Exportar CSV".');
