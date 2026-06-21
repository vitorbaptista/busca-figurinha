# PWA: instalável e com cara de app (Android-first, iOS best-effort)

**Data:** 2026-06-20 · **Branch:** `feat/pwa-install-native-feel`
**Status:** revisado por subagente (correções incorporadas abaixo).

## Foco (pedido do usuário)

"A UI está ótima — foque no **fluxo de instalação**, não na UI." Este trabalho mexe **fora**
das telas do app: tornar o app **instalável** e dar a ele **identidade de app na tela inicial**
(ícone, nome, cor de abertura). Nenhuma tela interna muda de visual.

## Lacunas reais (verificadas no código + build)

1. **Sem `apple-touch-icon` PNG.** `index.html` só tem favicon SVG. iOS usa um *screenshot da
   página* no "Adicionar à Tela de Início". → adicionar PNG 180×180.
2. **`background_color` do manifest é quase-preto** (`#0f1115`) enquanto a primeira pintura do
   app é o verde `--paper-deep: #185438` (`styles.css:91`). → splash abre preto e pisca pro
   verde. **Corrigir para `#185438`** (NÃO `#0b7d3b`, que é o `--keep`/theme e não pinta no load).
3. **Sem fluxo de instalação.** Nada captura `beforeinstallprompt` (Android). iOS não tem esse
   evento → precisa de instruções "Compartilhar → Adicionar à Tela de Início".
4. **Manifest enxuto:** sem `id`, `scope`, `start_url` explícito, `categories`, `shortcuts`.

> **NÃO são lacunas (verificado pelo revisor — não mexer):**
> - `theme_color` JÁ está alinhado (`index.html:9` e manifest, ambos `#0b7d3b`). No-op.
> - Ícone **maskable**: a arte do `icon.svg` já fica dentro da zona de segurança (canto mais
>   distante ~195px vs raio seguro ~205px). O arquivo ser byte-idêntico ao comum é cosmético,
>   não corta no launcher. **Deixar como está** — padding "por segurança" só encolheria o ícone.

## Escopo (MUST)

### A. Identidade na tela inicial
- `apple-touch-icon` 180×180 PNG no `index.html` (href **relativo**).
- `apple-mobile-web-app-title` = **"Figurinhas"**.
- `background_color` do manifest → **`#185438`** (transição splash→app contínua).

### B. Fluxo de instalação (o foco)
- **`src/ui/pwaInstall.ts`** — helpers PUROS, testáveis em node (padrão `routing.ts`):
  - `detectPlatform(ua)` → `'android' | 'ios-safari' | 'ios-other' | 'other'`
    (distinguir iOS-Safari, que instala via share, de iOS-Chrome/webview, que **não** consegue —
    não mostrar instruções impossíveis).
  - `isStandalone(displayModeMatches, navigatorStandalone)` → `boolean` (qualquer sinal true).
  - `installInvite({ platform, isStandalone, canPrompt })` → `'prompt' | 'ios-steps' | 'none'`
    (capability só — o gating de auto-show, incl. "dismissed", fica na camada de UI).
- **`src/ui/usePwaInstall.ts`** — hook que liga ao browser. Contrato obrigatório:
  - `beforeinstallprompt`: `e.preventDefault()` + guardar o evento; expor `canPrompt`.
  - `promptInstall()`: usa o evento **uma vez só** (chamar 2× lança); depois zera + `canPrompt=false`.
  - ouvir `appinstalled` → marca instalado e fecha a folha.
  - degradar quando o evento **nunca dispara** (já instalado / navegador sem suporte): sem botão,
    nunca uma folha quebrada/vazia.
  - `isStandalone` = `matchMedia('(display-mode: standalone)').matches || navigator.standalone`
    (o segundo é iOS, sem tipo em TS → cast local).
- **`src/ui/InstallPrompt.tsx`** — folha inferior **enxuta**, dispensável:
  - Android: botão "Instalar app" → prompt nativo.
  - iOS-Safari: passos "toque em Compartilhar ⬆️ → Adicionar à Tela de Início".
  - Oculta se standalone, dispensada, ou `installInvite === 'none'`.
- **Ajustes:** linha "Instalar app / Como instalar" que reabre o fluxo (sempre acessível).
- **Disparo automático:** gate `onboarded && !installDismissed && !isStandalone && invite!=='none'`,
  numa volta ociosa (não empilhado no fim do onboarding). Dispensar grava `installDismissed`.

