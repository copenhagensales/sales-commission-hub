

# PR #5: Robust Absolut-Count KPI-arkitektur

## Status: Trin 1-3 FÆRDIGE ✅

## Oversigt

Erstat den nuvaerende delta/watermark-strategi i `calculate-kpi-incremental` med direkte SQL-aggregeringer der beregner korrekte totaler hver gang. Udvid fra kun employee-scoped til ogsaa client-scoped og global-scoped KPI'er. Migrer alle dashboards til at bruge cached vaerdier.

## Trin 1: Edge Function Rewrite ✅

- Omskrev `calculate-kpi-incremental` til absolut-count arkitektur
- Fjernede al watermark/delta-kode (~300 linjer → ~310 linjer)
- Beregner nu Client, Global og Employee scoped KPI'er hvert minut
- Deployeret og verificeret: 359 værdier opdateret på ~791ms

## Trin 2: Frontend-migration ✅

| Dashboard | Status | Detaljer |
|-----------|--------|----------|
| `UnitedDashboard.tsx` | ✅ Migreret | Per-client sales queries erstattet med cached KPI'er |
| `SalesOverviewAll.tsx` | ✅ Migreret | 2 tunge queries (TM+FM) erstattet med en cached query |
| `CphSalesDashboard.tsx` | ✅ Allerede cached | Bruger allerede usePrecomputedKpis + useCachedLeaderboard |
| `FieldmarketingDashboardFull.tsx` | ⏭️ Skippet | Bruger FM-specifikke hooks med raw_payload logik |
| `MyProfile.tsx` | ⏭️ Skippet | Behøver daglige commission-breakdowns, ikke kun totaler |
| `useDashboardKpiData.ts` | ✅ Allerede cached | Har cache-first strategi med fallback |

## Trin 4: Reducér full refresh ✅

- `calculate-kpi-values` full refresh: ændret fra `*/30 * * * *` til `0 * * * *` (hvert 60. minut)
- Den minutlige `calculate-kpi-incremental` er nu autoritativ for alle scopes

---

# PR #9: Plan Integration (Cron-staggering, REFRESH_PROFILES, trackFetch, Freshness Badges)

## Status: ALLE DELE FÆRDIGE ✅

## Del 1: Cron-staggering ✅

Alle 5 dialer-integrationer er nu forskudt for at undgå 429 rate limits:

| Integration | Provider | Schedule |
|---|---|---|
| Eesy | enreach | `:00, :05, :10...` |
| Lovablecph | adversus | `:01, :06, :11...` |
| tryg | enreach | `:02, :07, :12...` |
| Relatel_CPHSALES | adversus | `:03, :08, :13...` |
| ase | enreach | `:04, :09, :14...` |

Edge function `update-cron-schedule` udvidet med `custom_schedule` parameter.

## Del 2: REFRESH_PROFILES integration ✅

Centraliserede `staleTime`/`refetchInterval` værdier i følgende filer:
- `usePrecomputedKpi.ts` → `REFRESH_PROFILES.dashboard`
- `useCachedLeaderboard.ts` → `REFRESH_PROFILES.dashboard`
- `usePersonalWeeklyStats.ts` → `REFRESH_PROFILES.dashboard`
- `useTvCelebrationData.ts` → `REFRESH_PROFILES.dashboard`
- `useIntegrationDebugLog.ts` → `REFRESH_PROFILES.config`
- `usePendingContractLock.ts` → `REFRESH_PROFILES.dashboard`
- `useDashboardSalesData.ts` → `REFRESH_PROFILES.dashboard`
- `CsTop20Dashboard.tsx` → `REFRESH_PROFILES.dashboard`
- `SalesOverviewAll.tsx` → `REFRESH_PROFILES.dashboard` / `.config`

## Del 3: trackFetch observability ✅

Wrappet kritiske data-hooks med `trackFetch`:
- `usePrecomputedKpi.ts` → alle 3 hooks (single, batch, client dashboard)
- `useDashboardSalesData.ts` → hovedquery

## Del 4: Freshness badges ✅

- Ny komponent: `src/components/ui/DataFreshnessBadge.tsx`
- Tilføjet til `CphSalesDashboard.tsx` header
- Tilføjet til `SalesOverviewAll.tsx` header
- Viser "Opdateret kl. HH:mm" med farvekodning (grøn/gul/rød)
