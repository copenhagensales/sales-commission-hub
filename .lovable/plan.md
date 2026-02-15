

# Fratræk kun afviste (rejected) salg fra alle viste tal i systemet

## Overblik

Alle steder i systemet der henter og viser salgstal, provision og omsætning skal filtrere `rejected` salg fra. I dag mangler dette filter mange steder, og andre steder filtrerer det fejlagtigt også `cancelled` salg fra.

## Ændringer

### 1. SQL RPC-funktioner (database-migration)

**`get_sales_aggregates` (v1)** -- Linje 48:
- Fra: `NOT IN ('cancelled', 'rejected')`
- Til: `!= 'rejected'`

**`get_sales_aggregates_v2`** -- Linje 47:
- Fra: `NOT IN ('cancelled', 'rejected')`
- Til: `!= 'rejected'`

---

### 2. Frontend hooks (client-side fallback queries)

**`src/hooks/useSalesAggregates.ts`** -- fallback query:
- Tilfoej `.neq("validation_status", "rejected")` til filteret

**`src/hooks/useSalesAggregatesExtended.ts`** -- `fetchAndCalculateClientSide`:
- Tilfoej `.neq("validation_status", "rejected")` til filteret

**`src/hooks/useDashboardKpiData.ts`** -- 3 steder (linje ~447, ~595, ~1190):
- Fjern `.not("sales.validation_status", "eq", "cancelled")` (behold kun `rejected`-filteret)

---

### 3. Frontend sider (direkte sales-queries)

**`src/pages/CsTop20Dashboard.tsx`** (~linje 112):
- Tilfoej `.neq("validation_status", "rejected")` til custom leaderboard query

**`src/pages/UnitedDashboard.tsx`** (~linje 184-204):
- Tilfoej `.neq("validation_status", "rejected")` til alle tre period-queries (today, week, month)

**`src/pages/dashboards/CphSalesDashboard.tsx`** (~linje 242 og ~305):
- Tilfoej `.neq("validation_status", "rejected")` til today-sales og FM-sales queries

**`src/components/dashboard/DailyRevenueChart.tsx`** (~linje 30 og ~144):
- Tilfoej `.neq("validation_status", "rejected")` til begge paginated sales-queries

**`src/components/home/HeadToHeadComparison.tsx`** (~linje 506):
- Tilfoej `.neq("validation_status", "rejected")` til head-to-head sales query

**`src/components/sales/SalesFeed.tsx`** (~linje 246):
- Tilfoej `.neq("validation_status", "rejected")` til sales feed query (saa rejected salg ikke vises i feed)

**`src/components/my-profile/SalesGoalTracker.tsx`** (~linje 154):
- Tilfoej `.not("sales.validation_status", "eq", "rejected")` til sale_items inner-join query

**`src/pages/ImmediatePaymentASE.tsx`** (~linje 280):
- Tilfoej `.neq("validation_status", "rejected")` til ASE immediate payment query

**`src/pages/shift-planning/ShiftOverview.tsx`** (~linje 213):
- Tilfoej `rejected`-udelukkelse til weekly sales query (opdater `or`-filter)

---

### 4. Edge functions (backend KPI og dashboard beregninger)

**`supabase/functions/calculate-kpi-values/index.ts`** -- 7 steder:
- `fetchAllSaleIds` (~linje 176): tilfoej `.neq("validation_status", "rejected")`
- `fetchAllSalesWithItemsForEmployeeKpi` (~linje 212): tilfoej filter
- FM sales fetch (~linje 537): tilfoej filter
- `fetchAllSalesWithItems` leaderboard (~linje 1009): tilfoej filter
- `fetchFmSalesForPeriod` (~linje 1057): tilfoej filter
- `calculateSalesCount` (~linje 1668 og 1707): tilfoej filter paa sale_items via join og FM count
- `calculateTotalCommission` (~linje 1723 og 1741): tilfoej filter
- `calculateTotalRevenue` (~linje 1765): tilfoej filter

**`supabase/functions/calculate-kpi-incremental/index.ts`** -- 2 steder:
- Telesales query (~linje 223): tilfoej `.neq("validation_status", "rejected")`
- FM sales query (~linje 239): tilfoej `.neq("validation_status", "rejected")`

**`supabase/functions/calculate-leaderboard-incremental/index.ts`** -- 2 steder:
- `fetchAllSalesWithItems` (~linje 166): tilfoej `.neq("validation_status", "rejected")`
- `fetchFmSalesForPeriod` (~linje 206): tilfoej `.neq("validation_status", "rejected")`

**`supabase/functions/tv-dashboard-data/index.ts`** -- ~15 steder:
- Alle `.from("sales")` queries i filen: tilfoej `.neq("validation_status", "rejected")`
- Gaelder: CPH dashboard (~linje 59, 255, 290), team dashboard (~linje 677, 1090), CS Top 20 (~linje 2264-2330 alle period-queries)

**`supabase/functions/league-calculate-standings/index.ts`** -- 2 steder:
- Telesales query (~linje 183): tilfoej `.neq("validation_status", "rejected")`
- FM sales query (~linje 211): tilfoej `.neq("validation_status", "rejected")`

---

### Resultat

| Status | Taeller med? |
|---|---|
| `NULL` | Ja |
| `pending` | Ja |
| `approved` | Ja |
| `cancelled` | Ja |
| `rejected` | **Nej** -- fratrukket overalt |

Alle viste tal i hele systemet (dashboards, TV-boards, KPI-cache, leaderboards, dagsrapporter, loenberegning, head-to-head, sales feed, salgsmaal) vil konsekvent udelukke afviste salg.

