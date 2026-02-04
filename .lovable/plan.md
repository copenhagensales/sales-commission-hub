# Central Sales Aggregation & Data Cleanup Plan

## Implementeringsrækkefølge (Opdateret)

| # | Opgave | Type | Prioritet | Status |
|---|--------|------|-----------|--------|
| 1 | Slet salg med pseudo-emails | SQL Migration | Kritisk | ✅ |
| 2 | Slet Enreach-salg uden email | SQL Migration | Kritisk | ✅ |
| 3 | Fix UNIQUE constraints | SQL Migration | Kritisk | ✅ |
| 4 | Ryd cache-duplikater | SQL Migration | Kritisk | ✅ |
| 5 | Opret RPC get_sales_aggregates | SQL Migration | Høj | ✅ |
| 6 | Opdater excluded-domains.ts med whitelist | Frontend | Høj | ✅ (existed) |
| 7 | Opdater users.ts med whitelist + patterns | Edge Function | Høj | ✅ (existed) |
| 8 | Opdater sales.ts med email-filtrering | Edge Function | Høj | ✅ (existed) |
| 9 | Opdater adversus.ts - skip brugere uden email | Edge Function | Høj | ✅ |
| 10 | Opdater enreach.ts - skip data uden email | Edge Function | Høj | ✅ |
| 11 | Opret useSalesAggregates.ts | Ny fil | Høj | ✅ |
| 12 | Paginering: DBOverviewTab | Frontend | Høj | ✅ |
| 13 | Paginering: CombinedSalaryTab | Frontend | Høj | ✅ |
| 14 | Paginering: DBDailyBreakdown | Frontend | Høj | ✅ |
| 15 | Paginering: useCelebrationData | Frontend | Høj | ✅ |
| 16 | Paginering: useRecognitionKpis | Frontend | Medium | ✅ |
| 17 | Paginering: usePreviousPeriodComparison | Frontend | Medium | ✅ |
| 18 | Paginering: EmployeeCommissionHistory | Frontend | Medium | ⏸️ Single-user, bounded |
| 19 | Paginering: SalesGoalTracker (NY!) | Frontend | Medium | ⏸️ Uses props, not query |
| 20 | Paginering: HeadToHeadComparison (NY!) | Frontend | Medium | ⏸️ Complex, low priority |
| 21 | Paginering: tv-dashboard-data (NY!) | Edge Function | Høj | ⏸️ Uses kpi_leaderboard_cache |
| 22 | Opret cleanup cron | SQL Migration | Lav | ⏳ |

**Total estimat:** ~7-8 timer

---

## Completed ✅

### SQL Migrations (1-4)
- Deleted 310 sales with missing email (Enreach)
- No pseudo-email sales found (adversus.local pattern) - adapter now filters at source
- Created UNIQUE index on kpi_leaderboard_cache
- Created indexes on sales.agent_email and sales.source

### RPC & Central Hook (5, 11)
- `get_sales_aggregates_v2` with grouping (employee, date, both, none)
- `useSalesAggregatesExtended.ts` with RPC-first + fallback
- Wrapper hooks: `usePersonalSalesStats`, `useDashboardAggregates`, `useTeamDBStats`

### Edge Function Email Filtering (6-10)
- `excluded-domains.ts` - Already had whitelist (VALID_EMAIL_DOMAINS)
- `users.ts` - Already filters by whitelist
- `sales.ts` - Already filters by whitelist
- `adversus.ts` - Updated to skip invalid emails (return null → filter)
- `enreach.ts` - Updated to filter after mapping with whitelist

### Frontend Migrations (12-17)
- `usePreviousPeriodComparison.ts` - Uses central hook
- `useCelebrationData.ts` - Uses `useDashboardAggregates`
- `useRecognitionKpis.ts` - Uses RPC with fallback
- `CombinedSalaryTab.tsx` - Uses `useTeamDBStats`
- `DBOverviewTab.tsx` - Uses `useTeamDBStats`
- `DBDailyBreakdown.tsx` - Uses `useTeamDBStats.byDate`

---

## Deprioritized (18-21)

### EmployeeCommissionHistory (#18)
- Single-user, single-period scope - no pagination risk
- Data set is inherently bounded

### SalesGoalTracker (#19)
- Receives data via props (`commissionStats`)
- Does not fetch sales directly

### HeadToHeadComparison (#20)
- 1914 lines, very complex
- Low impact on overall pagination issues
- Uses optimized refetchIntervals (2 minutes)

### tv-dashboard-data (#21)
- Already uses `kpi_leaderboard_cache` (pre-computed)
- High risk of breaking TV boards

---

## Architecture Benefits

1. **Single source of truth** - All sales aggregation through central hook
2. **Server-side calculation** - RPC reduces client load
3. **Consistent logic** - `counts_as_sale`, `validation_status`, `quantity * mapped_commission` handled uniformly
4. **Automatic pagination** - `fetchAllRows` fallback built-in
5. **Better performance** - Cache sharing via react-query
6. **Email whitelist at source** - Invalid data never enters DB
7. **Easier maintenance** - Changes in one place
