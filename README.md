# Troca Figurinhas — Copa 2026

Scanner de figurinhas do álbum Panini da Copa do Mundo 2026, feito para facilitar as
trocas. Mostre o **verso** da figurinha para a câmera do celular e o app diz na hora se
você precisa **guardar** ou se é **repetida**.

Funciona 100% no aparelho (PWA): sem login, sem servidor, sem internet depois do primeiro
carregamento.

## Como funciona

1. Deixe o celular **na mesa, de tela pra cima**, e mostre o **verso** da figurinha para a
   **câmera da frente** — você olha o lado da imagem enquanto a câmera lê o codiguinho. (Dá
   pra trocar para a câmera de trás no botão 🔄.) Pode mostrar **várias de uma vez**.
2. A leitura é **contínua e sem toques**: assim que a figurinha para quietinha, o app lê
   sozinho. Ele **localiza a caixinha do código**, recorta só ela e lê por OCR — bem mais
   rápido e preciso do que ler a foto inteira.
3. A tela pisca **verde — GUARDAR** (você precisa) ou **vermelho — REPETIDA** (você já tem),
   com um **toque de vibração**. Com várias figurinhas, mostra a lista de todas. Repetir a
   mesma figurinha na sessão não conta de novo.
4. A varredura é uma **sessão** só de leitura: nada é adicionado enquanto você escaneia.
5. No fim, um **relatório** lista as figurinhas que faltam com caixinhas de seleção —
   marque só as que você realmente trocou e elas entram na coleção.

## Recursos

- Leitura **contínua e sem as mãos**: mostra a figurinha, ela para, e o app lê na hora.
- **Câmera frontal por padrão** (celular deitado na mesa), com botão para a câmera traseira.
- Leitura por **detecção da caixinha do código** (não OCR da foto toda): localiza o selo
  escuro com o código, recorta, normaliza e lê só esse pedacinho.
- Lê **várias figurinhas** no mesmo quadro e tolera orientações giradas (0/90/180/270°).
- **Confirmação por vários quadros**: só conta um código depois que ele aparece igual em mais
  de um quadro — um borrão que troca um número por outro válido não passa.
- Correção de OCR **conservadora**: só corrige quando há um único código próximo possível;
  na dúvida não chuta (melhor errar por falta do que dar uma resposta errada numa troca).
- Feedback imediato: pisca verde/vermelho, vibra e (opcional) bipa.
- Álbum completo embutido: 48 seleções × 20 + 20 especiais (`FWC`) = **980** figurinhas.
- Coleção, sessões e ajustes salvos localmente; backup por exportar/importar.
- Instalável como app (PWA) e funciona offline.

## Como o OCR funciona (e suas limitações)

O verso Panini é padronizado: um **selo escuro arredondado** no canto com o código em letras
claras (ex.: `CIV 12`). Em vez de rodar OCR no quadro inteiro (lento e cheio de ruído), o app
(`src/ocr/locate.ts`):

1. Reduz o quadro e faz um **limiar adaptativo local** para achar regiões mais escuras que a
   vizinhança (o selo se destaca, mesmo com fundo claro e luz irregular).
2. Acha componentes conexos e filtra pela **forma** (selo: comprido ~3:1, sólido, do tamanho
   certo) — não pela cor, já que selo e cartela têm brilho parecido.
3. Recorta cada selo (em pé e girado 180°), normaliza a polaridade (texto claro → preto no
   branco) e **limpa a moldura** ao redor. Um **filtro de densidade** apaga recortes cheios de
   tinta (foto ou letra miúda do rodapé) para o OCR não travar neles — um quadro com várias
   figurinhas caiu de ~12s para ~0,9s no Pixel por causa disso.
4. Roda o Tesseract em **cada recorte separadamente** (em paralelo, num pool de workers).
   Juntar tudo numa imagem só confunde a análise de layout e some com letras finas.

A leitura crua passa por um casamento **conservador** contra os 980 códigos. O ponto sutil: a
fonte do Panini tem um **`I` bem fino** que o Tesseract derruba (`CIV 12` vira `CV 12`). Como o
motor só derruba traços finos — nunca uma letra "cheia" como `P` —, um código que veio com uma
letra **a menos** só pode ter perdido uma fina; então `CV12` volta com segurança para `CIV12`,
enquanto `CV12 → CPV12` (precisaria inventar um `P`) continua recusado. E a **confirmação em
vários quadros** garante que um deslize de um quadro só não vira resultado.

Para iterar no OCR sem o celular: abra `/?debug` (mostra a leitura crua e toque-para-capturar)
ou a página `/ocr-test.html` (roda o pipeline nas imagens de `dev-fixtures/`). São ferramentas
só de desenvolvimento — não entram no build de produção.

## Começando

```bash
npm install
npm run dev      # servidor de desenvolvimento
npm run build    # build de produção (checa tipos + gera dist/)
npm test         # testes (vitest)
```

Os ícones PNG são gerados a partir de `public/icons/icon.svg`:

```bash
npm i -D sharp
node scripts/gen-icons.mjs
```

## Deploy (GitHub Pages)

O deploy é automático: todo push na branch `main` dispara o workflow
`.github/workflows/deploy.yml`, que faz o build e publica em GitHub Pages.

Antes do primeiro deploy:

1. Confira o **base path** em `vite.config.ts` — em CI ele usa `/figurinhas-app/`
   (ativado pela env `GH_PAGES=1`). Ajuste se o nome do repositório for outro.
2. No GitHub, vá em **Settings → Pages** e selecione **Source: GitHub Actions**.

Para rodar o deploy manualmente, use **Actions → Deploy to GitHub Pages → Run workflow**.

## Tech stack

- [Preact](https://preactjs.com/) + TypeScript
- [Vite](https://vitejs.dev/) + [vite-plugin-pwa](https://vite-pwa-org.netlify.app/)
- [tesseract.js](https://tesseract.projectnaptha.com/) para o OCR no navegador
- [idb-keyval](https://github.com/jakearchibald/idb-keyval) para armazenamento local

## Privacidade

Tudo fica no aparelho. As imagens da câmera são processadas localmente e nunca saem do
celular; a coleção é gravada só no próprio dispositivo. Nenhum dado é enviado para
servidores.
