# Unificar os scanners + "Terminar" no Conferir (design)

Data: 2026-06-22

## Problema

Existem duas telas de câmera quase idênticas:

- **Escanear** (`ScanScreen`) — escaneia o álbum do próprio usuário. Tem um fluxo limpo de dois
  passos: escaneia ao vivo acumulando numa `session` (acumulador read-only) → botão **"Terminar"**
  → `ReportScreen` (marca os keepers → grava em `collection` + `repeats`).
- **Conferir** (`ConferirScreen`) — escaneia a pilha do amigo durante a troca. **Não tem passo
  "Terminar".** As ações de pós-escaneamento estão espremidas _dentro_ da tela ao vivo, no rodapé:
  "💾 Salvar" (revisar o que você pegou → grava em `collection`) e "Mandar pro amigo" (compartilha
  a pilha inteira de volta via `PileShareSheet`).

Dois problemas, um de UX e um de código:

1. **UX assimétrica.** O Conferir mistura "escanear" e "finalizar" na mesma tela, enquanto o
   Escanear separa os dois passos. A experiência de escaneamento deveria ser a mesma nas duas
   telas (só muda o texto onde faz sentido); a divergência pertence ao passo de **finalização**,
   porque o objetivo é diferente (numa você escaneia as _suas_ figurinhas, na outra as do _outro_).
2. **Duplicação.** ~250–300 linhas de motor de escaneamento e "chrome" da câmera são copiadas
   verbatim entre as duas telas — incluindo a disciplina de **0 falsos-positivos** (confirmer +
   cooldown de commit). O próprio `ConferirScreen` admite nos comentários: _"copied verbatim from
   the shipping scanner's 0-FP path"_ e _"Keep every guard identical"_. Hoje, uma correção numa
   tela não chega na outra.

## Objetivo

- **Uma única experiência de escaneamento ao vivo** (motor + chrome), consumida pelas duas telas.
- **Conferir ganha um passo "Terminar"** simétrico ao do Escanear, levando a uma tela de
  finalização própria que faz duas coisas: revisar o que você pegou → gravar na coleção, e mandar
  a lista pro amigo.
- A tela ao vivo do Conferir vira **escaneamento puro** (os botões inline Salvar/Mandar saem dela).

Decisões já tomadas com o usuário:

- A tela de finalização do Conferir faz **as duas coisas** (revisar pegadas + compartilhar de volta).
- **Extração completa**: extrair `useScanner` + `<ScanShell>` e refatorar **as duas** telas para
  consumi-los (não só o Conferir). Single-source da disciplina 0-FP.
- Acumulador `createPileSession` (espelho de `domain/session.ts`), **em memória** (uma troca é uma
  sessão única; o estado atual do Conferir também não persiste).
- A tela de finalização do Conferir **não navega sozinha** depois de salvar (você pode salvar _e
  depois_ compartilhar): salvar mostra sucesso inline, o compartilhar continua disponível, a saída
  é explícita ("Voltar").

## Não-objetivos

- Não mexer nos casos de uso nem na navegação entre telas (links, abas).
- Não unificar os componentes de veredito: `Verdict` (owned/needed/unknown) e `ConferirVerdict`
  (take-mine/take-friends/skip/unknown) são modelos de resultado genuinamente diferentes, não só
  texto. Continuam componentes separados.
- A tela dev `CaptureScreen` (`?capture`) **fica de fora**: não roda o pipeline de OCR (sem
  `ensureOcr`/`recognizeCanvas`/confirmer), usa `useReticleAlignment` e markup próprios. O único
  overlap é o ciclo de vida trivial da câmera — não vale acoplar.
- Sem refatoração não relacionada.

## Arquitetura

### 1. Motor compartilhado — `useScanner` (`src/ui/hooks/useScanner.ts`)

Hook que passa a ser dono de tudo que hoje está duplicado nas duas telas:

- **Refs:** `ocr`, `ocrInit`, `codeNet`, `source`, `capture`, `recognizeChain`, `confirmer`,
  `lastCommitAt`, `committedThisBurst`, `scanPhase`, `videoLayer`.
