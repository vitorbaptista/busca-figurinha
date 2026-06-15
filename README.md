# Troca Figurinhas — Copa 2026

Scanner de figurinhas do álbum Panini da Copa do Mundo 2026, feito para facilitar as
trocas. Mostre o **verso** da figurinha para a câmera do celular e o app diz na hora se
você precisa **guardar** ou se é **repetida**.

Funciona 100% no aparelho (PWA): sem login, sem servidor, sem internet depois do primeiro
carregamento.

## Como funciona

1. Aponte a câmera do celular para o **verso** da figurinha (vire o aparelho para baixo).
2. O app lê o código impresso (ex.: `CIV 12`) por OCR e confere na sua coleção.
3. A tela pisca **verde — GUARDAR** (você precisa) ou **vermelho — REPETIDA** (você já tem).
4. A varredura é uma **sessão** só de leitura: nada é adicionado enquanto você escaneia.
5. No fim, um **relatório** lista as figurinhas que faltam com caixinhas de seleção —
   marque só as que você realmente trocou e elas entram na coleção.

## Recursos

- Leitura automática quando a figurinha fica parada na frente da câmera.
- Correção de erros de OCR (tolera 1 caractere errado no código).
- Feedback visual e sonoro imediato (verde/vermelho).
- Álbum completo embutido: 48 seleções × 20 + 20 especiais (`FWC`) = **980** figurinhas.
- Coleção, sessões e ajustes salvos localmente; backup por exportar/importar.
- Instalável como app (PWA) e funciona offline.

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
