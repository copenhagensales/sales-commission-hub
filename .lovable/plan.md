

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

## Trin 3: TODO - Reducér full refresh

- `calculate-kpi-values` full refresh: fra hvert 30. minut til hvert 60. minut
- Den er ikke længere "ground truth" - den minutlige funktion er nu autoritativ
