# Plano — completar a tela "Trocar"

Status: revisado (1 rodada de revisão por subagente — ajustes incorporados)
Branch/worktree: `sharded-meandering-stonebraker` (off `main` 11f7347)

## Contexto

A tela `TradeScreen.tsx` já implementa o mockup (Screen 3 de `docs/mockups/banca-album-print.html`)
de forma fiel e funcional: ledger de repetidas com botão "Já troquei" (decisão travada: repetidas
booleanas, sem ×N), prévia + CTAs WhatsApp/Copiar, modo receptor (FriendMatch) e estado vazio. Testes
verdes. **Não relitigar** as decisões travadas (ver memória `trocar-screen-banca`).

Rodando ao vivo com dados semeados, dois pontos ficam "inacabados" (foco confirmado = **ambos**):

1. **Prévia despeja a URL crua gigante.** `previewText = shareTextFor(...).text` renderiza o link
   `?t=<base64 ~350 chars>` literal, que quebra em ~6 linhas e faz o cartão "Prévia da mensagem"
   parecer quebrado.
2. **"O que eu preciso" lista TODAS as faltantes** — num álbum meio cheio são **620 linhas / ~35.000px**,
   13 cabeçalhos de grupo. Decisão do usuário: **colapsar por grupo** (cada Grupo A..L / Especiais /
   Coca-Cola vira uma linha recolhida com contagem "faltam N"; tocar expande os códigos faltantes).

## Meta verificável

- Prévia mostra a mensagem real **menos** a URL crua, trocada por um marcador amigável; o texto
  enviado/copiado de verdade continua com o link (loop receptor intacto).
- "O que eu preciso" começa com todos os grupos **recolhidos**; cada linha mostra "faltam N" + seta;
  tocar expande/recolhe os códigos daquele grupo. Altura da seção cai de ~35.000px para ~620px (13
  linhas recolhidas).
- `npm run build` (tsc --noEmit + vite build) passa; `npm test` verde (testes novos: `previewTextFor`
  em share.test, `groupByAlbum` em TradeScreen.test).
- Verificado ao vivo (puppeteer headless, dados semeados) no estado de oferta.

---

## Mudança 1 — prévia esconde a URL crua

**`src/domain/share.ts`** — reaproveitar `buildShareMessage` passando um marcador no lugar do link
(zero duplicação; uma fonte de verdade). O texto enviado/copiado **não muda** (continua via
`shareTextFor`, com link real):

```ts
/** Marcador que substitui a URL longa só na PRÉVIA da tela. O texto realmente enviado/copiado
 *  (shareTextFor) continua com o link de verdade — o loop receptor depende dele. */
export const PREVIEW_LINK_PLACEHOLDER = '🔗 (o link da sua lista vai junto)';

/** Texto da prévia: a mensagem real, mas com a URL crua trocada pelo marcador. */
export function previewTextFor(payload: TradePayload, checklist: Checklist): string {
  return buildShareMessage(payload, PREVIEW_LINK_PLACEHOLDER, checklist);
}
```

