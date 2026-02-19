

# Samlet implementeringsplan -- Alt der mangler

## Status-overblik

| Fase | Status |
|------|--------|
| Fase 1: Database triggers (enrich + create_fm_sale_items) | DONE |
| Fase 2: Shared utilities (payrollPeriod, formatting, useEmployeeAvatars) | DONE |
| Fase 3: ClientDashboard (Eesy, TDC, Relatel migreret; United delvist) | DONE |
| Fase 4: DashboardShell | DONE |
| Fase 5.1-5.4: Edge function cleanup (KPI, leaderboard, league, tv-dashboard-data) | DONE |
| Fase 5.5-5.6: fmPricing + FM_CLIENT_CAMPAIGN_MAP fjernelse | MANGLER |
| Rettigheds-fixes (system_roles sync, can_manage_permissions, RLS, CS Top 20 RPC) | MANGLER |
| CphSalesDashboard FM-oprydning | MANGLER |
| CsTop20Dashboard RPC-migration | MANGLER |
| Remaining payroll-duplikater | MANGLER |
| MyProfile FM dobbelt-logik | MANGLER |
| Fase 6: Observability | MANGLER |

---

## Del A: Database-migration

### A1: system_roles sync
Engangs-upsert af manglende `system_roles`-raekker baseret paa `job_positions.system_role_key`. Rydder 83% ude-af-sync problemet.

### A2: Trigger-opdatering
`sync_system_role_from_job_title` udvides til ogsaa at fyre paa `position_id`-aendringer og prioritere `job_positions`-mapping foer `job_title` fallback.

### A3: can_manage_permissions fix
Tilfoej fallback via `job_positions`-tabellen saa teamledere uden system_roles-raekke kan administrere rettigheder.

### A4: CS Top 20 RPC
Ny `SECURITY DEFINER`-funktion `get_cs_top20_custom_period_leaderboard` der giver alle brugere med dashboard-adgang data for custom perioder (omgaar sales RLS).

### A5: Teams RLS oprydning
Fjern 2 redundante SELECT-politikker: "Anon can read teams" og "Teamledere og ejere kan se teams".

---

## Del B: CphSalesDashboard oprydning

### B1: Fjern FM-duplikering
- Slet `fmTodaySales`-query (linje 302-349)
- Slet FM-blokken i team performance (linje 798-846)
- Fjern FM fra `calculateSellersOnBoard`
- Fjern FM fra `getSalesByClientWithLogos`
- Fjern `+ fmTodaySales.length` fra `displaySalesTotal`

### B2: Brug delt payroll-utility
Erstat lokal `getPayrollPeriod()` (linje 24-40) med `import { calculatePayrollPeriod } from "@/utils/payrollPeriod"`.

### B3: Tilfoej validation_status filter
Tilfoej `.neq("validation_status", "rejected")` til team performance-queryen.

### B4: Fjern ubrugt kode
Slet `calculateTopSellers()` og `countWorkDaysInOverlap`.

**Forventet reduktion:** ~250 linjer

---

## Del C: CsTop20Dashboard RPC-migration

Erstat 80+ linjer direkte `sales`/`agents`/`employee_master_data`-queries i `useCustomPeriodLeaderboard` med et enkelt RPC-kald til `get_cs_top20_custom_period_leaderboard`.

---

## Del D: Payroll-duplikat oprydning

Foelgende filer har stadig lokale kopier af `getPayrollPeriod`:

| Fil | Handling |
|-----|---------|
| `FieldmarketingDashboardFull.tsx` (linje 24-40) | Erstat med import fra `@/utils/payrollPeriod` eller `@/lib/calculations/dates` |
| `DashboardDateRangePicker.tsx` (linje 17-33) | Erstat med import |
| `DBPeriodSelector.tsx` (linje 31-44) | Erstat med import |
| `PayrollPeriodSelector.tsx` | Erstat med import |

---

## Del E: MyProfile FM dobbelt-logik

