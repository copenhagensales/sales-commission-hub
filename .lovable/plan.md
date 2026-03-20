

# Gør præmie-kort live under kvalifikation i TV Dashboard

## Problem
Under kvalifikation er alle 3 præmie-kort låste med "Afgøres når sæsonen starter". Aftalen er at **Bedste Runde** og **Comeback** skal vise data allerede under kvalifikation (provision-baseret), mens **Talent** viser "Afgøres efter runde 1".

## Tilgang
Under kvalifikation har vi ikke runder/point, så vi bruger tilgængelige data:
- **Bedste Runde** → Spilleren med højeste `current_provision` (= top performer i kval)
- **Comeback** → Største `previous_overall_rank - overall_rank` forbedring (allerede i `league_qualification_standings`)
- **Talent** → Locked med "Afgøres efter runde 1"

## Ændringer

### 1. `supabase/functions/tv-league-data/index.ts`
- Flyt `prizeLeaders` beregning ud af `if (isActive)` blokken
- Tilføj kvalifikations-logik:
  - **bestRound (kval)**: Find spilleren med højest `current_provision` fra enriched standings, vis label som "X kr (provision)"
  - **comeback (kval)**: Find spilleren med størst positiv `previous_overall_rank - overall_rank` fra qualification standings, vis label som "+X pladser"
  - **talent**: Altid `null` under kvalifikation (kræver point)
- Bevar eksisterende aktiv-sæson logik uændret

### 2. `src/pages/tv-board/TvLeagueDashboard.tsx`
- Fjern `locked={isQualification}` fra Bedste Runde og Comeback kort
- Ændr locked-betingelse til kun at locke når der ikke er data: `locked={!prizeLeaders?.bestRound}`
- Talent: `locked={!prizeLeaders?.talent}` med lockedText "Afgøres efter runde 1"

| Fil | Handling |
|-----|---------|
| `supabase/functions/tv-league-data/index.ts` | Beregn prizeLeaders under kval med provision-data |
| `src/pages/tv-board/TvLeagueDashboard.tsx` | Opdater locked-betingelser til data-drevet |

