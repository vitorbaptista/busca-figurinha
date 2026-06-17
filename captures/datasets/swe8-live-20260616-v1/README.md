# Dataset de captura real Pixel

Este dataset foi montado a partir de dumps de debug do Pixel com o app `figurinhas` em modo de inspeção.
Ele começou como uma coleta focada em `SWE8` e agora inclui uma segunda coleta multi-código
rotulada manualmente.

## Estrutura
- `raw/`: cópias dos frames reais por sessão.
- `splits/train`, `splits/val`, `splits/test`: symlinks para as entradas de `raw`.
- `dataset_manifest.csv`: metadados de cada frame.
- `dataset_info.txt`: contagem resumida por split e total.
- `manual_verify.html`: página de revisão frame a frame (gerada localmente).
- `ground_truth_verification.csv`: rótulos validados manualmente (quando exportado).

## Fontes incluídas
- `captures/live-setup-20260616-201017`
- `captures/live-user-20260616-201108`
- `captures/live-user-full-20260616-201728`
- `captures/live-user-20260617-011113`

## Regras de label
- `ground_truth_verification.csv` é a fonte de verdade para as métricas.
- Frames `confirmed` usam `verified_code` como alvo.
- Frames `not_sticker` entram como negativos.
- Frames `unknown` ou sem validação ficam fora das métricas.
- Nota: os frames foram coletados em cenário real para avaliação de estratégia, incluindo histórico de leituras com alguns falsos positivos no app.

## Split
- Total: `202` frames.
- `train`: `157`
- `val`: `15`
- `test`: `30`

## Formato do manifest
Colunas:
`frame_id, source_dir, frame_dir, frame_number, raw_frame_path, split, crop_count, ground_truth_code, notes, session_observations`

## Validação manual (recomendação)

Antes de usar `PixelDatasetBenchmark`, valide os códigos por frame:

1. Gere a página de revisão:
   `node scripts/verify-pixel-dataset.mjs captures/datasets/swe8-live-20260616-v1`
2. Abra `manual_verify.html` no navegador.
3. Marque o código observado e o status de cada frame (`confirmado`, `incerto`, etc.).
4. Exporte `ground_truth_verification.csv` e salve na raiz do dataset.
5. Rode os benchmarks com o CSV presente; só os frames `confirmado` entram nas métricas
   de precisão e falso positivo.
