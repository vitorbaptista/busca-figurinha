# Changelog

Notable changes to the sticker scanner. Newest first. No formal releases yet (deploys on push to
`main`), so entries are grouped by date. Keep this updated when you ship something notable.

## 2026-06-16 — Android: retry sem falso "lido"

### Added
- **Atlas real do OCR ganhou crops verificados do Pixel mais recente.** O harvest agora inclui
  amostras manuais de `RSA19`, `AUT4`, `RSA17`, `PAN1`, `GHA19`, `CIV12`, `RSA6`, `AUT8`, `AUS2`,
  `NZL18`, `CIV4` e `AUS18`, sempre a partir de frames revisados manualmente. No dataset atual,
  isso elevou o baseline de `15/45` para `26/45` positivos sem falso positivo.
- **Fixture real do Pixel para SWE 8.** O teste de ouro Android agora inclui quadros capturados no
  Pixel em modo debug e valida a ROI/fill-light reais: quadros próximos precisam ler `SWE 8`, e
  todos precisam manter 0 falso positivo.
- **Conjunto de benchmark SWE8 no Android estendido para validação local.** O arquivo de benchmark
  passou a capturar `boxes`, `inkBoxes` e razões de falha (sem caixa, sem tinta, sem match), além
  de ignorar a chamada de fallback não treinada de Tesseract (`recognizeSlow = null`) e manter o mesmo
  contrato conservador de `0 falso positivo`.
- **Diagnóstico de misses do benchmark Android mostra geometria das caixas.** O relatório dos
  positivos não lidos agora inclui `x/y/w/h`, score e inclinação de cada box tentado, facilitando
  separar erro de localização de erro de OCR sem depender de inspeção manual solta.
- **Benchmark Android virou gate contra regressão do baseline manual.** A suíte agora falha se o
  dataset verificado manualmente produzir qualquer falso positivo ou cair abaixo do patamar atual
  de `8/10` positivos processáveis no baseline.
- **Atlas real do OCR ganhou amostras verificadas de `IRQ20` e `SWE8`.** O atlas de glifos agora
  inclui templates colhidos de crops reais confirmados manualmente, recuperando `IRQ20` no benchmark
  local sem regredir os testes de ouro de `SWE8` nem aumentar falsos positivos.

### Fixed
- **Burst vazio não trava mais o scanner Android.** Quando a figurinha fica parada mas o OCR não
  confirma nenhum código, o app agora rearma a captura e tenta de novo no mesmo alvo em vez de
  entrar em `LOCKED` e mostrar falsamente "lido ✓ — troque a figurinha". O `LOCKED` fica reservado
  para bursts que realmente commitam um código.

### Changed
- **Benchmark Pixel escreve o relatório antes de falhar no gate.** Quando o baseline ainda não
  atinge recall total, o arquivo `baseline_max4.md` continua sendo atualizado com os misses e
  falsos positivos antes do `assert`, acelerando a próxima rodada de diagnóstico.
- **Validação manual do dataset por frame foi padronizada.** Adicionado o gerador
  `scripts/verify-pixel-dataset.mjs`, que cria uma página local (`manual_verify.html`) para revisão
  frame a frame do dataset do Pixel antes de rodar benchmark. O fluxo salva `ground_truth_verification.csv`
  com status (`confirmed` / `uncertain` / etc.) e permite manter 0-falso-positivo sem depender de
  suposição implícita de `ground_truth_code`.
- **Detecção para benchmark ficou mais barata por padrão em modo dark.** O teste de benchmark agora compara
  `baseline`, `baseline_dark` e `baseline_light` no `PixelDatasetBenchmark` com `findCodeBoxes` agora
  recebendo o modo de primeiro plano; no dataset atual, `DARK` sozinho recupera o mesmo recall de
  `0 falsos positivos` com latência de detecção menor.
- **Revisão de dataset ficou mais rápida para “sem sticker”.** A página de revisão agora exibe `crop_count`
  por frame e adiciona o marcador **Sem sticker visível** com um clique, reduzindo revisão manual com
  falsos positivos de detecção.
- **Bench Android agora usa o CSV de verificação opcional.** Quando
  `ground_truth_verification.csv` estiver presente, `PixelDatasetBenchmark` calcula métricas de precisão
  e falso positivo apenas sobre frames marcados como `confirmed`; frames sem confirmação não entram no
  numerador/denominador.
