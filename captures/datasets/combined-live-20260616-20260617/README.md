# Dataset combinado de captura real Pixel

Dataset combinado a partir de:

- `captures/datasets/swe8-live-20260616-v1`
- `captures/datasets/pixel-live-20260617-090351`

## Regra de verdade

As métricas devem usar somente os campos manuais de `ground_truth_verification.csv`:

- `status=confirmed` + `verified_code` define um sticker positivo.
- `status=not_sticker` define um negativo.
- `ground_truth_code` foi zerado neste dataset para evitar confusão com rótulos antigos/prefill.

## Contagem

- Total: `374` frames.
- Confirmados: `216`.
- Sem sticker: `157`.
- Split: train `294`, val `32`, test `48`.
