# Plano — Trocar: agrupar "Minhas repetidas" e expandir "O que eu preciso"

## Objetivo (pedido do usuário)

Na tela **Trocar** (`TradeScreen`), as duas listas de figurinhas devem ficar **praticamente
iguais**:

1. **"Minhas repetidas"** passa a ser **agrupada por grupo do álbum** (Grupo A, B, …, depois
   seções especiais), exatamente como "O que eu preciso". Mostrar só os grupos/seleções que o
   usuário **tem**.
2. **"O que eu preciso"** mantém o visual atual (que o usuário considera "quase perfeito"), mas
   **remove o expandir/recolher** — os grupos ficam **sempre expandidos**. Some o caret e o
   comportamento de toque.

Resultado: as duas seções renderizam pela **mesma** UI agrupada e expandida.

## Estado atual (verificado em `60a3509`, origin/main)

- `src/ui/screens/TradeScreen.tsx`
  - **Minhas repetidas** (≈l.194-208): `<div class="ledger">` plano com `splitByTeam(myRepeatEntries)` →
    `TeamTally tone="have"`. **Não é agrupado por grupo do álbum.**
  - **O que eu preciso** (≈l.219-250): `<div class="ledger need-list">` com, por grupo,
    um `<button class="need-grp-row">` colapsável (`ngname` + `ngcount` "faltam N" + `ngcaret` ▸/▾)
    e, quando aberto, `<div class="need-open">` com `TeamTally tone="need"`.
  - Estado de colapso: `openGroups` / `toggleGroup` (≈l.50-59). Inicia tudo recolhido.
  - `needGroups = groupByAlbum(missingCodes)`.
- `src/styles.css`: `.need-grp-row`, `.need-grp-row.is-open`, `.ngname`, `.ngcount`,
  `.need-grp-row.is-open .ngcount`, `.ngcaret`, `.need-open`, `.need-list > :last-child`
  (≈l.1894-1945).
- `src/i18n/pt.ts` `trade`: já tem `groupFaltam(n)`, `albumGroup(g)`, `repeatsBadge(n)`.
- Helpers já existentes e reaproveitados: `groupByAlbum(codes)` (retorna `{label, entries}` em
  ordem de álbum, só grupos com entradas), `splitByTeam(entries)`, `TeamTally`.
- `FriendMatch` usa outro padrão (`MatchGroups` + `.trade-grp`). **Fora do escopo — não mexer.**

## Decisões de design (comprometidas)

- **Um componente compartilhado** `GroupedLedger({ codes, tone })` renderiza as duas seções. Ele já
  internaliza `groupByAlbum` + `splitByTeam` + `TeamTally`, então as duas listas ficam idênticas por
  construção (não podem divergir).
- **Sempre expandido**: sem botão, sem caret, sem `openGroups`. O cabeçalho de grupo vira um
  `<div class="grp-head">` estático (não interativo).
- **Cabeçalho de grupo** mantém o que o usuário gosta em "O que eu preciso": nome do grupo (Oswald,
  caixa-alta, ink) + contagem por grupo, dentro do mesmo cartão cream `.ledger`.
  - tone `need` → "faltam N" em verde (`--keep`) — **preserva** o tratamento atual.
  - tone `have` → "tenho N" em kraft neutro (`--kraft-text`). Verde é reservado para "preciso/
    guardar" no sistema de cores; repetidas (spares) não usam verde. Estrutura idêntica, cor
    semântica — continuam "praticamente iguais".
- **Divisórias**: cada grupo embrulhado em `.grp`; `.grp-head` com fundo `--cream-dim` e borda
  inferior tracejada (separa cabeçalho das tallies); grupos seguintes abrem com uma régua sólida
  ink no topo (`.grp:not(:first-child) .grp-head`), como uma linha de ticket impresso. As tallies
  internas reaproveitam `.tally` (tracejado) e `.tally:last-child{border:0}` por grupo.
- **Ordem da página inalterada**: repetidas → preciso → prévia → ações. Sem colapso a lista de
  "preciso" pode ficar longa (até ~todos os faltantes); é o pedido explícito do usuário. As ações
  de compartilhar ficam abaixo das listas (aceito).