- **State:** `cameraState`, `ocrProgress`, `ocrReady`, `ocrFailed`, `facing`, `scanPhase`.
- **Lógica:** `ensureOcr` (codeNet lazy + tesseract + race de timeout de 25s), `recognizeCanvas`
  (cascata do ensemble → confirmer → cooldown `allowCommit` → `CaptureResult`), os quatro efeitos
  (lock `scan-active` do documento, wake lock, ciclo do OCR, ciclo de câmera + `createAutoCapture`),
  `useRoiViewport`, `flipCamera`, `retryCamera`, e o derivado `reading`.

**Entrada (opções):**

```ts
useScanner({
  onMatches: (matches: MatchResult[]) => void,   // sink único de resultado
  settings: SettingsStore,
  cameraSetting: 'camera' | 'conferirCamera',     // qual chave de settings persiste o facing
  debug?: boolean,                                 // só Escanear (instrumentação ?debug)
  record?: boolean,                                // só Escanear (?record)
})
```

- `onMatches` é o **único sink**: chamado com os matches commitados, ou com `[]` numa leitura
  explícita (não-silenciosa) que não achou nada. O handler de cada tela decide um-vs-vários e o
  que registrar. Isso elimina a diferença `handleMatches` (plural) vs `handleMatch` (singular).
- `cameraSetting` escolhe qual chave de `settings` persiste o `facing` (`camera` no Escanear,
  `conferirCamera` no Conferir).
- `debug`/`record` mantêm a instrumentação de `?debug`/`?record` do Escanear (postar imagem para o
  dev server, montar o texto de debug, o heartbeat). O Conferir omite essas flags. O texto de
  debug formatado/heartbeat fica como estado interno do hook, exposto só quando `debug`.

**Saída:**

```ts
{
  videoLayerRef, cameraState, ocrReady, ocrFailed, ocrProgress,
  facing, reading, flipCamera, retryCamera, submitManualCode
}
```

- `submitManualCode(value: string)` faz `onMatches([matchCode(value, checklist)])` — o caminho de
  entrada manual (e o seam de teste headless que o Conferir usa hoje).
- O caminho de debug `captureNow` (tap na câmera quando `?debug`) também é coberto pelo hook,
  exposto só sob `debug`.

> O `flashCounter` (key de re-render do veredito) e os contadores **ficam na tela**, não no hook —
> são preocupação de apresentação de cada tela. O `multiTimerRef` e o `audioCtx` (beep) são
> específicos do Escanear e continuam nele.

### 2. Chrome compartilhado — `<ScanShell>` (`src/ui/components/ScanShell.tsx`)

Componente de apresentação com o chrome compartilhado:

- Wrapper `.screen.scan-screen` (+ classe extra opcional, ex. `conferir-screen`), o `<p>` sr-only
  de `announce`, o `pagetab`.
- `.cam` com `.cam-top`: um slot à esquerda (`topLeft`) e o grupo de ações à direita.
- O grupo de ações à direita: a pílula **"Terminar"** opcional (`finishAction`) + `📝` (abrir
  entrada manual) + `🔄` (flip). `📝` e `🔄` são compartilhados; só aparecem quando
  `cameraState !== 'denied'`.
- `.mira-wrap`: `mira`/`reading`, camada de vídeo (`videoLayerRef`), o sweep `mira-scan`, os 4
  cantos, o label do slot, e o `hint` (texto `holdStillText` difere por tela).
- Os três `scan-overlay`: loading (spinner + `preparing`), `ocrFailed`, `denied` (+ retry).
- `.cam-bottom`: slot `bottom` (children) com o veredito + conteúdo específico da tela.
- A `manual-sheet` (compartilhada), com slot opcional `manualExtra` (o botão "Colar lista" do
  Escanear).

