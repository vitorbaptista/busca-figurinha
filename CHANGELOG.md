# Changelog

Notable changes to the sticker scanner. Newest first. No formal releases yet (deploys on push to
`main`), so entries are grouped by date. Keep this updated when you ship something notable.

## 2026-06-20 — Trocar: link do WhatsApp muito mais curto

### Changed
- **O link "Enviar no WhatsApp" ficou bem menor.** Antes a lista viajava como dois mapas de bits do
  álbum inteiro, então o link tinha sempre ~333 caracteres (aquele monte de `AAAA…____`), mesmo pra
  quem só tinha umas poucas figurinhas. Agora cada lista é codificada do jeito mais curto possível
  (lista enxuta pra poucas figurinhas, complemento pra quase tudo, mapa de bits só no pior caso): o
  link de quem está começando o álbum caiu de **333 pra ~35 caracteres** (≈9× menor), e nunca fica
  maior que antes. Todos os dados continuam dentro do link — nada se perde. Links antigos (do formato
  anterior) não abrem mais a lista, mas nunca abrem uma lista **errada** (no máximo vêm vazios).

## 2026-06-20 — Repetidas vira aba + atalho "Editar" pra coleção

### Added
- **Nova aba "Repetidas"** na barra de baixo, entre **Coleção** e **Trocar**. Abre a mesma tela que
  já existia pelo botão "✏️ Editar" de "Minhas repetidas" na aba Trocar — agora também dá pra chegar
  nela direto pela navegação.
- **Botão "✏️ Editar" na seção "O que eu preciso"** (aba Trocar), igual ao de "Minhas repetidas".
  Leva pra tela **Coleção**, onde marcar as figurinhas que você tem encurta a lista do que falta.

## 2026-06-20 — Links por seção (#trocar, #colecao…)

### Added
- **A seção atual agora fica no endereço (hash da URL).** Atualizar a página volta para a mesma
  seção em vez de cair sempre no "Escanear", e dá pra abrir/compartilhar um link direto de cada
  seção: `#escanear`, `#colecao`, `#trocar`, `#ajustes` e `#repetidas`. Trocar de aba não enche o
  histórico do navegador (o "Voltar" sai do app, não fica preso pulando entre abas). A tela de
  relatório é momentânea, então ao atualizar nela você volta para o "Escanear".

## 2026-06-20 — Escanear: dá pra ver que está lendo + corrigir uma leitura errada

### Added
- **A mira mostra quando está lendo.** Antes, fora do modo debug, não dava pra saber se o app estava
  trabalhando na figurinha. Agora, quando uma figurinha para na mira, a janela vira um leitor ativo:
  a borda fica dourada e uma faixa dourada **varre** o slot ("Lendo…"), então dá pra ver que o app
  está lendo — mesmo com o resultado anterior ainda na tela. Respeita `prefers-reduced-motion` (sem
  varredura, só a borda dourada e o "Lendo…" parados).
- **Botão "Não é essa?" pra corrigir uma leitura errada.** No card GUARDAR/REPETIDA, ao lado do
  veredito, um toque em **"Não é essa?"** descarta a leitura: tira a figurinha da contagem e da lista
  "Últimas leituras", remove do escaneamento (pra não cair no resumo como uma troca errada) e já abre
  a digitação pra você colocar o código certo. Só aparece em GUARDAR/REPETIDA — o card "Não li" já
  tem a digitação manual.

## 2026-06-20 — Trocar: prévia da mensagem mais curta e organizada

### Changed
- **A "Prévia da mensagem" ficou mais curta e fácil de ler.** A seção "Preciso" deixou de ser uma
  lista corrida (`MEX1, MEX2, MEX5, MEX7`) e agora segue o mesmo formato do "Tenho": **uma seleção por
  linha, agrupada pelo grupo da Copa**, no formato compacto `🇲🇽 MEX 1, 2, 5, 7`. As seções especiais
  (**Especiais** e **Coca-Cola**) vêm no fim. Como agora cada time vira uma única linha, mesmo uma
  lista de "preciso" enorme cabe sem precisar cortar com "+N".
