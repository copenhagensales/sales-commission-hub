

# Implementer TV League Dashboard i dashboard-miljøet

## Overblik
Opret et nyt "Superliga Live" TV-dashboard med statisk venstre zone (Top 3 + salgs-ticker) og roterende højre zone (division highlights, bevægelser, records). Registrer det i dashboard-miljøet (sidebar, routes, TV board maps).

## Ændringer

### 1. Ny edge function: `supabase/functions/tv-league-data/index.ts`
- Service role client (bypasser RLS)
- Finder aktiv sæson (`league_seasons` med status `qualification` eller `active`)
- Henter standings fra `league_qualification_standings` + `employee_master_data` (navn, team)
- Beregner og returnerer ét JSON payload:
  - `top3` — de 3 med lavest `overall_rank`
  - `divisions` — grupperet per `projected_division`, top 5 per division, med promotion/relegation zone-markering
  - `movements` — spillere med størst forskel `previous_overall_rank - overall_rank` (op og ned)
  - `topLastHour` — top 3 sælgere med mest provision den seneste time (via `sale_items` aggregeret på `sold_datetime`)
  - `recentEarners` — sælgere med provision > 300 kr siden seneste 15-min vindue
  - `records` — højeste `current_provision` i sæsonen, gennemsnit per division
- In-memory cache (30 sek TTL) som eksisterende `tv-dashboard-data`

### 2. Ny side: `src/pages/tv-board/TvLeagueDashboard.tsx`
- Split-layout: 40% statisk venstre, 60% roterende højre
- **Venstre (statisk):**
  - Top 3 podium med glow-effekt, navn, provision, division
  - Salgs-ticker: scrollende feed med sælgere der har tjent 300+ kr siden sidste 15-min opdatering
- **Højre (roterer ~15 sek med `AnimatePresence`):**
  - Scene A: Division Highlights (én division ad gangen, top 5, zoner)
  - Scene B: Dagens Bevægelser (rank-spring 🚀/📉 + top 3 mest tjent sidste time)
  - Scene C: Records (højeste enkeltdag, division-gennemsnit bar chart)
- Dark theme, store fonte, 1920×1080 optimeret
- Auto-refresh hvert 30 sek via edge function

### 3. Lazy page export: `src/routes/pages.ts`
- Tilføj `export const TvLeagueDashboard = lazyPage(() => import("@/pages/tv-board/TvLeagueDashboard"))`

### 4. Route registrering: `src/routes/config.tsx`
- Tilføj `{ path: "/dashboards/commission-league", component: TvLeagueDashboard, access: "protected" }` i dashboard-gruppen

### 5. Dashboard config: `src/config/dashboards.ts`
- Tilføj `{ slug: "commission-league", name: "Superliga Live", path: "/dashboards/commission-league", description: "Live liga-overblik med top performers og division highlights", permissionKey: "menu_dashboard_commission_league" }`

### 6. TV Board maps: `TvBoardDirect.tsx` + `TvBoardView.tsx`
- Tilføj `"commission-league": TvLeagueDashboard` til `dashboardComponents` i begge filer

| Fil | Handling |
|-----|---------|
| `supabase/functions/tv-league-data/index.ts` | Ny edge function |
| `src/pages/tv-board/TvLeagueDashboard.tsx` | Ny side med split-layout |
| `src/routes/pages.ts` | Lazy page export |
| `src/routes/config.tsx` | Route registrering |
| `src/config/dashboards.ts` | Dashboard config entry |
| `src/pages/tv-board/TvBoardDirect.tsx` | TV component map |
| `src/pages/tv-board/TvBoardView.tsx` | TV component map |

