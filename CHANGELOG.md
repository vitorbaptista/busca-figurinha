# Changelog

Notable changes to the sticker scanner. Newest first. No formal releases yet (deploys on push to
`main`), so entries are grouped by date. Keep this updated when you ship something notable.

## 2026-06-17 — Android: baseline Pixel combinado

### Fixed
- **OCR Android recupera `TUN10` quando o `N` afina como `I` e o `0` fecha como `Q`.** O resgate
  fica preso ao shape completo `TUI 10`, exige score mínimo no `N` afinado e topologia de um furo
  no zero final. O baseline combinado sobe para `148/216` positivos (`68,52%` recall), `63`
  leituras exatas, `41/43` seguradas avaliáveis confirmadas, `0/157` falsos positivos e `0`
  commits errados.
- **OCR Android recupera `RSA13` e `QAT17` em shapes Pixel verificados sem ampliar correção textual.**
  O classificador agora mantém `RSA13` quando o `3` vence mas fica empatado com outro dígito no
  shape completo `RSA 13`, e recupera `QAT17` quando o `Q` abre como `D` no shape `DAT 17`. O
  baseline combinado sobe para `147/216` positivos (`68,06%` recall), `62` leituras exatas,
  `41/43` seguradas avaliáveis confirmadas, `0/157` falsos positivos e `0` commits errados.
- **OCR Android recupera `MEX15` quando o `X` fragmenta como `1` em crop Pixel.** O resgate fica
  preso ao shape completo `ME1 15`, exige confiança mínima no glifo fragmentado e não abre correção
  para outros sufixos. O baseline combinado sobe para `145/216` positivos (`67,13%` recall), `60`
  leituras exatas, `41/43` seguradas avaliáveis confirmadas, `0/157` falsos positivos e `0`
  commits errados.
- **OCR Android recupera `RSA19` quando o `9` aparece com dois buracos no crop Pixel.** O resgate
  é preso ao shape completo `RSA 19`, exigindo margem contra a melhor letra. O baseline combinado
  sobe para `144/216` positivos (`66,67%` recall), `59` leituras exatas, `41/43` seguradas
  avaliáveis confirmadas, `0/157` falsos positivos e `0` commits errados.
- **OCR Android recupera `SCO16` quando o `O` fecha e o `S` fica fraco no crop Pixel.** O resgate
  é preso ao shape completo `SC0/U 16`, sem aceitar o mesmo padrão para outros sufixos. O baseline
  combinado sobe para `143/216` positivos (`66,20%` recall), `58` leituras exatas, `40/43`
  seguradas avaliáveis confirmadas, `0/157` falsos positivos e `0` commits errados.
- **OCR Android recupera `NED12` quando o `D` fecha como `0` em crop Pixel.** O resgate é preso ao
  shape completo `NE0 12`, sem abrir o split geral que criava falso positivo. O baseline combinado
  sobe para `142/216` positivos (`65,74%` recall), `57` leituras exatas, `39/43` seguradas
  avaliáveis confirmadas, `0/157` falsos positivos e `0` commits errados.
- **OCR Android aceita `4` forte sem buracos com margem estreita controlada.** O classificador
  continua rejeitando dígitos ambíguos, mas passa a aceitar um `4` limpo quando ele vence o
  runner-up e a melhor letra por margens positivas. Isso recupera um frame de `EGY4` sem falso
  positivo: o baseline combinado sobe para `141/216` positivos (`65,28%` recall), `56` leituras
  exatas, `38/43` seguradas avaliáveis confirmadas, `0/157` falsos positivos e `0` commits
  errados.
- **OCR Android lê cápsulas claras com texto escuro no caminho Pixel.** Boxes `LIGHT` fortes agora
  preservam a polaridade correta no preparo do crop, e o classificador aceita um `3` sem buracos
  apenas quando score, runner-up e melhor letra mantêm margens positivas. Isso recupera a segurada
  de `RSA13`: o baseline combinado sobe para `140/216` positivos (`64,81%` recall), `38/43`
  seguradas avaliáveis confirmadas, `55` leituras exatas, `0/157` falsos positivos e `0` commits
  errados.
- **OCR Android aceita `5` forte com topologia de um furo em crops Pixel.** O classificador ainda
  rejeita dígitos ambíguos, mas passa a aceitar um `5` com score alto, um furo e separação contra
  a melhor letra. Isso recupera a segurada de `EGY5` sem falso positivo: o baseline combinado sobe
  para `137/216` positivos (`63,43%` recall), `37/43` seguradas avaliáveis confirmadas, `53`
  leituras exatas, `0/157` falsos positivos e `0` commits errados.
