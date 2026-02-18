

# PR #5: Robust Absolut-Count KPI-arkitektur

## Oversigt

Erstat den nuvaerende delta/watermark-strategi i `calculate-kpi-incremental` med direkte SQL-aggregeringer der beregner korrekte totaler hver gang. Udvid fra kun employee-scoped til ogsaa client-scoped og global-scoped KPI'er. Migrer alle dashboards til at bruge cached vaerdier.

## Hvorfor

- Delta-strategien er fejludsat: afviste/slettede salg traekkes aldrig fra
- Client- og global-scoped KPI'er opdateres kun hvert 30. minut
- Databasen kan beregne fuldstaendige totaler paa under 15 ms - delta er unoedvendigt

## Trin 1: Database - Opret `calculate_kpi_snapshot` RPC

Ny SQL-funktion der i et kald returnerer alle KPI-vaerdier for alle scopes og perioder:

- Telesales aggregering per client_id (via client_campaigns + adversus_campaign_mappings)
- FM-sales aggregering per client_id (source = 'fieldmarketing')
- Employee-scoped aggregering (via agent_email -> agents -> employee_agent_mapping)
- Global aggregering (sum af alt)
- Perioder: today, this_week, this_month, payroll_period
- KPI slugs: sales_count, total_commission, total_revenue
- Returnerer `TABLE(kpi_slug, period_type, scope_type, scope_id, value)`

## Trin 2: Omskriv `calculate-kpi-incremental` Edge Function

**Fil:** `supabase/functions/calculate-kpi-incremental/index.ts`

- Fjern al watermark/delta-kode (~300 linjer)
- Ny flow: kald RPC `calculate_kpi_snapshot()` -> formatter vaerdier -> upsert til `kpi_cached_values`
- Ingen watermarks, ingen drift, altid korrekte tal
- Estimeret koerselstid: < 500ms

## Trin 3: Frontend-migration

Migrer dashboards fra direkte database-queries til cache-hooks:

| Dashboard | Aendring |
|-----------|----------|
| `CphSalesDashboard.tsx` | Fjern 3 direkte sales-queries, brug `useClientDashboardKpis` |
| `SalesOverviewAll.tsx` | Fjern 2 sales + FM queries, brug cached client KPI'er |
| `UnitedDashboard.tsx` | Fjern 3 per-client sales-queries, brug `useClientDashboardKpis` |
| `FieldmarketingDashboardFull.tsx` | Migrer KPI-kort til cache, behold seneste-salg-liste |
| `MyProfile.tsx` | Migrer personlige KPI'er til employee-scoped cache |
| `useDashboardKpiData.ts` | Refaktoriser til at delegere til cache-hooks |

Behold direkte queries for: seneste-salg-lister, Excel-export, admin CRUD (MgTest), ImmediatePaymentASE (loenberegning), custom periode-leaderboard (CsTop20).

## Trin 4: Reducér full refresh

- `calculate-kpi-values` full refresh: fra hvert 30. minut til hvert 60. minut
- Den er ikke laengere "ground truth" - den minutlige funktion er nu autoritativ

## Implementeringsraekkefoelge

1. Opret `calculate_kpi_snapshot` SQL-funktion (migration)
2. Omskriv `calculate-kpi-incremental` edge function
3. Deploy og verificer at cached vaerdier er korrekte
4. Migrer frontend-dashboards en ad gangen (SalesOverviewAll -> CphSales -> United -> Fieldmarketing -> MyProfile)
5. Refaktoriser `useDashboardKpiData.ts`
6. Reducér full refresh frekvens

