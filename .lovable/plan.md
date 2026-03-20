

# Tilføj playoff-zone + korrekte zone-regler til TV Dashboard

## Problem
Edge function bruger kun 2 zoner (top 2 = promotion, bund 2 = relegation). De reelle regler har 4 zoner:
- **Top 3** (#1-3): Oprykningszone (grøn) — ikke i øverste division
- **#4-5**: Playoff op (orange) — ikke i øverste division
- **#10-11** (playersPerDivision - 4, -3): Playoff ned (orange)
- **#13-14** (playersPerDivision - 2, -1): Nedrykningszone (rød) — ikke i nederste division

## Ændringer

### 1. `supabase/functions/tv-league-data/index.ts`
- Udvid zone-beregning fra 2 til 4 zoner + tilføj `isTopDivision`/`isBottomDivision` kontekst:
  - `"promotion"` → rank 1-3 (ikke top division)
  - `"top"` → rank 1-3 i division 1
  - `"playoff"` → rank 4-5 ELLER rank playersPerDivision-4/playersPerDivision-3
  - `"relegation"` → rank ≥ playersPerDivision-1 (ikke bund division)
  - `"safe"` → resten
- Send `totalDivisions` med i hvert division-objekt (allerede i payload)

### 2. `src/pages/tv-board/TvLeagueDashboard.tsx`
- Udvid `PlayerEntry.zone` type med `"top"` og `"playoff"`
- Opdater `SceneDivisions` border/tekst-farver:
  - Top 3 medals (guld/sølv/bronze) bevares for rank 1-3
  - Playoff: orange border (`border-l-orange-400`) + orange navnefarve
  - Relegation: rød border + rød navnefarve
  - Promotion: grøn border + grøn navnefarve (rang 1-3 beholder medal-farver)
- Opdater zone-legend i bunden med alle 4 zoner (oprykningn, playoff, nedrykning, top 3)

| Fil | Handling |
|-----|---------|
| `supabase/functions/tv-league-data/index.ts` | Ret zone-logik til 4 zoner |
| `src/pages/tv-board/TvLeagueDashboard.tsx` | Vis alle zoner med korrekte farver + legend |