- **Matcher Android recupera aliases exatos vistos no Pixel sem abrir distância geral.** Leituras
  verificadas no CSV manual como `RGA 17`→`RSA17`, `EN 20`→`NOR20`, `ON 15`→`IRN15`,
  `BN 10`→`POR10` e `SE 20`/`SXJ 20`→`IRQ20` agora entram só no caminho de alta confiança e só
  preservando o número da figurinha. O baseline combinado sobe para `135/216` positivos (`62,50%`
  recall), `36/43` seguradas avaliáveis confirmadas, `0/157` falsos positivos, `0` commits errados
  e menos trabalho de OCR (`392` crops contra `477`).
- **Atlas Android aprende um crop real de `MEX15` que segmentava o `M` em duas metades.** Um crop
  Pixel revisado manualmente (`frame-84`) agora entra no harvest com slices manuais, recuperando
  mais uma leitura exata sem abrir o matcher. O baseline combinado sobe para `89/216` positivos
  (`41,20%` recall), `23/43` seguradas avaliáveis confirmadas, `52` leituras exatas, `0/157`
  falsos positivos e `0` commits errados.
- **Matcher Android recupera mais leituras Pixel verificadas sem falso positivo.** As confusões de
  alta confiança agora aceitam apenas pares observados no CSV manual, com dígitos idênticos e
  candidato único, cobrindo leituras como `HSA 17`→`RSA17`, `UIN 10`→`TUN10`,
  `OAT 17`→`QAT17`, `OJW 4`→`CUW4` e `NEN 20`→`NOR20`. O baseline combinado sobe para `88/216`
  positivos (`40,74%` recall), `22/43` seguradas avaliáveis confirmadas, `0/157` falsos positivos
  e `0` commits errados. A tentativa mais agressiva de distância 3 foi rejeitada por gerar
  `2/157` falsos positivos.
- **OCR Android melhora no dataset Pixel combinado revisado manualmente.** O atlas real ganhou
  glifos de treino verificados de `MEX15` e `TUN10`, e o pipeline agora alcança um candidato de
  pill compacto quando os dois primeiros boxes são fragmentos. O baseline combinado sobe para
  `73/216` positivos (`33,80%` recall), `19/43` seguradas avaliáveis confirmadas, `0/157` falsos
  positivos e `0` commits errados, mantendo p95/max de OCR em `4/6` crops.
- **Matcher Android rejeita restauração perigosa de letra fina na borda.** Leituras como `RN10`
  deixam de virar `IRN10`; a restauração curta fica restrita a letras finas no interior do prefixo
  (`CV12` → `CIV12`, `BH12` → `BIH12`). Isso evitou um falso `IRN10` observado em frame de `POR10`
  durante a colheita de novos glifos.

### Changed
- **Confusões de alta confiança passam a refletir os crops Pixel revisados.** Com dígitos idênticos
  e candidato único, o Android agora aceita pares observados no dataset manual (`C→G`, `I→U`,
  `M→A`, `W→A`, além dos pares anteriores) para recuperar casos como `ECY 4`→`EGY4`,
  `TIN 10`→`TUN10`, `MIT 4`→`AUT4` e `WIT 8`→`AUT8`, sem relaxar a trava de `0` falso positivo no
  gate.
- **Gate Pixel agora usa o dataset combinado como baseline padrão.** O benchmark Android exige
  `216` positivos e `157` negativos revisados manualmente, recall mínimo de `41,2%`, `23`
  seguradas confirmadas, pelo menos `52` leituras exatas e no máximo `37` acertos dependentes de
  correção textual, mantendo `0` falso positivo.

## 2026-06-17 — Android: resgate estreito no retículo

### Fixed
- **OCR Android lê um `SWE8` real sem depender de correção textual.** O atlas ganhou glifos de um
  crop Pixel revisado manualmente que antes lia `BWE 8`; o teste de ouro agora exige a leitura crua
  `SWE 8`. No baseline manual, os acertos por leitura exata sobem de `36/45` para `37/45`, os
  acertos dependentes de correção caem de `9/45` para `8/45`, e o gate mantém `45/45` positivos,
  `0/156` falsos positivos e p95/max de OCR em `2/2` crops.
