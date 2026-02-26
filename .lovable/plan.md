

# Split tidslinje per provider (Adversus / Enreach)

## Hvorfor
Overlaps mellem Adversus og Enreach er irrelevante -- de bruger forskellige API'er med separate rate limits. Kun overlaps inden for samme provider giver problemer (fx Relatel + Lovablecph begge rammer Adversus).

## Hvad der aendres

### `TimelineOverlap.tsx`
- Grupper jobs efter `provider` (fx "adversus", "enreach")
- Render en separat Card per provider med titel "Tidslinje — Adversus" / "Tidslinje — Enreach"
- Overlap-detektion koerer kun inden for hver provider-gruppe (det goer den allerede via `providerFilter: true`, men nu er det visuelt tydeligt)
- Hvis en provider kun har 1 integration (ingen mulig kollision), vises tidslinjen stadig men uden overlap-warnings

### `SystemStability.tsx`
- Ingen aendringer -- sender stadig alle integrations + cronJobs. Komponentens interne logik haandterer gruppering.

## Resultat
To separate kort:
1. **Tidslinje — Adversus**: Relatel Sales, Relatel Meta, Lovablecph Sales, Lovablecph Meta (med overlap-markering)
2. **Tidslinje — Enreach**: Eesy, Tryg, ASE (sales + meta, med overlap-markering kun indbyrdes)
