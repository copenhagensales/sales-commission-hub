

# Samlet implementeringsplan -- Alt der mangler

## Status-overblik

| Fase | Status |
|------|--------|
| Fase 1: Database triggers (enrich + create_fm_sale_items) | DONE |
| Fase 2: Shared utilities (payrollPeriod, formatting, useEmployeeAvatars) | DONE |
| Fase 3: ClientDashboard (Eesy, TDC, Relatel migreret; United delvist) | DONE |
| Fase 4: DashboardShell | DONE |
| Fase 5.1-5.4: Edge function cleanup (KPI, leaderboard, league, tv-dashboard-data) | DONE |
| Fase 5.5-5.6: fmPricing + FM_CLIENT_CAMPAIGN_MAP fjernelse | DONE |
| Rettigheds-fixes (system_roles sync, can_manage_permissions, RLS, CS Top 20 RPC) | DONE |
| CphSalesDashboard FM-oprydning | DONE |
| CsTop20Dashboard RPC-migration | DONE |
| Remaining payroll-duplikater | DONE |
| MyProfile FM dobbelt-logik | DONE |
| Del F: fmPricing migration (4 filer til sale_items) | DONE |
| Fase 6: Observability | DONE |

---

## Afsluttede opgaver (seneste iteration)

### Del E: MyProfile FM dobbelt-logik
Erstattet manuel FM commission-beregning via `products.commission_dkk` med `sale_items.mapped_commission` (oprettet af DB trigger).

### Del F: fmPricing migration (4 filer)
- `DailyRevenueChart.tsx`: Fjernet separat FM-blok (main query inkluderer allerede FM via sale_items)
- `RevenueByClient.tsx`: Fjernet `buildFmPricingMap` import og FM processing-blok
- `EmployeeCommissionHistory.tsx`: Erstattet FM raw_payload + fmPricingMap med sale_items.mapped_commission
- `ClientDBTab.tsx`: Fjernet `.neq("source", "fieldmarketing")` filter og separat FM-blok i begge queries

(`EditSalesRegistrations.tsx` beholder `buildFmPricingMap()` til CRUD)

### Del H: Observability
Tilføjet `DataHealthChecks` komponent til System Stability med:
- Salg uden sale_items (24t)
- FM trigger success rate (24t)
- Ukendte produkter (24t)
- Afvist-rate (24t)