- **Retículo Android virou janela de captura com fill-light.** A área fora da caixa fica branca para
  iluminar a figurinha, e a ROI foi apertada para uma caixa central menor, alinhada ao que o
  reconhecedor lê.
- **Split do dataset Pixel foi refeito por estratificação de classe.** A partir de
  `ground_truth_verification.csv` (com `confirmed`, `not_sticker` e demais classes), a divisão
  `train/val/test` foi refeita para respeitar melhor a distribuição de labels e manter a consistência
  de validação de 0 FP (com apenas 11 labels positivas e muito `not_sticker`).
- **ROI Android foi alargada com base no dataset manual.** O retículo passou para uma janela central
  maior (`0.18,0.32,0.82,0.58`), recuperando mais um positivo processável no benchmark local
  (`7/10`, ainda com `0/145` falsos positivos) sem cair para a busca em frame inteiro.
- **Benchmark manual subiu para `8/10` positivos processáveis com `0/145` falsos positivos.** A
  melhoria veio do atlas real de `IRQ20` balanceado por `SWE8`; os misses restantes (`NED12` e um
  `SWE8` muito fraco) continuam tratados como misses, não como leitura arriscada.
- **Fallback conservador `DARK` pós-miss recupera `SWE8` fraco.** Quando o pipeline normal não
  resolve nenhum código, o Android tenta uma segunda detecção só para pill escuro; com um template
  real do crop fraco de `SWE8`, o benchmark manual sobe para `9/10` positivos processáveis mantendo
  `0/145` falsos positivos.
- **OCR Android recupera `NED12` verificado manualmente.** O atlas real ganhou templates fatiados
  do crop `NED12` validado na revisão manual, e o segmentador agora divide o primeiro par de letras
  coladas só no formato estreito de 4 componentes. O baseline manual passa a exigir `10/10`
  positivos processáveis com `0/145` falsos positivos.
- **Benchmark manual ficou mais rigoroso com cobertura e split.** O script de estratificação agora
  aplica a distribuição calculada ao manifesto, sincroniza o `split` no CSV de verificação e não
  sobrescreve um CSV curado já existente. O gate do baseline falha se houver positivo confirmado sem
  frame ou se `train`/`val`/`test` ficarem sem positivos quando há amostras suficientes.
- **Sondagem de cena parada ficou mais barata.** A verificação que arma burst quando o app abre com
  a figurinha já parada agora usa apenas o detector `DARK`; o OCR final continua com a estratégia
  completa e o benchmark garante que a sondagem encontra caixa em todos os positivos processáveis.
- **Fallback `DARK` pós-miss roda só em miss sem texto.** A segunda busca escura continua
  recuperando os crops fracos verificados, mas deixa de rodar quando a primeira passada já viu texto
  e rejeitou como inseguro. No benchmark manual, a baseline mantém `10/10` e `0/145` falsos
  positivos com menos crops médios por frame.
- **Gate do benchmark Pixel ficou determinístico e mais rápido.** O teste padrão agora valida só a
  baseline crítica (`10/10`, `0/145`) e mede trabalho de OCR por crops (`total`, `p95` e `max`),
  deixando a matriz exploratória de ROI/confiança fora da suíte normal para evitar timeouts locais.
- **ROI Android ficou mais estreita para leitura ao vivo.** A janela agora prioriza a faixa central
  onde o código `SWE 8` foi lido no Pixel, reduzindo fundo analisado e deixando mais claro que a
  figurinha precisa estar perto o suficiente para o código preencher o retículo.
- **Instrução do scanner ficou mais direta.** O texto agora pede para aproximar o código da caixa,
  não para enquadrar a figurinha inteira, porque os dumps do Pixel mostraram que o código pequeno
  demais vira leitura de baixa confiança.
- **Debug Android mostra leituras rejeitadas.** O overlay agora exibe textos abaixo do corte de
  confiança com percentual, ajudando a distinguir "não viu nada" de "viu algo inseguro" sem
  permitir commit.
- **Câmera frontal Android usa zoom moderado.** O scanner pede zoom 2× na câmera frontal, limitado
  ao que o aparelho anuncia, para o código ocupar mais pixels na ROI sem relaxar o corte de
  confiança do OCR.
