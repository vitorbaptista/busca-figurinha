# Design

The visual system for **Troca Figurinhas — Copa 2026**. Style name: **Banca — Álbum
de Papel**. Pairs with `PRODUCT.md` (strategy) and is implemented in
`src/styles.css`. This is internal design documentation; example UI strings stay in
pt-BR because all user-facing text is pt-BR.

## Concept

The digital twin of the physical Panini album the kid already holds. A saturated
album-green page with a halftone print texture; cream "slot" cards with ink borders
and hard offset shadows (ink on paper, like a printed ticket); kraft + gold-foil
accents; condensed newsstand (banca) display type. Familiarity with the physical
object erases the learning curve. The verdict (GUARDAR / REPETIDA / NÃO LI) is always
the hero. Information is encoded by **shape + icon**, never by colour alone.

## Theme

Single theme (no dark/light toggle): the surface IS the album, so it's committed
album-green, not a neutral. Colour strategy: **committed** — one saturated colour
(album green) carries the surface; cream/kraft/gold and the outcome colours play
supporting roles. Mood: a sunny schoolyard trade — fast, confident, tactile, a little
nostalgic; never corporate, never casino-hype, never a cluttered kids-game.

## Color

OKLCH-minded but authored as hex tokens in `:root` (`src/styles.css`).

| Token | Value | Role |
|-------|-------|------|
| `--paper` | `#1f6b46` | Album-green surface (top bars, headers) |
| `--paper-deep` | `#185438` | Body background (under halftone) |
| `--paper-edge` | `#0f3c27` | Hard offset-shadow ink |
| `--cream` | `#f4ecd8` | Card / slot surface (warm, not near-white) |
| `--cream-dim` | `#e4d8bc` | Insets, muted rows |
| `--ink` | `#16241c` | Borders + primary text on cream |
| `--kraft` / `--kraft-deep` | `#d8b88a` / `#c39b66` | Manila accents, dashed slot borders |
| `--kraft-text` | `#6c4e23` | Kraft-toned text on cream (meets AA) |
| `--gold` / `--gold-deep` | `#f0c64b` / `#caa033` | Foil accent: active nav, counts, finish CTA |
| `--keep` / `--keep-bright` | `#0a7a3e` / `#2bd06f` | GUARDAR (needed) |
| `--dupe` | `#b23a1e` | REPETIDA (owned) |
| `--miss` | `#cdbb95` | NÃO LI (unknown) — neutral kraft, never green/red |

**Contrast rules.** Body text is `--ink` on `--cream` (high contrast). Kraft-toned
secondary text uses `--kraft-text` (not `--kraft-deep`) on cream to clear WCAG AA.
The scan reticle area is deliberately **white** (`#fff`), not paper — see Components.

**Never colour alone.** Owned chips carry a ✓ and a solid fill vs. dashed empty
slots; the NÃO LI verdict is neutral (not red) and carries a "?"/🤔 + text.

## Typography

Three roles; display faces self-hosted (latin subset, `src/fonts/`) so the PWA stays
offline and light (~40 KB total).

- **Display — `Anton`** (`--font-display`): big verdicts, big numbers (`412 / 980`,
  counters), screen titles, group headers. Uppercase, tight, with a `--paper-edge`
  offset text-shadow on the verdict for the printed-poster punch.
- **Headings / labels / buttons / code chips — `Oswald`** (`--font-head`): condensed,
  the banca voice. Section labels are uppercase with letter-spacing.
- **Body — system sans** (`--font`): fast, legible, no webfont cost for long copy.

Pairing is on a contrast axis (one display + one humanist-condensed + system body),
not two similar sans. Hero verdict word clamps well under 6rem; display
letter-spacing stays ≥ 0 (Anton is already tight).

## Components

- **Buttons** (`.btn`): cream with 2px `--ink` border + 4px hard offset shadow that
  "presses in" on `:active` (translate + shrink shadow). `--btn-primary` = `--keep`
  green; `.btn-finish` = `--gold` foil CTA; `.btn-ghost` = cream.
- **Cards / slots**: cream + ink border. **Heroes** (`.total-card`, `.settings-group`,
  the verdict) keep the full 4–5px offset shadow; **list rows** (`.report-row`,
  `.team`, `.report-collapse`) use a quiet 2px shadow so the surface breathes and
  paints lighter on low-end phones.
- **Verdict flash** (`.flash`): full-screen, the hero. Green GUARDAR / red REPETIDA /
  neutral-kraft NÃO LI. Anton verb + offset shadow + a cream code chip with ink border.
- **Scan reticle** (`.scan-frame`): gold dashed "cole aqui" slot in the bottom third,
  over a **white fill-light** viewport. The white `box-shadow` spread is a hard-won
  capture fix (the screen acts as a ring light for the front camera) — keep it white
  even though everything else is album-green.
- **Bottom nav** (`.nav`): the album "spine" — ink bar, gold top edge, gold active tab.
- **Album chips** (`.chip`): owned = filled paper-green + foil ✓; needed = dashed
  empty "cole aqui" slot. Progress meters (`.progress-fill`) use a 45° hatched fill.
- **Counters / recent / multi-result**: small print "tickets" — cream, ink border,
  small offset shadow.

## Layout

Mobile-first, works at 320px, safe-area aware (`env(safe-area-inset-*)`). Single-
column screens with a fixed bottom spine nav (`--nav-h` 64px). Album chips use
`repeat(auto-fill, minmax(48px, 1fr))`. Touch targets ≥ 44–48px. Spacing rhythm via
the radius scale (`--radius` 6 / `--radius-sm` 4 / pill).

**Sticky headers in long lists.** Any long album list (Coleção, Repetidas, Trocar)
keeps the current **"Grupo X"** label pinned while its stickers scroll, so you never
lose your place. The rule: the screen's top bar stays pinned (`top: 0`), and each
group label pins **flush below it** — stacking, never overlapping (Trocar adds a third
level: bar → section header → group label). Two mechanics keep this honest:
- **Measure, don't hardcode, a tall/variable bar.** Coleção's and Repetidas's top bars
  differ in height (progress vs. hint) and reflow on font-load, so `useStickyOffset`
  (`src/ui/hooks.ts`) measures the bar and publishes `--sticky-offset`; the group label
  pins at `top: var(--sticky-offset)`. Only hardcode an offset when the bar is short and
  deterministic (Trocar's bars), and stack each offset on the one above it.
- **`overflow: clip`, not `hidden`, on a rounded card with sticky children.** `hidden`
  makes the card a scroll container that traps the sticky label inside it; `clip` keeps
  the rounded-corner clipping without that side effect (see `.own-ledger`).

## Motion

Restrained and intentional. Button press = offset-shadow "stamp". Verdict = quick
`flash-in` scale + `pop`. Reticle = slow gold "breathe". Onboarding = slide-in + dot
pill expand. The two width transitions (progress fill, onboarding dot) are deliberate
idioms (a hatched meter and a rounded pill), not layout thrash. Every animation is
disabled under `prefers-reduced-motion: reduce`.

## Accessibility

Target WCAG 2.1 AA. Visible `:focus-visible` gold ring; `.sr-only` + `aria-live`
announce each scan result (hands-free flow); information never by colour alone; touch
targets ≥ 44px; honest NÃO LI state (never a faked confident answer). All UI text in
pt-BR.
