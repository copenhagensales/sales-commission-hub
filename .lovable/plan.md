
# Central Sales Aggregation Hook - Implementeringsstatus

## ✅ Fuldført

### Fase 1: Server-Side RPC ✅
- [x] Oprettet `get_sales_aggregates_v2` med gruppering (employee, date, both, none)
- [x] Tilføjet `p_agent_emails` parameter for personal stats

### Fase 2: Central Hook ✅
- [x] Oprettet `useSalesAggregatesExtended.ts` med fuld funktionalitet
- [x] RPC-first med client-side fallback
- [x] Gruppering: employee, date, week, month
- [x] Top performer beregning

### Fase 3: Wrapper Hooks ✅
- [x] `usePersonalSalesStats.ts` - For personlige salgsmål
- [x] `useDashboardAggregates.ts` - For TV/celebration dashboards
- [x] `useTeamDBStats.ts` - For team DB oversigt

### Fase 4: Komponent Migreringer
| # | Komponent | Status | Notes |
|---|-----------|--------|-------|
| 1 | `usePreviousPeriodComparison.ts` | ✅ | Bruger nu central hook |
| 2 | `SalesGoalTracker.tsx` | ⏳ | Næste |
| 3 | `useCelebrationData.ts` | ✅ | Bruger `useDashboardAggregates` |
| 4 | `CombinedSalaryTab.tsx` | ✅ | Bruger `useTeamDBStats` |
| 5 | `useRecognitionKpis.ts` | ⏳ | Pending |
| 6 | `LiveStats.tsx` | ⏳ | Pending |
| 7 | `DBOverviewTab.tsx` | ⏳ | Complex - low priority |
| 8 | `DBDailyBreakdown.tsx` | ⏳ | Complex - low priority |

### Fase 5: Edge Functions
- [ ] `tv-dashboard-data/index.ts` - Opdater til RPC

---

## Nye Filer Oprettet

```
src/hooks/useSalesAggregatesExtended.ts  ✅
src/hooks/usePersonalSalesStats.ts       ✅
src/hooks/useDashboardAggregates.ts      ✅
src/hooks/useTeamDBStats.ts              ✅
```

## Opdaterede Filer

```
src/hooks/usePreviousPeriodComparison.ts  ✅
src/hooks/useCelebrationData.ts           ✅
src/components/salary/CombinedSalaryTab.tsx  ✅
```

## Næste Trin

1. Migrér `useRecognitionKpis.ts` 
2. Migrér `LiveStats.tsx` (kompleks)
3. Opdater `tv-dashboard-data` edge function