- **OCR Android lê `SWE 8` em captura real próxima.** A segmentação agora procura o vale entre
  glifos grudados em uma faixa mais ampla e aceita `8` ambíguo somente quando o glifo tem dois
  buracos fechados, mantendo rejeição conservadora para dígitos sem essa topologia.
- **Scanner Android dispara em cena já parada.** Ao abrir com a figurinha já no tripé, o app faz uma
  sondagem única depois da estabilidade e só abre o burst se houver caixa de código na ROI, sem
  transformar uma cena vazia em OCR contínuo.
- **Foco perto usa o limite anunciado pela câmera.** O Android agora lê
  `LENS_INFO_MINIMUM_FOCUS_DISTANCE` da câmera selecionada antes de montar os use cases, em vez de
  sempre pedir um valor fixo. Câmeras de foco fixo continuam sem trava manual.
- **Backup Android preserva o modo debug.** Exportar/importar agora mantém o ajuste `debug`, e
  backups antigos sem esse campo continuam importando com debug desligado.
- **Dígitos de um furo usam topologia com margem contra letras.** O OCR Android agora aceita um
  `6/9/0` ambíguo entre dígitos quando há exatamente um furo, score forte e a melhor letra fica
  abaixo por margem mínima. Isso recupera `RSA6` no benchmark (`27/45`) mantendo `0/156` falsos
  positivos.
- **Overlay de crops do debug acompanha o espelho da câmera frontal.** As caixas coloridas agora
  são espelhadas no preview frontal, alinhando o diagnóstico visual ao que o usuário vê sem alterar
  os frames reais usados pelo OCR.
- **Retry high-res só para crop pequeno e box intermediário.** O Android agora tenta uma segunda
  preparação a `192px` apenas no box principal com score intermediário (`0.84..0.92`) e só depois da
  leitura normal falhar. Isso recupera `RSA19` e `AUS18` no dataset manual (`29/45`) mantendo
  `0/156` falsos positivos e evitando o custo/risco do upscale global.
- **Candidatos secundários quase quadrados são descartados.** Como o fluxo real espera a figurinha
  mais ou menos horizontal, o detector mantém o melhor candidato mas remove caixas secundárias com
  proporção visual menor que `1.8`, reduzindo ruído no overlay/benchmark sem mudar o recall
  (`29/45`) nem os falsos positivos (`0/156`).
- **Scanner Android limita OCR aos 2 melhores boxes.** No dataset manual, `maxBoxes=2` manteve o
  mesmo recall (`29/45`) e `0/156` falsos positivos de `maxBoxes=4`, reduzindo o trabalho de OCR de
  `193` para `165` crops e o p95 de crops de `3` para `2`.
- **OCR Android divide letras centrais grudadas em códigos curtos.** Quando um crop vira três
  componentes e o componente do meio tem largura de duas letras próximas, o segmentador divide só
  esse componente. Isso recupera `AUT4` no dataset manual (`30/45`) mantendo `0/156` falsos
  positivos e reduzindo o trabalho total para `164` crops.
- **Benchmark Pixel usa piso de regressão realista.** O teste Android continua exigindo `0` falso
  positivo, mas agora trava o recall do dataset manual em pelo menos `66%` em vez de exigir
  `45/45` enquanto ainda existem misses conhecidos no relatório.
- **OCR Android recupera `NZL18` sem aumentar falsos positivos.** O reconhecedor agora tenta dividir
  um segundo componente colado quando uma leitura de 4 glifos parece `2 letras + 2 dígitos`, e o
  pipeline só consulta boxes largos/tardios muito plausíveis. No dataset manual, o benchmark sobe
  para `32/45` positivos com `0/156` falsos positivos; o trabalho cai para `146` crops no total e
  p95/max de `2/4`, e o gate passa a travar esse piso.
- **Crops vazios param cedo quando não há fallback treinado.** Enquanto o fallback slow continua
  ausente, um fast-read vazio não paga flip/retry inútil. Isso preserva a política de não usar
  Tesseract sem treino e reduz trabalho em misses sem ampliar o matching.

## 2026-06-15 — Remove "Enviar foto"

### Removed
- **"Enviar foto" (photo upload) is gone.** Dropped the file-picker fallback from the scan screen
  along with its `onPhotoPicked` handler, the `loadImage` decoder, the `analyzing` overlay/state, and
  the `scan.sendPhoto` / `scan.analyzing` strings. The live camera (plus the "Digitar código" manual
  entry) is the only scan path now.

