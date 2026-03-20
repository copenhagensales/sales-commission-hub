

# Tilføj præmie-titler til TV Dashboard med sæson-aware logik

## Overblik
Tilføj de 3 præmiekort (Bedste Runde, Sæsonens Talent, Sæsonens Comeback) under Top 3 podiet i venstre zone. Top 3 og præmierne skal fungere kontekstuelt:

- **Kvalifikation**: Top 3 baseret på `current_provision`. Bedste Runde og Comeback viser "Afgøres når sæsonen starter". Talent viser "Afgøres efter runde 1".
- **Aktiv sæson**: Top 3 baseret på `total_points` fra `league_season_standings`. Bedste Runde og Comeback er live med det samme (efter kval). Talent kræver mindst 1 runde med point (fordi den måler point).

## Ændringer

### 1. `supabase/functions/tv-league-data/index.ts`
- Når `status === "active"`: hent Top 3 fra `league_season_standings` (sorteret by `total_points`) i stedet for `league_qualification_standings`
- Tilføj `prizeLeaders` til payload med:
  - **bestRound**: Hent fra `league_round_standings` (top 1 by `points_earned`) — live fra runde 1
  - **talent**: Hent fra `league_season_standings` filtreret på `employment_start_date` < 90 dage fra sæsonstart — kræver point > 0
  - **comeback**: Hent runde 1 standings vs nuværende `overall_rank`, beregn forbedring — live fra runde 1
- Inkluder `seasonStartDate` i payload for talent-beregning

### 2. `src/pages/tv-board/TvLeagueDashboard.tsx`
- Udvid `LeaguePayload` med `prizeLeaders` type
- Opdater `PodiumCard` til at vise "pt" i stedet for "kr" når `seasonStatus === "active"`
- Tilføj 3 præmie-kort under podiet (grid cols-3):
  - 🔥 Bedste Runde (rød border) — locked under kval, viser leder under aktiv
  - ⭐ Sæsonens Talent (lilla border) — locked under kval + runde 1 uden point, viser leder når point > 0
  - 🚀 Sæsonens Comeback (grøn border) — locked under kval, viser leder under aktiv
- Lock-state: Lock-ikon + "Afgøres når sæsonen starter" (kval) eller "Afgøres efter runde 1" (talent uden data)
- Reducér TickerFeed max-height for at gøre plads til præmie-kortene

| Fil | Handling |
|-----|---------|
| `supabase/functions/tv-league-data/index.ts` | Tilføj prizeLeaders + sæson-aware top 3 |
| `src/pages/tv-board/TvLeagueDashboard.tsx` | Tilføj præmie-kort + betinget top 3 visning |

