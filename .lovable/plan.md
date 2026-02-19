

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
| MyProfile FM dobbelt-logik | MANGLER |
| Del F: fmPricing migration (4 filer til sale_items) | MANGLER |
| Fase 6: Observability | MANGLER |

---

## Resterende opgaver

### Del E: MyProfile FM dobbelt-logik
`MyProfile.tsx` henter FM-salg separat via `raw_payload->fm_seller_id` og beregner commission manuelt. Skal erstattes med `sale_items.mapped_commission`.

### Del F: fmPricing migration (4 filer)
Disse filer bruger stadig `buildFmPricingMap()` til read-only formaal og kan migreres til `sale_items`:
- `DailyRevenueChart.tsx`
- `RevenueByClient.tsx`
- `EmployeeCommissionHistory.tsx`
- `ClientDBTab.tsx`

(`EditSalesRegistrations.tsx` beholder `buildFmPricingMap()` til CRUD)

### Del H: Observability
Health checks i System Stability-panelet.