`MyProfile.tsx` (linje 738-797) henter FM-salg **separat** via `raw_payload->fm_seller_id` og beregner commission manuelt via `products.commission_dkk`. Nu hvor triggerne opretter `sale_items` med korrekt `mapped_commission`, boer denne logik erstattes:

- FM-salg for en medarbejder kan hentes via `agent_email` i stedet for `raw_payload->fm_seller_id` (triggeren saetter `agent_email`)
- Commission laeses fra `sale_items.mapped_commission` i stedet for manuelt product-opslag
- Fjern den separate FM-blok og lad den eksisterende TM-logik haandtere begge

---

## Del F: fmPricing.ts oprydning (Fase 5.5)

`buildFmPricingMap()` bruges stadig i 5 filer:

| Fil | Brug | Handling |
|-----|------|---------|
| `EditSalesRegistrations.tsx` | Opretter/opdaterer sale_items med pricing | **Behold** -- CRUD-flow skal stadig slaa priser op ved oprettelse |
| `DailyRevenueChart.tsx` | FM revenue beregning | Erstat med `sale_items.mapped_revenue` |
| `RevenueByClient.tsx` | FM commission/revenue per klient | Erstat med `sale_items.mapped_commission/mapped_revenue` |
| `EmployeeCommissionHistory.tsx` | FM commission per dag | Erstat med `sale_items.mapped_commission` |
| `ClientDBTab.tsx` (salary) | FM commission/revenue per klient | Erstat med `sale_items.mapped_commission/mapped_revenue` |

**Konklusion:** `fmPricing.ts` kan **ikke** slettes endnu -- `EditSalesRegistrations.tsx` har brug for den til CRUD. Men de 4 andre filer kan migreres til at bruge `sale_items` direkte.

---

## Del G: FM_CLIENT_CAMPAIGN_MAP fjernelse (Fase 5.6)

`useFieldmarketingSales.ts` bruger `FM_CLIENT_CAMPAIGN_MAP` til at mappe `client_id` -> `client_campaign_id` ved oprettelse af FM-salg. Denne mapping haandteres nu af `enrich_fm_sale`-triggeren via `raw_payload->fm_client_id`.

**Handling:** Fjern `FM_CLIENT_CAMPAIGN_MAP` og `clientCampaignId`-tildelingen i `useCreateFieldmarketingSale`. Triggeren saetter `client_campaign_id` automatisk.

---

## Del H: Observability (Fase 6)

### H1: Health checks i System Stability
Tilfoej panel med:
- Salg uden sale_items (alle sources, med gyldigt produkt)
- Trigger success rate (FM salg vs FM items, 24t)
- Umatched produktnavne
- pg_net fejl

---

## Implementeringsraekkfoelge

```text
1. Del A: Database-migration (alle steps i en migration)
2. Del B + C: CphSalesDashboard + CsTop20Dashboard (frontend, parallel)
3. Del D: Payroll-duplikater (simpel import-swap)
4. Del E: MyProfile FM-oprydning
5. Del F: fmPricing-afhaengigheder (4 filer migreres til sale_items)
6. Del G: FM_CLIENT_CAMPAIGN_MAP fjernelse
7. Del H: Observability health checks
```

## Risiko-vurdering

| Del | Risiko | Begrundelse |
|-----|--------|-------------|
| A (migration) | Lav | Upsert + fallback-logik |
| B (CphSales) | Lav | Phase 1-triggers aktive |
| C (CsTop20) | Middel | Ny RPC -- kraever test |
| D (payroll) | Ingen | Import-swap |
| E (MyProfile) | Middel | Medarbejderes egen data -- kraever praecis test |
| F (fmPricing) | Lav | Laes fra sale_items i stedet |
| G (FM_MAP) | Lav | Trigger haandterer mapping |
| H (observability) | Ingen | Additivt |

## Forventet netto-effekt
- ~400 linjer fjernet
- 5 duplikerede `getPayrollPeriod`-kopier elimineret
- 80+ medarbejdere faar korrekte system_roles
- CS Top 20 custom perioder virker for alle
- FM-salg taelles kun en gang i CphSalesDashboard
- MyProfile viser korrekt FM-commission via sale_items