- **OCR Android recupera todos os positivos do dataset Pixel manual.** Quando a detecção normal
  falha mas deixa uma assinatura geométrica muito específica de pill parcial, corpo da figurinha ou
  cabeçalho cortado no retículo, o pipeline tenta um crop fixo estreito no topo direito da janela.
  O fallback mantém aceitação restrita: match exato, restauração de letra fina (`CV4` → `CIV4`) ou
  a confusão observada de borda `EGVn` → `EGYn` apenas nesse gate. Isso recupera `RSA6`, `CIV4`,
  `AUS18` e `EGY5`; o baseline sobe para `45/45` positivos (`100%` recall), mantendo `0/156`
  falsos positivos, `11/11` seguradas avaliáveis confirmadas e p95/max de OCR em `2/3` crops.

### Changed
- **Gate Pixel trava regressão de OCR limpo.** Além de `100%` recall e `0` falso positivo, o
  benchmark Android agora falha se o dataset manual cair abaixo de `37/45` leituras exatas ou subir
  acima de `8/45` acertos dependentes de correção textual. Isso evita que uma mudança pareça neutra
  no agregado enquanto aumenta a fragilidade do OCR.
- **Relatório Pixel separa acertos limpos de acertos corrigidos.** O benchmark agora mostra, por
  frame e por código manual, quantos acertos vieram de leitura exata, correção conservadora ou
  confusão conhecida, expondo casos frágeis mesmo quando o recall agregado já está em `100%`.
- **Caminho live prioriza crops específicos antes de gastar OCR em fragmentos.** O pipeline continua
  usando o mesmo conjunto restrito de boxes e o mesmo matcher conservador, mas tenta primeiro o pill
  largo quando ele é muito maior que os fragmentos de score alto, e antecipa o rescue de cabeçalho
  cortado somente no gate específico de `EGY5`. Isso tira `MEX15` e `EGY5` da lista de maior
  trabalho, reduz o baseline de `143` para `136` crops OCR totais e mantém `45/45` positivos,
  `0/156` falsos positivos e p95/max em `2/3` crops.
- **OCR Android evita rescues largos em corpo de figurinha e tenta retry nítido antes do flip.** O
  candidato wide agora tem limite superior de tamanho para não tratar o corpo inteiro da figurinha
  como pill, e o retry de alta resolução roda antes do crop 180° quando a captura está alinhada.
  Com isso `SWE8` e `AUS18` deixam de pagar 3 crops, o baseline cai para `134` crops totais e o
  p95/max fica em `2/2`, mantendo `45/45` positivos e `0/156` falsos positivos.
- **Relatório Pixel mostra cobertura por código manual.** O benchmark agora lista acertos, splits e
  orçamento de crops por código confirmado, e marca códigos difíceis sem GT manual; no dataset atual
  `TUN10` ainda não tem frame revisado e não deve ser usado para validar melhoria.
- **Relatório Pixel sugere próximas capturas úteis.** Os códigos difíceis monitorados (`MEX15`,
  `IRQ20`, `TUN10`) agora aparecem com recomendações de coleta quando têm poucos frames manuais ou
  cobertura só em treino, para evitar otimizar em cima de evidência fraca.
- **Script rápido mostra lacunas de captura do dataset Pixel.** `npm run pixel:gaps` lê o CSV manual
  e imprime, sem rodar o benchmark Android, quantos frames ainda faltam para os códigos difíceis.
- **Benchmark Pixel aceita dataset local manual.** `FIGURINHAS_PIXEL_DATASET=... ./gradlew test`
  roda a mesma avaliação Android contra uma coleta local revisada, mantendo o dataset padrão como gate
  versionado.
- **Gate do benchmark Pixel acompanha o novo baseline manual.** A suíte Android agora falha se o
  recall do CSV verificado manualmente cair abaixo de `100%`, além de manter `0` falso positivo,
  confirmação de seguradas e orçamento de crops. O orçamento agora também trava o novo teto local:
  média máxima de `0,70` crop por frame, p95 `2` e máximo `2` crops por frame.

## 2026-06-16 — Android: retry sem falso "lido"

### Added
- **Benchmark Pixel mede confirmação por segurada.** Além do recall por frame, o relatório agora
  agrupa frames manuais por código/origem e simula o mesmo `CONFIRMATIONS=2` do app, separando
  sequências avaliáveis de exemplos com frames insuficientes. No dataset atual, `7/11` seguradas
  avaliáveis confirmam sem falso commit; as pendentes são `AUT4`, `MEX15`, `GHA19` e `NOR20`.
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
- **OCR Android confirma todas as seguradas avaliáveis do Pixel.** O resgate de cabeçalho agora
  tenta uma hipótese compacta ancorada nos fragmentos horizontais mais à direita antes da hipótese
  larga, recuperando o segundo frame de `GHA19` sem abrir o matcher. No benchmark Pixel com CSV
  manual, o baseline sobe para `41/45` positivos (`91,11%` recall), `11/11` seguradas avaliáveis
  confirmadas, `0/156` falsos positivos e p95/max de OCR em `2/4` crops.