**Decisão deliberada (revisão #7):** manter a linha `LINK_CTA` ("👉 Abre o link…👇") antes do marcador.
A prévia fica `…👇 / 🔗 (o link da sua lista vai junto)` — o CTA explica o link e o marcador diz ao
remetente que o link entra ali sozinho. É honesto quanto à estrutura do que será enviado. Conferir
na screenshot que lê bem.

**`src/ui/screens/TradeScreen.tsx`** — import **imperativo** (revisão #5): `shareTextFor` fica órfão na
tela (`share()`/`copy()` usam `onShare`/`copyTradeList`), e `noUnusedLocals` quebraria o build. Trocar:

```ts
// linha 7, antes:  import { shareTextFor, copyTradeList, type ShareTradesResult } from '../../domain/share';
import { previewTextFor, copyTradeList, type ShareTradesResult } from '../../domain/share';
```
e a fonte do texto:
```ts
// antes: const previewText = hasRepeats ? shareTextFor(myPayload, checklist).text : '';
const previewText = hasRepeats ? previewTextFor(myPayload, checklist) : '';
```

**Teste** (`src/domain/share.test.ts`): novo caso — `previewTextFor(payload)` contém
`PREVIEW_LINK_PLACEHOLDER` e o bloco "🔁 Tenho", mas **não** contém `?t=` nem `http`; enquanto
`shareTextFor(payload).text` (link real) **contém** `?t=`. (Verificado pelo revisor: nenhum nome de
time/CTA/i18n injeta `http`/`?t=` — só o link.)

---

## Mudança 2 — "O que eu preciso" colapsado por grupo

Tudo em **`src/ui/screens/TradeScreen.tsx`** salvo o CSS/i18n. `groupByAlbum` já devolve
`{ label, entries }[]` **só** com grupos que têm faltantes, em ordem de álbum, com times consecutivos
do mesmo rótulo mesclados (revisor confirmou em 336–352). **"faltam N" conta FIGURINHAS faltantes do
grupo** (um grupo de 4 times pode mostrar "faltam 80") — comportamento correto e desejado (revisão #4).

1. Estado, junto aos hooks do topo (antes dos early returns — revisor confirmou hooks 38–51 < return 85):
```ts
const [openGroups, setOpenGroups] = useState<Set<string>>(() => new Set());
const toggleGroup = (label: string) =>
  setOpenGroups((prev) => {
    const next = new Set(prev);
    if (next.has(label)) next.delete(label);
    else next.add(label);
    return next;
  });
```

2. **Exportar `groupByAlbum`** (hoje função privada) para teste, igual ao precedente `filterTeams`
   exportado de `CollectionScreen.tsx` (revisão #10): `export function groupByAlbum(...)`.

3. Render da seção "preciso" (substitui o `.map` atual que abria tudo). Entradas expandidas usam um
   container **dedicado `.need-row`** (NÃO `.lrow`) reaproveitando só os spans internos
   `.lcode/.lname/.ltag ltag-falta` — assim o modelo de divisória fica autocontido (revisão #1/#2):
```tsx
<SectionHead lead={pt.trade.needTitle} em={pt.trade.needEm} />
{needGroups.length === 0 ? (
  <p class="trade-line-empty">{pt.trade.needEmpty}</p>
) : (
  <div class="ledger need-list">
    {needGroups.map((group) => {
      const open = openGroups.has(group.label);
      return (
        <Fragment key={group.label}>
          <button
            type="button"
            class={`need-grp-row ${open ? 'is-open' : ''}`}
            onClick={() => toggleGroup(group.label)}
            aria-expanded={open}
          >
            <span class="ngname">{group.label}</span>
            <span class="ngcount">{pt.trade.groupFaltam(group.entries.length)}</span>
            <span class="ngcaret" aria-hidden="true">{open ? '▾' : '▸'}</span>
          </button>
          {open &&
            group.entries.map((e) => (
              <div class="need-row" key={e.code}>
                <span class="lcode">{e.display}</span>
                <span class="lname">{teamLabel(e)}</span>
                <span class="ltag ltag-falta">{pt.trade.faltaTag}</span>
              </div>
            ))}
        </Fragment>
      );
    })}
  </div>
)}
```
`.trade-grp` (1522) **continua** usada por `MatchGroups` (297) → manter a classe; só a seção "preciso"
deixa de usá-la (193). `Fragment` já importado. **a11y (revisão #4):** `aria-expanded` no botão;
sem `aria-controls` de propósito (evita wrapper que mexeria no `> :last-child`); seta `▾/▸` + tom de
fundo `.is-open` dão o cue (nunca só cor).

4. **`src/i18n/pt.ts`** — nova string no bloco `trade`:
```ts
groupFaltam: (n: number) => (n === 1 ? 'falta 1' : `faltam ${n}`),
```

5. **CSS** (`src/styles.css`, junto ao bloco trade ~1521). Modelo de divisória **totalmente
   especificado e autocontido** (revisão #1/#2): `.ledger` dá o card cream + `overflow:hidden` (ok,
   só recorta os cantos). Como `.need-row` é classe própria, NÃO herda `.lrow:last-child`. Borda em
   cada tipo de linha; o último filho do card zera a borda:
```css
/* "O que eu preciso": grupos recolhidos num card; tocar expande os códigos. */
.need-grp-row {
  display: flex; align-items: center; gap: 10px; width: 100%;
  padding: 12px 14px; min-height: 48px;
  background: transparent; border: 0;
  border-bottom: 1.5px dashed var(--kraft-deep);
  font: inherit; text-align: left; cursor: pointer;
}
.need-grp-row.is-open { background: var(--cream-dim); }
.ngname {
  font-family: var(--font-head); font-weight: 700; font-size: 1rem;
  text-transform: uppercase; letter-spacing: 0.02em; color: var(--ink);
}
.ngcount {
  margin-left: auto; font-family: var(--font-head); font-weight: 700;
  font-size: 0.8rem; letter-spacing: 0.04em; text-transform: uppercase; color: var(--keep);
}
.need-grp-row.is-open .ngcount { color: var(--kraft-text); }
.ngcaret { color: var(--kraft-deep); font-weight: 700; font-size: 0.9rem; }
/* linha de código expandida (container próprio p/ não herdar .lrow:last-child) */
.need-row {
  display: flex; align-items: center; gap: 12px;
  padding: 11px 14px;
  background: rgba(15, 60, 39, 0.04);              /* leve recuo sob o grupo aberto (= --paper-edge a 4%) */
  border-bottom: 1.5px dashed var(--kraft-deep);
}
.need-list > :last-child { border-bottom: 0; }     /* zera a divisória no fim do card (grupo recolhido OU linha) */
```
`.lcode/.lname/.ltag/.ltag-falta` já existem. Conferir AA legível do `.lname` (#46564b) sobre o
recuo `.need-row` (praticamente cream) — ok (mesmo par do ledger atual).

---

## Verificação

1. `npm run build` — typecheck + build limpos (atenção a imports órfãos: `shareTextFor` removido).
2. `npm test` — verde, incl. `previewTextFor` (share.test) e `groupByAlbum` (TradeScreen.test:
   só grupos não-vazios; mescla "Grupo A"; conta figurinhas).
3. Ao vivo (puppeteer headless, dados semeados): prévia limpa (sem URL, lê bem com o CTA); "preciso"
   recolhido (~13 linhas); expandir um grupo mostra os códigos com divisórias certas (sem sobra/sem
   falta); `scrollHeight` da seção cai drasticamente. Empty state e FriendMatch inalterados.
4. Atualizar `CHANGELOG.md` e a memória `trocar-screen-banca` (refina as 2 decisões).

## Fora de escopo (não relitigar)

Repetidas booleanas/sem ×N; ordem (prévia+ações antes do "preciso"); loop receptor; "Preciso" inline
(cap 24) na mensagem enviada; estilo Banca geral. Sem busca/resumo no "preciso" (usuário escolheu
colapsar por grupo). Sem `aria-controls`.
```