### C. Manifest "app de loja"
- `id`: string fixa **`'/busca-figurinha/'`** (o VitePWA NÃO reescreve `id`; sem ele o id deriva
  do `start_url` e uma mudança futura órfã a instalação).
- `scope` + `start_url` = `'.'` (relativos; resolvem contra a URL do manifest, que fica sob a
  base → `/busca-figurinha/` em CI, `/` em dev), `categories`.
- `shortcuts`: **"Escanear"** (`./#escanear`) e **"Trocar"** (`./#trocar`) — URLs em hash, lidos
  no cold start por `screenFromHash` (`app.tsx:92`, só LEITURA — não viola o single-writer da URL).
  Cada atalho com **ícone próprio** 96×96 (senão o launcher mostra glifo genérico) — gerar 2
  glifos simples (lupa / setas-troca) no `gen-icons.mjs`.

### Estado novo
- `Settings.installDismissed?: boolean` (`types.ts` + default em `settings.ts`).

## Não-objetivos / CUT
- **iOS `apple-touch-startup-image` (splash matrix) — CORTADO.** Pior custo/cobertura: exige
  matriz exata por device com media-queries (sem fallback gracioso), apodrece a cada device novo
  e infla o precache do SW em vários MB (contra "celular fraco / offline"). White-flash já é
  mitigado pelo `background_color` correto. Eventual follow-up.
- Wrapper nativo Android (`android/`), push, background sync.
- `screenshots` no manifest e toast de "nova versão" — adiados (mantém `autoUpdate`).
- Qualquer mudança no visual interno das telas.

## Arquivos tocados
- `index.html` — apple-touch-icon, apple-mobile-web-app-title.
- `vite.config.ts` (manifest) — `background_color`, `id`, `scope`, `start_url`, `categories`,
  `shortcuts`, entradas de ícone dos atalhos.
- `scripts/gen-icons.mjs` — apple-touch-icon 180 + 2 ícones de atalho 96×96.
- `public/icons/` — PNGs gerados (commitados).
- `src/ui/pwaInstall.ts` (puro) + `src/ui/pwaInstall.test.ts`.
- `src/ui/usePwaInstall.ts` (hook).
- `src/ui/InstallPrompt.tsx` + estilos enxutos em `src/styles.css`.
- `src/ui/screens/SettingsScreen.tsx` — linha de instalar.
- `src/state/settings.ts` + `src/types.ts` — `installDismissed`.
- `src/i18n/pt.ts` — strings pt-BR.
- `src/app.tsx` — montar `InstallPrompt`.
- `CHANGELOG.md`.

## Testes (node, sem DOM)
- `pwaInstall.test.ts`: `detectPlatform` (iOS-Safari / iOS-Chrome / Android / desktop),
  `isStandalone` (tabela-verdade), `installInvite` (máquina de estado).
- `settings.test.ts`: default + persistência de `installDismissed`.
- NÃO testar: wiring de `beforeinstallprompt`/`appinstalled`/`prompt()` (só no browser).
- Gate cardinal intacto (nada toca `src/ocr/` ou `src/domain/`): 0 FP por construção.

## Sequência (ordem recomendada pelo revisor)
1. `background_color = #185438` (1 linha, o flash que mais "parece site").
2. `apple-touch-icon` 180 + `apple-mobile-web-app-title` (href relativo — Vite emite verbatim;
   `/` inicial QUEBRA sob `/busca-figurinha/`).
3. Manifest `id`/`scope`/`start_url`/`categories`/`shortcuts` (+ ícones dos atalhos).
4. `pwaInstall.ts` (+ testes) → `usePwaInstall.ts` → `InstallPrompt.tsx` → linha em Ajustes →
   flag `installDismissed`.

## Gate
`npm test` verde, `npm run build` (tsc) verde, manifest/HTML referenciam só arquivos existentes
no `dist/`, ícones gerados e commitados. PR → CI verde → squash merge.

## Notas de base/caminho (load-bearing, verificado)
- `<link href>` custom é emitido **verbatim**: relativo funciona sob `/busca-figurinha/`, `/`
  inicial quebra.
- VitePWA emite `start_url`/`scope`/`src` de ícone **relativos** (resolvem contra a URL do
  manifest, sob a base) e `id` **verbatim** (sem base pra resolver) — por isso `id` é fixo.
- PNGs novos entram no precache do SW (glob `**/*.png`) — por isso a splash matrix foi cortada;
  apple-touch-icon (1 PNG pequeno) + 2 ícones de atalho são baratos.
