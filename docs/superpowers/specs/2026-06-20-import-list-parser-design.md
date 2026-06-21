# Importar listas de outros apps — camada de parsing (design)

Data: 2026-06-20

## Problema

Existem vários apps concorrentes de figurinhas da Copa 2026 que também permitem compartilhar
listas no WhatsApp. Para facilitar a migração para o nosso app, queremos receber uma string com
uma lista de figurinhas (colada pelo usuário), entender o formato e extrair os códigos válidos.

Exemplo de texto de outro app:

```
🏆 *Copa 2026* — *❌ Faltam 277* — 717/994 (72%)

🌟 Introdução:
FWC3, FWC7, FWC8, FWC14

🇲🇽 México:
MEX2, MEX4, MEX11, MEX12, MEX13, MEX14, MEX18
...
🥤 Coca:
CC4, CC10

Bora trocar? 📲
```

## Escopo desta iteração

**Somente a lógica de parsing e a infraestrutura de carregamento.** Sem UI, sem mudanças em
`app.tsx`, sem fiação para os stores (`owned`/`repeats`/`wants`). A tela de carregamento e os
botões "Tenho"/"Preciso" vêm depois e consomem o contrato definido aqui.

Decisões já tomadas com o usuário:

- **Arquitetura enxuta + gancho plugável** (não a "registry completa" especulativa).
- **`ImportResult` mínimo**: só contagem + não-reconhecidos (sem breakdown por time agora).
- **Merge/união** quando a tela aplicar o resultado a um store (não substituição) — fica para
  a iteração da UI.
- Foco em parsing/infra; alvos dos botões e local na UI ficam para depois.

## Observações sobre os dados

- O nosso álbum tem **992** figurinhas (48 times × 20 + 20 especiais "FWC" + 12 "CC").
- O app de exemplo reporta **994** — uma pequena diferença de álbum. O parser valida todo token
  contra `checklist.byCode`, então códigos fora do nosso álbum são descartados; nós os
  **reportamos** em `unrecognized` para o usuário confiar no resultado.
- Os 48 times do exemplo coincidem 1:1 com os códigos do nosso álbum, então o exemplo completo
  resolve para **277 códigos reconhecidos, 0 não-reconhecidos**.

## Arquitetura

### 1. `src/domain/tradeList.ts` (refactor cirúrgico)

Já existe `parseTradeList(text, checklist): string[]`, robusto ao formato com emoji e a colagens
soltas (`MEX 3, 6, 10`, `CIV12`, `FWC 1`, `00`), validando contra a checklist. Hoje ele só
**descarta** o que não reconhece.

Extrair:

```ts
export function parseTradeListDetailed(
  text: string,
  checklist: Checklist,
): { codes: string[]; unrecognized: string[] };
```

- `codes`: códigos canônicos reconhecidos (dedup, ordem de álbum) — comportamento atual.
- `unrecognized`: tokens `${teamCode}${number}` cujo **time é conhecido mas o código não existe
  neste álbum** (ex.: `FWC20`, `MEX25`, `CC15`). Dedup, ordem de aparição. Tokens de times
  desconhecidos (ex.: `ABC5`) não são capturados — evita ruído de texto livre.

`parseTradeList` passa a ser `parseTradeListDetailed(...).codes` — API e testes atuais inalterados.

### 2. `src/domain/importList.ts` (novo) — camada de estratégias

```ts
export interface ImportResult {
  codes: string[];          // reconhecidos, dedup, ordem de álbum
  unrecognized: string[];   // time conhecido, fora do álbum
  strategy: string;         // nome da estratégia que parseou (debug/telemetria)
}

export interface ImportStrategy {
  name: string;
  detect(text: string): number;                       // confiança 0..1
  parse(text: string, checklist: Checklist): ImportResult;
}

export const commonStrategy: ImportStrategy;          // embrulha parseTradeListDetailed
export const defaultStrategies: ImportStrategy[];     // [commonStrategy]

export function parseImport(
  text: string,
  checklist: Checklist,
  strategies?: ImportStrategy[],                       // injetável p/ teste; default = defaultStrategies
): ImportResult;
```

- `commonStrategy.detect` retorna uma linha-base baixa (ex.: `0.1`) — é o fallback.
- `parseImport` escolhe a estratégia de maior `detect(text)`; empate/zero → `commonStrategy`.
- Adicionar suporte a um app específico no futuro = empurrar uma `ImportStrategy` no array.

## Testes (TDD — escritos antes)

`src/domain/importList.test.ts`:

1. `parseImport` no **exemplo completo** → `codes.length === 277`, `unrecognized === []`,
   `strategy === 'common'`, contém `MEX2`/`FWC3`/`CC4`/`ENG20`, em ordem de álbum (MEX antes de FRA).
2. Token fora do álbum (`FWC20`, `MEX25`, `CC15`) → aparece em `unrecognized`, nunca em `codes`.
3. Colagem solta (`MEX 3, 6, 10`, `CIV12`, `FWC 1`, `00`) → resolve normalmente.
4. Lixo/vazio → `{ codes: [], unrecognized: [], strategy: 'common' }`.
5. Registry: uma estratégia injetada com `detect` maior vence a `commonStrategy`.

Estender `src/domain/tradeList.test.ts`:

6. `parseTradeListDetailed` reporta `unrecognized` para times conhecidos fora do álbum e mantém
   `codes` idêntico a `parseTradeList`.

## Não-objetivos (próximas iterações)

- Tela de carregamento/preview com estatísticas.
- Botões "Tenho" (→ `owned`) / "Preciso" (→ `wants`) aplicando via união.
- Estratégias por app específico (só quando um formato real quebrar o parser comum).