- **A linha de cada time/seleção também encurtou no "Tenho":** de `🇲🇽 México (MEX): 3, 6` para
  `🇲🇽 MEX 3, 6`. A bandeira + o cabeçalho do grupo já identificam o país, então o nome completo só
  deixava a mensagem mais longa.
- **Toda linha agora começa com um emoji:** as 48 seleções têm bandeira, "Especiais" usa ⭐ e a seção
  **Coca-Cola** (que não é país, então não tem bandeira UTF-8) ganhou o copo 🥤.

## 2026-06-20 — Trocar: listas de figurinhas compactas (por seleção)

### Changed
- **As seções "Minhas repetidas" e "O que eu preciso" agora mostram as figurinhas agrupadas por
  seleção, não uma linha por figurinha.** Antes, cada figurinha ocupava uma linha inteira (com nome e
  botão) — com 100+ repetidas a lista virava uma rolagem enorme. Agora cada seleção vira um bloquinho
  com a bandeira + nome + total e os números soltos lado a lado (ex.: **🇲🇽 México · 3 4 8 12 17**),
  que quebram em várias colunas. Cabe num celular de 320px e dá pra varrer a lista de relance. As que
  você **tem** (repetidas, "você dá") aparecem em quadradinhos preenchidos; as que **faltam**
  ("preciso", "você pega") em quadradinhos tracejados — a forma diferencia, nunca só a cor.
- **Tirar uma repetida da lista agora é só pela tela "✏️ Editar"** (o álbum inteiro, é só tocar na
  figurinha). O botão "Já troquei" por linha saiu junto com as linhas; a edição ficou num lugar só.

## 2026-06-20 — Escanear: tela sem rolagem + leitura que não desiste

### Fixed
- **A tela "Escanear" não precisa mais de rolagem (de verdade agora).** O contêiner usava
  `min-height: 100vh`, e no celular `100vh` é maior que a área visível (conta o espaço atrás da barra
  do navegador) — então o veredito fixo da base caía abaixo da dobra. A primeira correção pôs a tela
  em `100dvh` + `overflow: hidden`, mas isso só recorta o conteúdo DELA: o documento em volta
  continuava rolando, porque os ancestrais do app (`#app`/`.app`) usam `height/min-height: 100%`, que
  no celular é a viewport GRANDE (sem a barra) — mais alta que a área visível. Agora, enquanto a tela
  de escanear está montada, a raiz do documento é travada em `100dvh` + `overflow: hidden`, então
  nada rola e o veredito (GUARDAR / REPETIDA) sempre aparece. As outras telas (que rolam) não mudam.

