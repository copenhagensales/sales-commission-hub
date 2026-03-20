

# Fyld TV League Dashboard — Nye data-elementer

## Nuværende tomme områder
- **SceneMovements**: Plads under "Mest tjent sidste time" (3 rækker + tom bund)
- **SceneRecords**: Kun 2 sektioner (højeste provision + 3 division-gennemsnit)
- Generelt: Scenerne fylder ~60% af venstre kolonne

## Nye data-elementer

### Backend: `supabase/functions/tv-league-data/index.ts`

| Nyt felt | Beskrivelse | Datakilde |
|----------|-------------|-----------|
| `todayTopEarners` | Top 5 daglige indtjenere (hele dagen) | `get_sales_aggregates_v2` med dagens dato |
| `teamRankings` | Top 3 teams by aggregeret provision | Aggregér `enriched` standings per `team_id` |
| `todayLeagueTotal` | Samlet provision for alle liga-spillere i dag | Sum fra `todayTopEarners` data |
| `longestStreak` | Spilleren med længste aktive streak (overgår forrige dag) | `employee_sales_streaks` tabel → `current_streak` |
| `raceToTop` | Top 5 spillere med gap til #1 | Fra `enriched` standings |
| `activeLast15Min` | Antal spillere med salg i sidste 15 min | `recentEarners.length` (allerede tilgængeligt) |

### Frontend: `src/pages/tv-board/TvLeagueDashboard.tsx`

**SceneMovements (udvid)**:
- Tilføj **"Dagens Top 5"** sektion (hele dagens top-indtjenere under "Mest tjent sidste time")
- Tilføj **"Aktive nu"** pill-badge (antal spillere med salg sidste 15 min)

**SceneRecords (udvid)**:
- Tilføj **"Længste streak 🔥"** kort (spilleren der har overgået forrige dag flest dage i træk)
- Tilføj **"Team Ranking"** — top 3 teams med horisontale barer
- Tilføj **"Dagens liga-total"** — samlet provision i dag som stort tal

**Ny scene 4: "Ligaoverblik"**:
- **"Race to #1"** — horisontale barer for top 5 spillere med gap til #1
- **"Divisionskamp"** — samlet provision per division (head-to-head)
- **"Liga i tal"** — antal spillere, divisioner, samlet provision, aktive i dag

**Rotation**: 4 scener med `[15_000, 20_000, 20_000, 20_000]` ms

### Ændringer

| Fil | Handling |
|-----|---------|
| `supabase/functions/tv-league-data/index.ts` | Tilføj `todayTopEarners`, `teamRankings`, `todayLeagueTotal`, `longestStreak`, `raceToTop` |
| `src/pages/tv-board/TvLeagueDashboard.tsx` | Udvid Movements + Records, tilføj ny "Ligaoverblik" scene |