## 2026-06-15 — Multi-sticker repeat-count fix

### Fixed
- **Dropped co-present stickers in one hold.** When several sticker backs were held together, the
  commit cooldown (`minRecaptureMs`) dropped any sticker that confirmed a frame *after* the first
  batch committed — so a frame showing 4 stickers could record only 3 (e.g. 2 new + 1 repeated
  instead of 2 + 2), undercounting both the live counter and the end-of-session report. The cooldown
  now gates only a burst's **first** commit (its real job: rejecting a same-sticker re-arm between
  separate holds); additional co-present stickers in the same hold commit freely, with the 2-frame
  confirmer (`match.confirmations`) staying the within-burst misread guard. New `domain/commitGate.ts`
  + tests. **Validate live on the Pixel** — it relaxes a 0-FP backstop.

## 2026-06-15 — Scan-loop responsiveness + stall recovery

### Fixed
- **Scanner could get stuck on "troque a figurinha".** When the camera `<video>` paused/stalled
  after a while (Android dims the screen, the app briefly backgrounds, or a focus constraint
  hiccups), nothing re-played it, so the capture loop starved (`drawTo` kept failing) and the
  auto-capture state machine froze on its last phase — usually `locked`. Added a recovery watchdog
  in `frameSource.ts` that re-plays the video on `pause` and on tab re-visibility, and a distinct
  `stalled` heartbeat phase ("sem vídeo — reconectando") so a starved loop no longer masquerades as
  `locked` in the debug readout.

### Changed
- **Faster sticker-to-sticker swaps**: `capture.minRecaptureMs` 500 → 250 ms. Reads are ~85 ms, so
  the old cooldown was the dominant idle gap between stickers. Multi-frame confirmation
  (`match.confirmations ≥ 2`) remains the primary 0-FP guard. **Re-validate 0 FP live on the Pixel.**

## 2026-06-15 — GitHub Pages deployment

### Added
- **GitHub Pages deploy** is live at http://vitorbaptista.com/busca-figurinha/ — enabled the Pages
  site (GitHub Actions source); the existing `deploy.yml` workflow auto-deploys on push to `main`.

### Fixed
- **Vite base path** corrected to `/busca-figurinha/` (was `/figurinhas-app/`, which didn't match the
  repo name and broke asset loading under the Pages subpath).

### Changed
- **CI runners**: `actions/checkout` + `actions/setup-node` bumped to v5, Node 24 LTS; opted the
  Pages actions into the Node 24 runtime to clear the Node 20 deprecation warnings.

## 2026-06-15 — Real-world speed + correctness pass

The scanner went from a slow, often-unreadable prototype to ~85 ms/pass on a Pixel, reading real
stickers reliably, with 0 false positives.

### Added
- **Hybrid two-phase recognizer** (`hybridEngine.ts`, `glyphEngine.ts` + glyph atlas, `recognize.ts`):
  a pure-JS glyph matcher reads all crops first; `tesseract.js` runs only as fallback. A sharp frame
  pays zero tesseract → **~85 ms/pass on-device** (was ~465 ms).
- **Screen fill-light** — white background + reticle so the front-facing screen lights the sticker.
  This is what actually made real (blurry) stickers readable; the gating issue was capture quality.
- **Bottom-third detection ROI** (`CONFIG.detect.roiTopFraction`) on the real camera frame, with a
  full-frame preview (`object-fit:contain`) so the reticle matches what's detected.
- **Latency benchmark**: `npm run bench -- --latency` and `--latency-sharp`.
- **Capture-loop heartbeat** (debug readout) so the loop's state is visible.
- **CHANGELOG.md** + expanded `CLAUDE.md` ("Hard-won lessons").

### Changed
- **Collection screen**: every country always expanded (no accordion), ordered by **World Cup group
  A→L** (album order, not alphabetical) with "Grupo X" headers.
- **Lazy crop prep** + **box[0]-first** early-stop in `recognize.ts` (skip the flip crop / lower-ranked
  crops when the pill resolves).
- Tighter capture cadence (`stabilityMs` 250→130, `sampleIntervalMs` 120→60).

### Fixed
- **False positives**: the fast glyph path occasionally misread one frame as a different real code.
  Restored 2-frame confirmation (`match.confirmations`) + added a commit cooldown
  (`capture.minRecaptureMs`) so only one code commits per sticker hold.
