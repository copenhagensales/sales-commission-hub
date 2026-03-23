

# Vis foreløbige præmieledere med kval som runde

## Problem
Præmiekortene viser "Afsløres efter runde 1" selvom sæsonen er aktiv og der er live provision-data. Kvalifikationsrunden tæller som en runde i konkurrencen og skal medregnes.

## Ændringer

### 1. `src/pages/CommissionLeague.tsx`
- Send `roundProvisionMap` og `seasonStandings` (med employee-data) til `PrizeShowcase`

### 2. `src/components/league/PrizeShowcase.tsx`
- Tilføj props: `roundProvisionMap?: Record<string, number>` og en liste af spillere med employee-info
- Når `isActive` og `prizeLeaders?.bestRound` er null (ingen afsluttede runder i `league_round_standings`):
  - Find spilleren med højest provision i `roundProvisionMap`
  - Vis som foreløbig leder med "Foreløbig" badge
- Samme logik for talent og comeback hvor relevant

### 3. `src/hooks/useLeaguePrizeData.ts`
- Kvalifikationsrunden skal tælle med i "Bedste Runde" også når sæsonen er aktiv
- I `isActive`-blokken: hent også kvalifikationsdata og inkluder den bedste kval-præstation som "Kval" i `allBestRounds`
- Sammenlign kval-bedste med runde-bedste for at finde den reelle leder
- "Sæsonens Comeback": Beregn allerede fra kval → runde 1 (nuværende logik kræver `round1` afsluttet — brug live `roundProvisionMap` som fallback)

### Beregningslogik for foreløbig leder
```text
bestRound candidates:
  1. Alle afsluttede runder fra league_round_standings (points)
  2. Kvalifikationsrundens bedste (provision fra league_qualification_standings)  
  3. Live aktuel runde (provision fra roundProvisionMap) — "Foreløbig"

Vis den højeste af alle tre som leder.
For live-data: vis "Foreløbig" tag.
```

| Fil | Ændring |
|-----|---------|
| `src/hooks/useLeaguePrizeData.ts` | Inkluder kval-provision i bestRound-beregning |
| `src/components/league/PrizeShowcase.tsx` | Tilføj `roundProvisionMap` prop, vis foreløbig leder fra live data |
| `src/pages/CommissionLeague.tsx` | Send `roundProvisionMap` + standings til PrizeShowcase |

