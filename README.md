# Troca Figurinhas — Copa 2026

Scanner de figurinhas do álbum Panini da Copa do Mundo 2026, feito para facilitar as
trocas. Mostre o **verso** da figurinha para a câmera do celular e o app diz na hora se
você precisa **guardar** ou se é **repetida**.

Funciona 100% no aparelho (PWA): sem login, sem servidor, sem internet depois do primeiro
carregamento.

## Como funciona

1. Aponte a câmera do celular para o **verso** da figurinha (vire o aparelho para baixo),
   com boa luz. Pode mostrar **várias figurinhas de uma vez**.
2. O app **localiza a caixinha do código** no verso, recorta só ela e lê por OCR — bem
   mais rápido e preciso do que tentar ler a foto inteira.
3. A tela pisca **verde — GUARDAR** (você precisa) ou **vermelho — REPETIDA** (você já tem).
   Com várias figurinhas, mostra a lista de todas.
4. A varredura é uma **sessão** só de leitura: nada é adicionado enquanto você escaneia.
5. No fim, um **relatório** lista as figurinhas que faltam com caixinhas de seleção —
   marque só as que você realmente trocou e elas entram na coleção.

## Recursos

- Leitura por **detecção da caixinha do código** (não OCR da foto toda): localiza o selo
  escuro com o código, recorta, normaliza e lê só esse pedacinho.
- Lê **várias figurinhas** no mesmo quadro e tolera orientações giradas (0/90/180/270°).
- Correção de OCR **conservadora**: só corrige quando há um único código próximo possível;
  na dúvida não chuta (melhor errar por falta do que dar uma resposta errada numa troca).
- Feedback visual imediato (verde/vermelho) e som opcional.
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
3. Recorta cada selo, normaliza a polaridade (texto claro → preto no branco) e **limpa a
   moldura** ao redor, transformando texto comum (rodapé, logos) em branco — um filtro grátis
   de falsos positivos.
4. Empilha todos os recortes numa imagem só e roda o Tesseract **uma vez** (rápido), com o
   dicionário desligado (códigos não são palavras).

**Limitações conhecidas / próximos passos:**

- O Tesseract às vezes funde o **`I` fino** de `CIV` e lê `CV12` → não casa (some, não erra).
  Um classificador próprio para a fonte fixa do Panini resolveria (ver `references/` dos
  subagentes de estratégia no histórico).
- Cenas muito inclinadas/escuras com várias figurinhas pequenas têm recall parcial.
- Há **voto temporal** (confirmar em 2 quadros) como melhoria natural para a câmera ao vivo.

Para iterar no OCR sem o celular: abra `/?debug` (mostra leitura crua e toque-para-capturar)
ou a página `/ocr-test.html` (roda o pipeline em imagens de `public/samples/`). São ferramentas
só de desenvolvimento — não vão para o build de produção.

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
