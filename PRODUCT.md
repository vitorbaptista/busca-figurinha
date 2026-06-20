# Product

## Register

product

## Users

Crianças, adolescentes e pais brasileiros que colecionam o álbum Panini da Copa do
Mundo 2026 e fazem **trocas** — muitas vezes no pátio da escola, na rua ou numa banca,
com o celular na mão e pressa. O parque de aparelhos inclui muitos celulares de entrada
(Android baratos, telas pequenas a partir de 320px, câmeras fracas), frequentemente sem
internet boa no momento da troca.

O trabalho a ser feito é brutalmente simples: **"esta figurinha eu guardo ou é
repetida?"** O usuário mostra o verso da figurinha para a câmera e precisa da resposta
**na hora**, sem login, sem digitar, sem ler manual. Decisão certa = troca justa;
decisão errada = troca ruim com um amigo.

## Product Purpose

Um PWA 100% on-device que lê o **código no verso** das figurinhas pela câmera e responde
instantaneamente **GUARDAR** (precisa) ou **REPETIDA** (já tem). Existe porque conferir
figurinha por figurinha contra uma lista é lento e chato, e os apps existentes ou são
pesados/cheios de cadastro ou cobram. Sucesso é: o usuário aponta a câmera, a figurinha
para quietinha, e a tela já piscou a resposta — sem tocar em nada — rápido o bastante
para varrer um maço inteiro numa sessão. A coleção, as sessões e os ajustes vivem só no
aparelho; funciona offline depois do primeiro carregamento.

## Brand Personality

**Rápido, confiante, descomplicado.** Três palavras: **ágil, claro, esperto.**

A referência do usuário é o [Scanini](https://scanini.app/) — um tracker de figurinhas da
Copa moderno e enxuto. O alvo é essa pegada: um utilitário de consumo bem-feito, com a
energia de jogo/futebol (veredito grande, flash de cor, vibração que parece um apito de
placar) mas executada com **contenção e polimento**, não com escândalo. A resposta é o
herói da tela — tudo serve a ela. Tom de voz em pt-BR coloquial e direto, como um amigo
que entende de figurinha ("GUARDAR", "REPETIDA", "Faltam 12 do Brasil"), nunca corporativo
nem infantilizado.

## Anti-references

- **SaaS corporativo / app empresarial.** Sem dashboards, navy-e-cinza, painéis densos de
  configuração, frieza de ferramenta de trabalho.
- **Hype de cassino / loot-box.** Mesmo sendo um app de "colecionar", nada de luzes
  piscando estilo cassino, chuva de moedas ou animações de recompensa agressivas. A
  emoção vem da utilidade (acertou a troca), não de manipulação.
- **Joguinho de criança poluído.** Sem gradientes arco-íris berrantes, excesso de cartoon,
  caos de anúncio de jogo mobile. Lúdico, não infantiloide.
- **App nativo pesado e lento.** Nada de splash screen demorada, travamento ou peso. Tem
  que parecer **instantâneo** mesmo num celular fraco — latência percebida é parte do
  design, não detalhe técnico.

## Design Principles

1. **A resposta é o produto.** Cada tela existe para entregar GUARDAR/REPETIDA mais rápido
   e mais claro. Hierarquia, cor e movimento servem ao veredito; nada compete com ele.
2. **Mãos livres por padrão.** O fluxo ideal não tem toques. A UI guia (mira, "pare
   quietinho") em vez de pedir ação. Cada toque exigido é uma falha de design a justificar.
3. **Instantâneo é uma feature.** Latência percebida importa tanto quanto a real. Feedback
   imediato (flash, vibração) e zero esperas visíveis num celular de entrada são requisito,
   não enfeite.
4. **Nunca chute com confiança.** Errar por falta é aceitável; uma resposta errada custa
   uma troca real. O design da UI reflete isso — "não li" é um estado de primeira classe,
   honesto, nunca disfarçado de acerto.
5. **Pesa pouco, funciona em qualquer mão.** 320px, offline, câmera ruim, luz ruim, dedo
   pequeno — o caso difícil é o caso comum. Simplicidade e desempenho acima de ornamento.

## Accessibility & Inclusion

Alvo prático **WCAG 2.1 AA**. Já presentes e a manter: contraste forte no tema escuro,
foco visível por teclado (`:focus-visible`), `prefers-reduced-motion` respeitado (flashes
e "respiração" da mira viram transição instantânea), alvos de toque ≥ 44–48px, e
**informação nunca só por cor** — o veredito sempre traz texto (GUARDAR/REPETIDA) e o
estado de "tenho" nas fichas traz um ✓ além do verde. Anúncio por leitor de tela
(`aria-live`/`.sr-only`) para o resultado de cada leitura, já que o fluxo é hands-free.
Considerar daltonismo (verde/vermelho nunca como único sinal) e legibilidade ao sol num
pátio (tamanho e peso generosos). Todo texto de interface em **pt-BR**.
