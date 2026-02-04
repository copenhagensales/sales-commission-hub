# Central Sales Aggregation & Data Cleanup Plan

## Implementeringsrækkefølge (Opdateret)

| # | Opgave | Type | Prioritet | Status |
|---|--------|------|-----------|--------|
| 1 | Slet salg med pseudo-emails | SQL Migration | Kritisk | ⏳ |
| 2 | Slet Enreach-salg uden email | SQL Migration | Kritisk | ⏳ |
| 3 | Fix UNIQUE constraints | SQL Migration | Kritisk | ⏳ |
| 4 | Ryd cache-duplikater | SQL Migration | Kritisk | ⏳ |
| 5 | Opret RPC get_sales_aggregates | SQL Migration | Høj | ✅ |
| 6 | Opdater excluded-domains.ts med whitelist | Frontend | Høj | ⏳ |
| 7 | Opdater users.ts med whitelist + patterns | Edge Function | Høj | ⏳ |
| 8 | Opdater sales.ts med email-filtrering | Edge Function | Høj | ⏳ |
| 9 | Opdater adversus.ts - skip brugere uden email | Edge Function | Høj | ⏳ |
| 10 | Opdater enreach.ts - skip data uden email | Edge Function | Høj | ⏳ |
| 11 | Opret useSalesAggregates.ts | Ny fil | Høj | ✅ |
| 12 | Paginering: DBOverviewTab | Frontend | Høj | ✅ |
| 13 | Paginering: CombinedSalaryTab | Frontend | Høj | ✅ |
| 14 | Paginering: DBDailyBreakdown | Frontend | Høj | ✅ |
| 15 | Paginering: useCelebrationData | Frontend | Høj | ✅ |
| 16 | Paginering: useRecognitionKpis | Frontend | Medium | ✅ |
| 17 | Paginering: usePreviousPeriodComparison | Frontend | Medium | ✅ |
| 18 | Paginering: EmployeeCommissionHistory | Frontend | Medium | ⏳ |
| 19 | Paginering: SalesGoalTracker (NY!) | Frontend | Medium | ⏳ |
| 20 | Paginering: HeadToHeadComparison (NY!) | Frontend | Medium | ⏳ |
| 21 | Paginering: tv-dashboard-data (NY!) | Edge Function | Høj | ⏳ |
| 22 | Opret cleanup cron | SQL Migration | Lav | ⏳ |

**Total estimat:** ~7-8 timer

---

## Fase 1: Kritiske SQL Migrationer (1-4)
- [ ] #1: Slet salg hvor agent_email matcher pseudo-email patterns
- [ ] #2: Slet Enreach-salg hvor agent_email er NULL eller tom
- [ ] #3: Fix UNIQUE constraints på relevante tabeller
- [ ] #4: Ryd duplikater fra cache-tabeller

## Fase 2: Edge Function Email-Filtrering (7-10)
- [ ] #6: Opdater `excluded-domains.ts` med whitelist
- [ ] #7: Opdater `users.ts` med whitelist + patterns
- [ ] #8: Opdater `sales.ts` med email-filtrering
- [ ] #9: Opdater `adversus.ts` - skip brugere uden email
- [ ] #10: Opdater `enreach.ts` - skip data uden email

## Fase 3: Yderligere Paginering (18-21)
- [ ] #18: EmployeeCommissionHistory
- [ ] #19: SalesGoalTracker
- [ ] #20: HeadToHeadComparison
- [ ] #21: tv-dashboard-data edge function

## Fase 4: Cleanup Cron (22)
- [ ] #22: Opret scheduled cleanup job

---

## Fuldført ✅

### RPC & Central Hook
- `get_sales_aggregates_v2` RPC med grouping (employee, date, both, none)
- `useSalesAggregatesExtended.ts` med RPC-first + fallback
- `usePersonalSalesStats.ts`, `useDashboardAggregates.ts`, `useTeamDBStats.ts`

### Migrerede Komponenter
- `usePreviousPeriodComparison.ts`
- `useCelebrationData.ts`
- `useRecognitionKpis.ts`
- `CombinedSalaryTab.tsx`
- `DBOverviewTab.tsx`
- `DBDailyBreakdown.tsx`