### Changed
- **O leitor nunca desiste de uma figurinha — e o "lido ✓" só aparece quando lê de verdade.** Antes,
  todo disparo de leitura travava o loop (o heartbeat de debug mostrava "lido ✓ — troque a
  figurinha") mesmo quando NADA era lido. Agora o loop só trava após uma leitura real; com a
  figurinha parada e ilegível, ele continua tentando enquanto ela estiver à frente, e fica ocioso só
  quando não há nada em vista (sem gastar bateria à toa).

## 2026-06-20 — Repetidas: tela pra marcar suas repetidas na mão

### Added
- **Nova tela "Repetidas"**, aberta pelo botão **"✏️ Editar"** na seção "Minhas repetidas" da aba
  Trocar. É igual à "Minha Coleção" (álbum inteiro, com busca), mas cada toque **marca ou tira** uma
  figurinha como **repetida** — em laranja-tijolo (a cor de "REPETIDA"), com um losango no canto pra
  não depender só da cor. Serve pra ajustar sua lista de troca na mão, sem precisar reescanear, e pra
  corrigir um toque errado (é só tocar de novo). Marcar uma repetida também garante que ela conta como
  sua (entra na coleção), então ela nunca some na hora de trocar.

## 2026-06-20 — Trocar: lista aparece mesmo sem repetidas + repetidas escaneadas agora salvam

### Fixed
- **Repetidas escaneadas agora são salvas.** Quando você escaneava só figurinhas repetidas (sem
  nenhuma nova), o botão de concluir ficava desabilitado e nada era guardado — as repetidas se
  perdiam. Agora o botão **"Guardar N repetidas pra trocar"** funciona mesmo sem figurinhas novas no
  escaneamento, e elas entram na sua lista de troca.

### Changed
- **A tela "Trocar" mostra tudo mesmo sem repetidas.** Antes, sem nenhuma repetida salva, a tela só
  mostrava "Monte sua lista de troca" — escondendo o que você precisa e os botões de compartilhar.
  Agora, tendo álbum, ela sempre mostra **"O que eu preciso"** + **"Enviar no WhatsApp"** +
  **"Copiar lista"**; a mensagem vira uma lista de desejos (só "Preciso") quando você ainda não tem
  repetidas. Ordem igual ao mockup: suas repetidas → o que você precisa → prévia → ações.

## 2026-06-20 — Trocar: prévia mais limpa + "O que eu preciso" recolhido por grupo

### Changed
- **Prévia da mensagem mais limpa.** A URL longa (um link enorme) não aparece mais crua na prévia —
  no lugar entra um marcador "🔗 (o link da sua lista vai junto)". O link de verdade continua na
  mensagem enviada e na cópia, então a troca de mão dupla com o amigo segue funcionando igual.
- **"O que eu preciso" recolhido por grupo.** Em vez de despejar todas as figurinhas que faltam de
  uma vez (num álbum meio cheio eram ~620 linhas), cada grupo do álbum (A–L, Especiais, Coca-Cola)
  vira uma linha com "faltam N"; toque pra abrir e ver os códigos que faltam daquele grupo.

## 2026-06-20 — Tela "Escanear" refeita no estilo do álbum (vídeo só no recorte)

### Changed
- **A câmera agora aparece SÓ dentro da "mira" (o recorte), não na tela toda.** O vídeo é
  recortado à janela da figurinha; em volta fica a superfície verde escura do álbum. Acabou o
  **clarão branco** (a antiga camada de "luz de preenchimento" foi removida).
- **Layout no estilo "Banca — Álbum de Papel"** (igual ao mockup): aba de seção no topo,
  contadores "Novas/Repetidas" e botões sobre a câmera, e um **veredito fixo na base** (GUARDAR /
  REPETIDA / NÃO LI) com a tira de "Últimas leituras" logo acima — no lugar do flash de tela cheia.
- **A mira fica no meio-acima**, na região da ROI de detecção. Isso **substitui** a janela de
  contorno sobre o vídeo inteiro + o posicionamento via JS do ajuste anterior ("a moldura aponta
  para onde o leitor lê") — agora o vídeo é recortado direto na mira, então não há vídeo fora dela.

### Notes
- **A luz de preenchimento (tela como ringue de luz) saiu** — era o que, segundo o CLAUDE.md,
  fazia a câmera frontal ler figurinhas de perto. **A validar no Pixel:** a nitidez da captura
  frontal sem ela, e se o recorte da mira enquadra a pílula dentro da área lida.
- Entrada manual ("Digitar o código") agora fica num botão fixo na barra de cima **e** no card
  "Não li" (a rajada ao vivo é silenciosa em falhas, então o "Não li" quase não aparece sozinho).

## 2026-06-20 — Scanner: a moldura "cole aqui" agora aponta para onde o leitor lê

### Fixed
- **Moldura alinhada com a região de detecção.** A janela "cole aqui" ficava no terço inferior da
  tela, mas o leitor passou a procurar a pílula numa faixa superior-central (a ROI retangular onde
  as figurinhas de fato aparecem nas capturas reais). A moldura agora é posicionada a partir da
  MESMA ROI (`CONFIG.detect.roiRect`), mapeada pela área de vídeo com letterbox (`object-fit:
  contain`) — então onde você encaixa a figurinha é exatamente onde o app lê. (Antes, seguir a
  moldura colocava a figurinha fora da área lida.)

## 2026-06-20 — OCR: reconhecedor neural (codeNet) que supera o app nativo

### Added
- **Reconhecedor neural "codeNet" treinado 100% em JS (sem Python).** Uma CNN de posição-fixa
  (multi-cabeça, por slot) que lê o código do recorte BRUTO em tons de cinza — sem a
  binarização otsu que estilhaçava as pílulas de baixo contraste. Treinada em tfjs-node
  (dados sintéticos da fonte Anton + recortes reais) e executada no browser via tfjs
  (carregada sob demanda; modelo de 1,5 MB pré-cacheado p/ funcionar offline). Decodificação
  closed-set sobre os 980 códigos + porta de confiança (posterior/margem/hipótese-nula) =
  trava de 0 falso-positivo.
- **Pipeline em conjunto (ensemble):** o codeNet roda primeiro; o reconhecedor clássico
  (glifo + tesseract) é o fallback só quando o codeNet não resolve nada — somando os acertos
  complementares dos dois (ambos com trava de FP).

### Changed
- **ROI retangular** (0.18,0.32,0.82,0.58) virou o padrão de detecção: é onde as pílulas
  realmente aparecem nas capturas reais (a faixa inferior 0.67 lia 0%).

### Results / caveats
- No dataset real de frames do Pixel (medido por `npm run bench:pixel -- --engine=ensemble`):
  **recall 78,7% no dataset inteiro — supera o nativo (75,46%)** na mesma métrica; FP por frame
  0,6% (<3%); held-out VAL 72,7% / TEST 50,0% (a generalização honesta; o número do dataset
  inteiro é inflado pelo split de treino). Pipeline implantado lia 0% aqui; o clássico, ~51%.
- A VALIDAR no Pixel: latência (~177ms no desktop headless; deve cair no device com WebGL —
  há quantização/poda disponíveis), 1 held FP (erro de dígito do tesseract SCO16→SCO18, limite
  conhecido do clássico), alinhar a moldura/reticle com a ROI retangular, +3 MB no 1º load.
  Detalhes em `docs/web-ocr-accuracy.md`.

## 2026-06-19 — Nova tela "Trocar" (montar e compartilhar troca)

### Added
- **Aba "Trocar" 🤝.** Mostra suas **repetidas** (que viram "pra trocar") e **tudo o que você
  ainda precisa**, agrupado por grupo do álbum, no estilo "Banca — Álbum de Papel".
- **Compartilhar no WhatsApp.** Um botão gera a mensagem pronta — "Tenho pra trocar" (agrupado por
  seleção, com bandeirinha) **e** "Preciso" — mais um link. A prévia na tela mostra a mensagem que
  será enviada. Também dá pra **copiar a lista**.
- **Loop de troca de mão dupla.** Quando um amigo abre o seu link, ele cai direto numa tela que já
  mostra **o que ele pega de você** e **o que ele te dá** — e pode devolver a própria lista.
- **Repetidas guardadas de verdade.** As figurinhas repetidas que você escaneia ficam salvas pra
  trocar a qualquer momento (entram no backup e somem em "Apagar tudo"). Já trocou uma? Toque em
  **"Já troquei"** pra tirar da lista, pra ela nunca oferecer algo que você não tem mais.

## 2026-06-19 — Dados: figurinhas Coca-Cola (CC1–CC12)

### Added
- **As 12 figurinhas exclusivas da Coca-Cola (CC1 a CC12)** entraram na lista do álbum, numa seção
  própria "Coca-Cola" depois das especiais. Elas não vêm nos pacotes normais — só atrás do rótulo
  de garrafas Coca-Cola marcadas — mas o álbum tem uma página dedicada a elas, então contam para
  completar a coleção. O álbum passa de 980 para **992** figurinhas.

### Changed
- O leitor agora trata "CV12" como **indefinido** (não chuta): com a "CC12" na lista, "CV12" fica a
  uma troca de distância tanto de "CC12" (V→C) quanto da "CIV12" (recupera o "I" fino) — empate, e a
  regra de ouro é nunca cravar um código errado.

## 2026-06-19 — Visual: tema "Banca — Álbum de Papel"

### Changed
- **Cara nova em todo o app: o "Álbum de Papel".** O app agora é o gêmeo digital do álbum
  Panini de verdade — superfície verde-álbum com textura de meio-tom, cartões cor de creme com
  borda de tinta e sombra dura deslocada, detalhes em kraft/dourado e tipografia condensada de
  banca (Anton + Oswald, fontes self-hosted no `src/fonts/`, ~40 KB, funcionam offline). O
  veredito (GUARDAR / REPETIDA) continua sendo o herói da tela.
- **Estado honesto "NÃO LI".** A leitura sem resultado agora aparece num tom kraft neutro (nunca
  verde nem vermelho), reforçando que o app não chuta um código.
- **A área da câmera continua branca de propósito** (luz de preenchimento da câmera frontal) — só
  a moldura "cole aqui" virou tracejado dourado; o resto do app é verde-álbum.
- Contraste do texto secundário ajustado para WCAG AA; listas mais calmas que os cartões-herói.
- Novos `PRODUCT.md` (estratégia) e `DESIGN.md` (sistema visual) como fonte da verdade do design;
  10 mockups de exploração em `docs/mockups/`.

## 2026-06-17 — Android: baseline Pixel combinado

### Fixed
- **Overlay debug Android reduz ainda mais caixas sobrepostas no mesmo pill.** A seleção visual dos
  crops agora também considera faixas horizontais deslocadas, mantendo candidatos lado a lado
  separados, mas desenhando uma única caixa quando várias regiões cobrem a mesma cápsula.
- **Debug Android não empilha mais vários retângulos para a mesma faixa horizontal.** O NMS da
  varredura horizontal agora também remove duplicatas por cobertura e por mesma banda, e o overlay
  deduplica os crops já com padding antes de desenhar. O baseline manual combinado permanece em
  `162/216` positivos (`75,00%` recall), `42/43` seguradas avaliáveis confirmadas, `0/157` falsos
  positivos e `0` commits errados, com p95/max de OCR ainda em `3/6` crops.
- **OCR Android tenta uma janela horizontal genérica no retículo quando a detecção só acha fragmentos.**
  O resgate usa o ROI visível, evidência geométrica de pill horizontal e só roda depois de uma
  tentativa primária sem leitura, sem alias novo nem Tesseract. No baseline combinado, sobe para
  `162/216` positivos (`75,00%` recall), `42/43` seguradas avaliáveis confirmadas, `0/157` falsos
  positivos e `0` commits errados, com p95/max de OCR ainda em `3/6` crops.
- **Matcher Android recupera `GER4` quando o Pixel lê `TIIII 4` em alta confiança.** O alias exato
  é restrito ao raw verificado no CSV manual e preserva o número da figurinha. O baseline combinado
  sobe para `157/216` positivos (`72,69%` recall), com `68` leituras exatas, `89/157` acertos
  dependentes de correção textual, `0/157` falsos positivos e `0` commits errados.
- **OCR Android recupera `EGY5` em shapes Pixel `SDY 5` e `FGY 5` sem passar pelo matcher.** O
  resgate fica preso ao shape completo `EGY5`, exige o `5` final separado por margem positiva e
  emite `EGY 5` direto, evitando aumentar a dívida de correção textual. O baseline combinado sobe
  para `156/216` positivos (`72,22%` recall), `68` leituras exatas, `41/43` seguradas avaliáveis
  confirmadas, `0/157` falsos positivos e `0` commits errados.
- **Scanner Android alcança um crop fino tardio de `QAT17` sem aumentar trabalho nem falso positivo.**
  A seleção live agora promove um candidato largo e baixo apenas quando os primeiros boxes são
  fragmentos pequenos, e o OCR aceita o shape completo `DAT 17` macio só com sufixo forte. O
  baseline combinado sobe para `154/216` positivos (`71,30%` recall), `66` leituras exatas,
  `41/43` seguradas avaliáveis confirmadas, `0/157` falsos positivos e `0` commits errados.
- **OCR Android recupera `QAT17` quando o `Q` fecha como `0` e o `7` fica levemente macio.** O
  resgate fica preso ao shape completo `0AT 17`, exige `Q` como melhor letra no primeiro glifo,
  margem mínima no `7` final e não abre outros sufixos. O baseline combinado sobe para `153/216`
  positivos (`70,83%` recall), `65` leituras exatas, `41/43` seguradas avaliáveis confirmadas,
  `0/157` falsos positivos e `0` commits errados.
- **Matcher Android recupera `PAN1` quando o cabeçalho lê `IUM 1` no Pixel.** O alias exato
  preserva o número e só entra no caminho de alta confiança já existente. O baseline combinado
  sobe para `152/216` positivos (`70,37%` recall), `41/43` seguradas avaliáveis confirmadas,
  `0/157` falsos positivos e `0` commits errados.
- **Scanner Android recupera um `IRQ20` tardio sem aumentar falsos positivos.** A seleção de crops
  agora permite um candidato compacto tardio ligeiramente mais fraco e o matcher aceita o alias
  exato verificado `WO 20`→`IRQ20`, preservando o número. O baseline combinado sobe para `151/216`
  positivos (`69,91%` recall), `41/43` seguradas avaliáveis confirmadas, `0/157` falsos positivos
  e `0` commits errados, com p95/max de OCR ainda em `3/6` crops.
- **Matcher Android aceita aliases exatos de `CUW4` em confiança média sem relaxar confusões gerais.**
  Leituras Pixel verificadas como `DXW 4` e `DAV 4` agora entram por um caminho separado de alias
  exato a partir de `82%`, enquanto as confusões por letra continuam exigindo `85,5%`. O baseline
  combinado sobe para `150/216` positivos (`69,44%` recall), `63` leituras exatas, `41/43`
  seguradas avaliáveis confirmadas, `0/157` falsos positivos e `0` commits errados.
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
- **Tela de escaneamento Android não escurece enquanto está aberta.** O scanner agora mantém a tela
  acordada somente durante o uso da câmera, preservando a luz branca usada como fill-light e
  restaurando o comportamento normal ao sair da tela.
- **Scanner Android considera leituras exatas repetidas ao longo do burst.** Leituras brutas de
  baixa confiança só contam quando já são um código real do checklist e aparecem em frames
  suficientes para passar pelo confirmer; `00`, aliases e correções continuam fora desse caminho.
  O benchmark agora valida commits errados em seguradas positivas e commits em seguradas sem
  sticker. Uma tentativa mais agressiva por codebook foi rejeitada porque gerava commit errado no
  GT manual.
- **Debug Android passa a mostrar candidatos de cápsula por varredura horizontal.** O detector agora
  marca caixas vindas de uma busca direta por bandas horizontais no retículo; no modo debug elas
  aparecem em magenta no overlay e entram nos dumps de crops. O caminho de OCR ignora essas caixas
  por enquanto, porque usá-las como fallback direto não melhorou o baseline manual sem aumentar
  trabalho.
- **Scanner Android passa a orientar enquadramento sem bloquear OCR quando há candidato visual.** O
  live loop agora expõe mensagens como “Aproxime mais o código”, “Centralize o código na caixa” e
  “Deixe o código reto”, mas ainda deixa o matcher/confirmer tentar a leitura quando há alguma
  evidência de código no retículo.
- **Benchmark Pixel Android passa a proteger contra overfitting por split.** O relatório agora
  mostra recall, misses, falsos positivos e dívida de correção separados em treino/validação/teste,
  e o gate do dataset manual combinado trava os acertos atuais de validação (`15/22`) e teste
  (`15/24`) além do recall total e de `0` falso positivo.
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