**Props (alto nível):** `pageTitle`, `pageSubtitle`, `announce`, `holdStillText`, `cameraState`,
`ocrReady`, `ocrFailed`, `ocrProgress`, `reading`, `facing`, `videoLayerRef`, `onFlip`, `onRetry`,
`manualOpen`/`setManualOpen`, `onManualSubmit`, e os slots `topLeft`, `finishAction`, `bottom`,
`manualExtra`. (A lista exata de props fica para o plano de implementação.)

### 3. Tela ao vivo do Conferir → escaneamento puro

`ConferirScreen` fica fino: renderiza `<ScanShell>` + `useScanner({ onMatches: handleMatch,
cameraSetting: 'conferirCamera', settings })`, mantém os chips de contador ("pra mim / pro amigo")
e o `ConferirVerdict` (no slot `bottom`). Os botões inline **"💾 Salvar" e "Mandar pro amigo" são
removidos**. A pílula **"Terminar"** (espelho do Escanear) aparece quando você já escaneou ≥1
figurinha. O botão `←` (voltar pra Banca) continua no slot `topLeft` junto dos contadores.

O estado acumulado da pilha **sobe para o `app.tsx`** (exatamente como o álbum sobe `session`).

### 4. Acumulador da pilha — `createPileSession` (`src/domain/pileSession.ts`)

Acumulador pequeno espelhando `domain/session.ts`:

- `add(entry, kind)` — registra uma leitura commitada (código + `HuntVerdict['kind']`), deduplicado.
- Expõe a **pilha inteira** (todo código resolvido, deduplicado — o que o QR viral compartilha) e
  o conjunto **take-mine** (as que você precisa = `takenForMe`).
- `finish() → PileReport` — produz `{ taken: ChecklistEntry[], wholePile: string[] }` para a tela
  de finalização.
- `reset()`.
- **Em memória** (sem `localStorage`). Testável em node como `session`/`routing`/`matching`.

> `takenForFriends` (você tem, mas um amigo precisa) é só contador advisory na tela ao vivo — não
> entra na revisão de finalização (pegadas pra amigo não vão pra _sua_ coleção). `savedTaken` (o
> que você efetivamente pegou, para excluir do compartilhamento) passa a ser populado **no passo de
> finalização**, quando você salva.

### 5. Tela de finalização do Conferir — `ConferirReportScreen` (`src/ui/screens/ConferirReportScreen.tsx`)

Simétrica à `ReportScreen`, fazendo as duas coisas:

- **"Pegou quais?"** — lista de revisão das figurinhas take-mine, checkboxes marcadas por padrão
  → "Salvar N na coleção" → `collection.setOwned(checked)`. É o modal de revisão de hoje promovido
  a tela. Preserva a regra cardinal (só marca como owned o que você fisicamente pegou). Salvar
  registra esses códigos como "pegos" (para o compartilhamento excluí-los).
- **"📤 Mandar a lista pro amigo"** → abre o `PileShareSheet` existente (pilha inteira, menos o que
  você pegou).
- **"Voltar"** → volta pra Banca (`trade`).
- Diferente da `ReportScreen`, **não navega sozinha** depois de salvar — salvar mostra sucesso
  inline, o compartilhar continua disponível, a saída é explícita.

Semântica do compartilhar preservada: usa `(wholePile, taken = savedTaken-até-agora)`. Se você
salva antes de compartilhar, as pegadas são excluídas das repetidas do amigo; se compartilha antes
de salvar, `savedTaken` está vazio (correto: você ainda não pegou nada → as dupes continuam dele).

### 6. Roteamento + fiação no `app.tsx`

- Nova tela efêmera no union `Screen`: **`conferir-report`**.
- Em `routing.ts`: adicionar `conferir-report: 'trocar'` no `SLUGS` (compartilha o slug da Banca,
  como `conferir`); **ausente** do mapa reverso `SCREENS`; mapeada para `trade` na derivação
  `active` do `Nav`. Mantém os invariantes (escritor único, `routing.ts` puro). Atualizar o teste
  `routing.test.ts` se necessário.
