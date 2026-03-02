

# Fix: Pagination-stopbetingelse i ReportsManagement.tsx

## Hvad er bygget allerede (bekræftet)
- System Architecture Diagram med 3-lags flow (Eksterne Kilder → Processing & Data → KPI & Output)
- Unified KPI Gateway (`useKpiGateway.ts`) med contract versioning, freshness og health monitoring
- KPI cache-lag (`kpi_cached_values`, `kpi_leaderboard_cache`) opdateret af edge functions
- Metric Contract (`metricContract.ts`) og runtime config (`kpiRuntime.ts`)
- Dual-read compare infrastruktur via `useKpiHealthMonitor`
- Pagineret RPC `get_sales_report_raw` med `p_limit`/`p_offset`

## Det ene resterende problem
`PAGE_SIZE = 2000` i `ReportsManagement.tsx` linje 93, men Supabase API returnerer maks 1000 rækker. Loopet bryder ved `data.length (1000) < PAGE_SIZE (2000)` = true → kun 1000 rækker.

## Ændring
**Fil: `src/pages/reports/ReportsManagement.tsx`**
- Linje 93: Ændr `PAGE_SIZE` fra `2000` til `1000`
- Tilføj safety guard (max 50 iterationer) for at undgå uendelig løkke

Det er en én-linje fix der løser hele Excel-problemet. Ingen database-ændringer nødvendige — arkitekturen er korrekt.

