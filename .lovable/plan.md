

# Forbedring af dato-vælger på Sales-siden

## Problem
Dato-vælgeren åbner en bred popover med presets + 2-måneders kalender side om side. Det er uoverskueligt og fylder meget — især på mindre skærme. Aktiv preset-markering er subtil.

## Løsning
Omstrukturér popover-layoutet til et mere kompakt og brugervenligt design:

### Ændringer i `SalesFeed.tsx`

1. **Responsiv kalender** — Vis kun 1 måned i kalenderen i stedet for 2. Det halverer bredden og er tilstrækkeligt til de fleste use cases.

2. **Vertikal layout i stedet for horisontal** — Placer presets øverst som en grid af chips/knapper (2-3 kolonner) og kalenderen nedenunder. Det giver bedre flow og fylder mindre i bredden.

3. **Tydeligere aktiv preset** — Brug `bg-primary text-primary-foreground` på den aktive preset-knap i stedet for subtil `secondary` variant.

4. **Tilføj "Lønperiode" preset** — Tilføj som ekstra hurtig-valg da det bruges ofte i systemet.

5. **"Ryd" knap i popover** — Tilføj en tydelig "Nulstil" knap nederst så brugeren kan fjerne dato-filteret inde fra popover'en.

### Nyt layout
```text
┌─────────────────────────────┐
│ Hurtig valg                 │
│ [I dag] [I går] [Denne uge] │
│ [7 dage] [30 dage] [Måned]  │
│ [Lønperiode]                │
│ ─────────────────────────── │
│ Eller vælg periode          │
│ ┌─────────────────────────┐ │
│ │    < marts 2026 >       │ │
│ │  MA TI ON TO FR LØ SØ   │ │
│ │  ...kalender...          │ │
│ └─────────────────────────┘ │
│               [Nulstil]     │
└─────────────────────────────┘
```

## Fil
`src/components/sales/SalesFeed.tsx`