- `app.tsx` ganha o acumulador `pileSession` (`useMemo`, como `session`) + um estado `pileReport`
  (como `report`). O "Terminar" do Conferir constrói o `PileReport` e faz
  `setScreen('conferir-report')`; ao finalizar (Voltar), reseta o `pileSession` e volta pra `trade`.
- `ConferirScreen` passa a receber o `pileSession` (para acumular as leituras) e um `onFinish`
  (constrói o report + navega). A tela ao vivo continua read-only quanto à `collection` — só o
  passo de finalização escreve.

## Fluxo de dados (Conferir, depois)

```
ConferirScreen (ao vivo)
  useScanner({ onMatches: handleMatch })  → cada leitura commitada
  handleMatch → huntVerdict → ConferirVerdict + chips + pileSession.add(entry, kind)
  "Terminar" (≥1 escaneada) → app.finishConferir():
        pileReport = pileSession.finish()
        setScreen('conferir-report')
ConferirReportScreen (finalização)
  revisar take-mine → collection.setOwned(checked)  (+ registra savedTaken)
  "Mandar pro amigo" → PileShareSheet(wholePile, savedTaken)
  "Voltar" → pileSession.reset(); setScreen('trade')
```

## Tratamento de erros / casos de borda

- **OCR indisponível / câmera negada:** inalterado — os overlays moram no `<ScanShell>`,
  compartilhados pelas duas telas.
- **Terminar sem nada escaneado:** a pílula só aparece com ≥1 leitura, então `pileReport.taken`
  pode estar vazio (só leu figurinhas que você já tem) — a tela mostra a lista vazia e oferece só
  o compartilhar. Igual à `ReportScreen` com 0 keepers.
- **Double-tap em salvar:** guarda com flag `done` (como `ReportScreen.commit`).
- **Disciplina 0-FP:** intocada — vive 100% no `useScanner` agora (antes duplicada). O reset de
  `committedThisBurst` no `onBurstStart` continua load-bearing.

## Testes

- **`pileSession.test.ts`** (novo, node): `add` deduplicado, take-mine vs whole-pile, `finish()`,
  `reset()`.
- **`routing.test.ts`** (existente): cobrir `conferir-report` (slug compartilhado, ausente do
  reverso, Back volta pra Banca).
- **`ConferirReportScreen`**: teste de unidade do gate de revisão (espelhando o estilo de
  `ReportScreen.test.ts`), se aplicável ao seam sem câmera.
- O motor (`useScanner`) é code-motion puro; a cobertura é o pipeline existente + os benches.

## Verificação (gate da regra cardinal)

Comportamento preservado no caminho do álbum. Gate de toda a mudança em:

- `npm run build` (tsc `--noEmit` + vite — typecheck é parte do build),
- `npm test` (incluindo os testes novos),
- **`npm run bench:pixel`** — recall / FP por frame / FP de figurinha confirmada / latência (det+ocr)
  têm que **se manter** contra um baseline pré-mudança (rodar o baseline ANTES de refatorar).

`CHANGELOG.md` atualizado. Texto de usuário em pt-BR.

## Arquivos

**Novos:**
- `src/ui/hooks/useScanner.ts`
- `src/ui/components/ScanShell.tsx`
- `src/domain/pileSession.ts` (+ `pileSession.test.ts`)
- `src/ui/screens/ConferirReportScreen.tsx`

**Modificados:**
- `src/ui/screens/ScanScreen.tsx` (consome `useScanner` + `<ScanShell>`; instrumentação debug/record
  via flags; mantém session/counters/recent/MultiResult/Verdict/ImportSheet)
- `src/ui/screens/ConferirScreen.tsx` (vira fino; remove Salvar/Share inline; ganha "Terminar")
- `src/app.tsx` (acumulador `pileSession` + `pileReport` + fiação `conferir-report`)
- `src/ui/routing.ts` (+ `conferir-report`) e `src/ui/Nav.tsx` (derivação `active`)
- `src/types.ts` se precisar de tipos compartilhados (`PileReport`)
- `src/i18n/pt.ts` (textos da tela de finalização do Conferir)
- `CHANGELOG.md`
