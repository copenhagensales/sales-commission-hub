

## Samlet plan: Præmiesektion med 6 titler

### De 6 præmier

| # | Titel | Logik |
|---|-------|-------|
| 🥇 | Nummer 1 | `overall_rank = 1` fra standings |
| 🥈 | Nummer 2 | `overall_rank = 2` |
| 🥉 | Nummer 3 | `overall_rank = 3` |
| 🔥 | Sæsonens Bedste Runde | Højeste `points_earned` i én runde fra `league_round_standings` |
| ⭐ | Sæsonens Talent | Flest point blandt spillere med < 3 måneders ansættelse **da sæsonen startede** (beregnet fra `employee_master_data.employment_start_date` vs `league_seasons.start_date`) |
| 🚀 | Sæsonens Comeback | Spilleren der er rykket flest placeringer op. Beregnes som `(startrank - nuværende overall_rank)` hvor startrank er rank efter runde 1. Oprykninger mellem divisioner tæller med da `overall_rank` er et samlet globalt rank på tværs af alle divisioner |

### Ændringer

**1. Nyt hook i `useLeagueActiveData.ts`**: `usePrizeLeaders(seasonId)`
- Én samlet query-hook der henter:
  - **Bedste runde**: `league_round_standings` ORDER BY `points_earned` DESC LIMIT 1, med employee join
  - **Talent**: Join `league_season_standings` med `employee_master_data.employment_start_date`, filtrér til dem hvor `employment_start_date > (season.start_date - 3 months)`, tag den med flest `total_points`
  - **Comeback**: Hent runde 1's standings (`league_round_standings` WHERE round_number=1) for at finde start-rank pr. spiller. Beregn `startRank - currentOverallRank` for hver spiller, vis den med størst positiv forskel. Da `overall_rank` er globalt (på tværs af divisioner), tæller oprykninger automatisk med

**2. Ny komponent: `src/components/league/PrizeShowcase.tsx`**
- Responsiv grid: 2×3 mobil, 3×2 tablet, 6×1 desktop
- 6 kort med mørk baggrund og farvet kant (guld/sølv/bronze/rød-gradient/lilla/grøn)
- Hvert kort: emoji, titel, spillernavn (`formatPlayerName`), undertekst med point/stat
- Under kvalifikation: top 3 fra qualification standings, dynamiske præmier viser "Afsløres efter runde 1"
- Under aktiv fase: top 3 fra season standings, dynamiske data fra hooket
- Fælles undertekst: "Afgøres ved sæsonens afslutning"

**3. Ændring i `CommissionLeague.tsx`**
- Importér `PrizeShowcase` og `usePrizeLeaders`
- Placér efter header-section, synlig for alle
- Send standings + prizeLeaders + season status som props

### Vigtige detaljer

- **Talent-beregning**: `employment_start_date > season.start_date - 90 dage` — dette sikrer at det er ansættelsesdato relativt til sæsonstart, ikke "nu"
- **Comeback bruger overall_rank**: Da `overall_rank` allerede er et samlet rank på tværs af alle divisioner, vil en spiller der rykker fra 2. division til 1. division automatisk få et bedre overall_rank — oprykninger tæller derfor naturligt med
- **Ingen database-ændringer**: Al data findes allerede i eksisterende tabeller