- **A11y**: remover o botão não é regressão (conteúdo apenas exibido). Mantém spans (mesmo padrão
  dos cabeçalhos `SectionHead`/`tally-team` atuais; não introduzir headings semânticos só aqui —
  seria inconsistente e fora do escopo).

## Mudanças

### 1. `src/ui/screens/TradeScreen.tsx`
- **Remover** `openGroups`, `toggleGroup` e o comentário associado.
- **Adicionar** componente `GroupedLedger`:
  ```tsx
  function GroupedLedger({ codes, tone }: { codes: Iterable<string>; tone: TallyTone }) {
    return (
      <div class="ledger grouped-ledger">
        {groupByAlbum(codes).map((group) => (
          <div class="grp" key={group.label}>
            <div class="grp-head">
              <span class="grp-name">{group.label}</span>
              <span class={`grp-count grp-count-${tone}`}>
                {tone === 'need'
                  ? pt.trade.groupFaltam(group.entries.length)
                  : pt.trade.groupTenho(group.entries.length)}
              </span>
            </div>
            {splitByTeam(group.entries).map((team) => (
              <TeamTally key={team[0].teamCode} entries={team} tone={tone} />
            ))}
          </div>
        ))}
      </div>
    );
  }
  ```
- **Minhas repetidas**: trocar o `<div class="ledger">` plano por
  `<GroupedLedger codes={myRepeatCodes} tone="have" />` (mantém o ramo CTA quando `!hasRepeats`).
- **O que eu preciso**: trocar todo o bloco `need-list`/`need-grp-row`/`need-open` por
  `<GroupedLedger codes={missingCodes} tone="need" />`. Trocar a checagem `needGroups.length === 0`
  por `missingCodes.length === 0` e **remover** a variável `needGroups` (equivalente: sem faltantes
  ⟺ sem grupos).
- Atualizar o comentário "Mockup order…" (não há mais colapso).
- `Fragment` continua importado (ainda usado por `MatchGroups`).

### 2. `src/styles.css`
- **Remover**: `.need-grp-row`, `.need-grp-row.is-open`, `.ngname`, `.ngcount`,
  `.need-grp-row.is-open .ngcount`, `.ngcaret`, `.need-open`, `.need-list > :last-child`.
- **Adicionar** (mesmo lugar, comentário atualizado): `.grp`, `.grp-head`,
  `.grp:not(:first-child) .grp-head` (régua), `.grp-name`, `.grp-count`, `.grp-count-need`
  (verde `--keep`), `.grp-count-have` (kraft `--kraft-text`), e `.grp .tally:last-child{border:0}`.
- Manter `.trade-grp` (FriendMatch) e `.ledger`/`.tally*` intactos.

### 3. `src/i18n/pt.ts`
- Adicionar em `trade`: `groupTenho: (n) => (n === 1 ? 'tenho 1' : `tenho ${n}`)`, ao lado de
  `groupFaltam`. (pt-BR — texto de interface.)

### 4. `CHANGELOG.md`
- Entrada pt-BR: "Trocar: 'Minhas repetidas' agrupada por grupo do álbum, igual a 'O que eu
  preciso'; grupos sempre expandidos (removido o expandir/recolher)."

## Verificação
- `npm run build` (tsc estrito: `noUnusedLocals/Parameters` — confirmar que nada ficou órfão) e
  `npm test` (o teste de `groupByAlbum` continua passando; lógica de agrupamento inalterada).
- **Browser ao vivo** (mandato impeccable): `npm run dev`, abrir Trocar com coleção parcial +
  repetidas; screenshot das duas seções agrupadas e expandidas; conferir a 320px (sem overflow do
  nome do grupo + contagem), contraste do "tenho N"/"faltam N", e divisórias entre grupos.

## Riscos / não-objetivos
- Página de "preciso" mais longa (sem colapso) — **pedido explícito**, aceito.
- Não tocar `FriendMatch`/`MatchGroups`/`.trade-grp` (escopo cirúrgico).
- Sem novo teste de render (sem harness de DOM no projeto; cobertura via build + `groupByAlbum` +
  verificação visual).
