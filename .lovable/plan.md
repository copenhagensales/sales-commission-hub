

# Fix: NULL validation_status bug i alle filer

## Problem
`.neq("validation_status", "rejected")` og `.not("sales.validation_status", "eq", "rejected")` ekskluderer salgsposter med `NULL` validation_status, fordi PostgreSQL behandler `NULL != 'rejected'` som `NULL` (falsk). Dette skjuler ca. 107.000 kr provision fra dashboards.

## Trin 1: Backfill eksisterende NULL-raekker
Opdater alle salg med `validation_status = NULL` til `'pending'`, saa de straks bliver synlige.

```sql
UPDATE sales SET validation_status = 'pending' WHERE validation_status IS NULL;
```

## Trin 2: Fix filter i 17 steder paa tvaers af 14 filer

Erstat `.neq("validation_status", "rejected")` med:
```
.or("validation_status.neq.rejected,validation_status.is.null")
```

Erstat `.not("sales.validation_status", "eq", "rejected")` med:
```
.or("sales.validation_status.neq.rejected,sales.validation_status.is.null")
```

### Frontend-filer (8 filer):
1. `src/hooks/useSalesAggregatesExtended.ts` - 1 sted
2. `src/hooks/useSalesAggregates.ts` - 1 sted
3. `src/hooks/useDashboardKpiData.ts` - 3 steder (`.not()` variant)
4. `src/components/home/HeadToHeadComparison.tsx` - 1 sted
5. `src/components/sales/SalesFeed.tsx` - 1 sted
6. `src/components/dashboard/DailyRevenueChart.tsx` - 1 sted
7. `src/components/my-profile/SalesGoalTracker.tsx` - 1 sted (`.not()` variant)
8. `src/pages/shift-planning/ShiftOverview.tsx` - 1 sted
9. `src/pages/dashboards/CphSalesDashboard.tsx` - 2 steder
10. `src/pages/ImmediatePaymentASE.tsx` - 1 sted

### Edge Functions (4 filer):
11. `supabase/functions/calculate-kpi-incremental/index.ts` - 1 sted
12. `supabase/functions/calculate-kpi-values/index.ts` - 5 steder (`.neq()`) + 3 steder (`.not()`)
13. `supabase/functions/calculate-leaderboard-incremental/index.ts` - 1 sted
14. `supabase/functions/tv-dashboard-data/index.ts` - 2 steder
15. `supabase/functions/snapshot-payroll-period/index.ts` - 1 sted
16. `supabase/functions/league-calculate-standings/index.ts` - 1 sted

## Trin 3: Genberegn KPI-cache
Kald `calculate-kpi-incremental` med `force: true` for at opdatere cached vaerdier med det rettede filter.

## Effekt
- Thorbjorns dashboard-tal vil matche dagsrapporten
- Alle fremtidige salg med NULL validation_status bliver korrekt inkluderet
- Ca. 107.000 kr provision genoprettes i dashboards systemdaekkende