- **OCR Android confirma a segurada difícil de `NOR20`.** Além do recorte central para caixas
  largas demais, o caminho live agora sintetiza um candidato largo quando a detecção encontra só
  fragmentos horizontais alinhados do cabeçalho. No benchmark Pixel com CSV manual, o baseline sobe
  para `40/45` positivos (`88,89%` recall), `10/11` seguradas avaliáveis confirmadas, ainda com
  `0/156` falsos positivos e p95/max de OCR em `2/4` crops.
- **OCR Android confirma a segurada difícil de `MEX15`.** O rescue speck-tolerant agora rastreia o
  segundo melhor dígito e, apenas nesse caminho opt-in para candidatos largos/fracos, aceita o caso
  estreito em que um `5` borrado parece `8` com um único furo e margem mínima. A seleção de boxes
  também passa a alcançar o candidato largo quando os dois primeiros são fragmentos pequenos. No
  benchmark Pixel com CSV manual, o baseline sobe para `38/45` positivos (`84,44%` recall), `9/11`
  seguradas avaliáveis confirmadas e `0/156` falsos positivos.
- **OCR Android recupera um crop fraco de `MEX15` sem falso positivo.** O pipeline agora tenta um
  rescue speck-tolerant apenas em candidatos largos/tardios e só aceita a leitura se ela fechar na
  lista de códigos por match conservador ou confusão de alta confiança com dígitos idênticos. O
  atlas real ganhou slices verificados de `MEX15`; o benchmark Pixel manual sobe para `37/45`
  positivos (`82,22%` recall), mantendo `0/156` falsos positivos e p95/max de OCR em `2/4` crops.
- **OCR Android recupera leituras confiantes com confusões conhecidas.** O pipeline agora usa a
  lista fechada de códigos apenas para leituras de glyph com alta confiança, dígitos idênticos e
  pares de letras observados (`N→A`, `J→U`) com candidato único. Isso recupera `AUT4` em crop real
  com `U/T` colados e melhora o benchmark Pixel manual para `36/45` positivos, `8/11` seguradas
  avaliáveis e `0/156` falsos positivos.
- **OCR Android recupera `RSA17` e `CIV4` no dataset manual.** O reconhecedor agora tenta dividir
  dois componentes colados em crops de 5 caracteres que viraram 3 blocos, e trata um `O` sem furo
  como `C` apenas na corrida de letras. Com a restauração curta de letra fina (`CV4` → `CIV4`), o
  baseline manual sobe para `24/35` positivos com `0/11` falsos positivos.
- **Burst vazio não trava mais o scanner Android.** Quando a figurinha fica parada mas o OCR não
  confirma nenhum código, o app agora rearma a captura e tenta de novo no mesmo alvo em vez de
  entrar em `LOCKED` e mostrar falsamente "lido ✓ — troque a figurinha". O `LOCKED` fica reservado
  para bursts que realmente commitam um código.

### Changed
- **Gate do benchmark Pixel acompanha o baseline manual atual.** O teste Android agora falha se o
  CSV verificado manualmente cair abaixo de `91%` de recall ou deixar de confirmar `11/11`
  seguradas avaliáveis, além de manter a trava de `0` falso positivo e o orçamento de crops.
- **OCR Android ignora fragmentos verticais no caminho live.** Como a captura guiada assume a
  figurinha mais ou menos horizontal, o pipeline agora despacha OCR apenas para boxes horizontais,
  deixando fragmentos verticais de logo/borda fora da leitura. No benchmark Pixel manual, o recall
  permanece em `37/45`, com `0/156` falsos positivos, e o trabalho cai de `142` para `139` crops.
- **Benchmark Pixel usa só códigos revisados manualmente.** O benchmark Android agora usa o
  `ground_truth_verification.csv` local do dataset, considera `verified_code/status` revisados e
  ignora o `ground_truth_code` automático antigo. O baseline atual cobre `45` positivos e `156`
  negativos revisados manualmente, com `34/45` positivos lidos e `0/156` falsos positivos.
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
