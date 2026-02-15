

# Komplet systemdækkende salgsdata-optimering - Verificeret plan

## Overblik

Tre typer problemer forårsager manglende salgsdata:

1. **Non-deterministisk pagination** i `fetchAllRows` - sorterer kun på én kolonne, men FM-salg har 100+ rækker med identisk timestamp
2. **Manuelle pagination-loops UDEN ORDER BY** - PostgreSQL returnerer rækker i vilkårlig rækkefølge
3. **Direkte queries uden pagination** - rammer 1000-rækkers grænsen

Alle ændringer er verificeret mod eksisterende imports, join-selects og hook-afhængigheder.

---

## Ændring 1: `src/utils/supabasePagination.ts` (1 linje)

**Linje 52**: Tilføj sekundær sort for deterministisk pagination.

```text
Før:
  .order(orderBy, { ascending })
  .range(offset, offset + pageSize - 1);

Efter:
  .order(orderBy, { ascending })
  .order("id", { ascending: true })
  .range(offset, offset + pageSize - 1);
```

**Virkning**: Fikser automatisk alle 20 filer der bruger `fetchAllRows` - inkl. `useSalesAggregates.ts`, `DailyReports.tsx`, `FieldmarketingDashboard.tsx`, `useKpiTest.ts`, `ClientDBTab.tsx`, osv. Alle tabeller der bruges med denne utility (`sales`, `sale_items`, `employee_agent_mapping`, `team_clients`) har en `id`-kolonne - verificeret.

---

## Ændring 2: `src/pages/dashboards/CphSalesDashboard.tsx` (2 steder)

Filen importerer allerede `fetchAllRows` (linje 4).

**Linje 357-380**: Manuel TM-salgs loop UDEN `.order()` - erstat med `fetchAllRows`.
- Select: `id, agent_name, sale_datetime, status, client_campaign_id, sale_items(quantity, product_id, mapped_commission, products(counts_as_sale))`
- Filtre: `.gte("sale_datetime", startOfPeriod).lte("sale_datetime", endOfPeriod)`
- Resten af funktionen (campaignIds, clientLogoMap, countSales-logik fra linje 382+) forbliver uændret.

**Linje 644-659**: Manuel månedssalg loop UDEN `.order()` - erstat med `fetchAllRows`.
- Select: `id, agent_name, agent_email, sale_datetime, client_campaign_id, client_campaigns(client_id, clients(name))`
- Filtre: `.gte/.lte` på månedsdatoer
- Efterfølgende `sale_items` batch-fetch (linje 661-674) via `fetchByIds` for konsistens - bevarer al eksisterende counts_as_sale logik.

---

## Ændring 3: `src/pages/reports/RevenueByClient.tsx` (2 steder)

Mangler import af `fetchAllRows` - tilføjes.

**Linje 174-197**: Manuel TM-salgs loop UDEN `.order()` - erstat med `fetchAllRows`.
- Select: `id, sale_datetime, client_campaign_id, client_campaigns(client_id, clients(id, name)), dialer_campaign_id`
- Efterfølgende `sale_items` batch-fetch (linje 199-213) bevares - bruger allerede korrekt batching.
- Al produktprisregel-logik (linje 225-259) forbliver uændret.

**Linje 269-274**: Direkte FM-query UDEN pagination - erstat med `fetchAllRows`.
- Select: `id, sale_datetime, raw_payload`
- Filter: `.eq("source", "fieldmarketing")`
- `buildFmPricingMap()` kald (linje 277-278) og produktmapping (linje 280-286) forbliver uændret.

---

## Ændring 4: `src/pages/UnitedDashboard.tsx` (2 steder)

Tilføj import af `fetchAllRows`.

**Linje 196-201**: `monthSales` direkte query - erstat med `fetchAllRows`.
- `todaySales` og `weekSales` forbliver direkte queries (aldrig 1000+ på en dag/uge per klient).
- `monthSales` kan overstige 1000 for store klienter over en lønperiode.
- `countSales`-funktionen (linje 204-215) og hele return-objektet forbliver uændret.

**Linje 255-259**: Agent email lookup - erstat med `fetchAllRows`.
- Select: `agent_email`
- Efterfølgende agent-lookup og shift-beregning (linje 261+) forbliver uændret.

---

## Ændring 5: `src/components/api-overview/ApiDataOverview.tsx` (1 sted)

Tilføj import af `fetchAllRows`.

**Linje 117-154**: Manuel pagination loop - HAR `.order()` men mangler sekundær sort. Erstat med `fetchAllRows`.
- Select: alle de nuværende felter (id, adversus_external_id, agent_name, osv.)
- Filter: `.ilike("source", effectiveProvider)`
- Resten af komponenten forbliver uændret.

---

## Ændring 6: `src/hooks/useRecognitionKpis.ts` (1 sted)

Tilføj import af `fetchAllRows`.

**Linje 95-110**: Direkte query på `sale_items` med inner join.
- Select: `id, mapped_commission, sales!inner(id, sale_datetime, agent_email, agent_name, status)`
- Filtre: `.gte/.lte` på `sales.sale_datetime` + `.eq("sales.status", "approved")`
- Verificeret: `sale_items` tabellen har en `id` kolonne - `fetchAllRows` virker.
- Efterfølgende agent mapping og beregningslogik (linje 116+) forbliver uændret.

---

## Ændring 7: `src/hooks/useNormalizedSalesData.ts` (1 sted)

Tilføj import af `fetchByIds`.

**Linje 24-27**: Direkte `.in("id", saleIds)` - erstat med `fetchByIds`.
- Håndterer korrekt 1000+ sale IDs ved at chunke i batches af 200.
- Return-mapping (linje 30-34) forbliver uændret.

---

## Ændring 8: `src/hooks/useClientPeriodComparison.ts` (1 sted)

Tilføj import af `fetchAllRows`.

**Linje 98-107**: Direkte query henter alle salg i en hel lønperiode (4000+ rækker).
- Select: `id, client_campaign_id, client_campaigns!inner(client_id), sale_items(mapped_revenue, products(counts_as_sale))`
- Al efterfølgende revenue/sales-beregning (linje 114-142) forbliver uændret - bruger `counts_as_sale` og `mapped_revenue` korrekt.

---

## Ændring 9: `src/components/employee/EmployeeCommissionHistory.tsx` (2 steder)

Tilføj import af `fetchAllRows`.

**Linje 160-174**: TM-salg per medarbejder - erstat med `fetchAllRows`.
- Select bevarer alle joins: `sale_items(mapped_commission, quantity, products(counts_as_sale))`
- `.in("agent_email", agentEmails)` filter flyttes til `fetchAllRows` filters callback.

**Linje 186-192**: FM-salg per medarbejder - erstat med `fetchAllRows`.
- `.contains("raw_payload", { fm_seller_id: employeeId })` filter bevares.
- Transform-mapping (linje 195-206) forbliver uændret.

---

## Verifikation: Hvad forbliver uændret

| Aspekt | Status |
|--------|--------|
| `counts_as_sale` produkt-logik | Uændret i alle filer |
| `mapped_commission` / `mapped_revenue` værdier | Bruges direkte (præ-multipliceret) |
| `buildFmPricingMap()` FM-prisregler | Uændret |
| `product_pricing_rules` kampagne-overrides | Uændret i RevenueByClient |
| `client_campaigns` -> `clients` joins | Bevaret i alle selects |
| `employee_agent_mapping` lookups | Uændret |
| Hook queryKeys og staleTime | Uændret |
| useQuery enabled/refetchInterval | Uændret |
| FM `raw_payload` nøgler (fm_seller_id, fm_client_id, fm_product_name) | Uændret |

## Samlet oversigt

| Fil | Ændringer | Nye imports |
|-----|-----------|-------------|
| `supabasePagination.ts` | 1 linje | Ingen |
| `CphSalesDashboard.tsx` | 2 loops -> fetchAllRows | Har allerede |
| `RevenueByClient.tsx` | 2 steder | + fetchAllRows |
| `UnitedDashboard.tsx` | 2 steder | + fetchAllRows |
| `ApiDataOverview.tsx` | 1 loop -> fetchAllRows | + fetchAllRows |
| `useRecognitionKpis.ts` | 1 query -> fetchAllRows | + fetchAllRows |
| `useNormalizedSalesData.ts` | 1 query -> fetchByIds | + fetchByIds |
| `useClientPeriodComparison.ts` | 1 query -> fetchAllRows | + fetchAllRows |
| `EmployeeCommissionHistory.tsx` | 2 queries -> fetchAllRows | + fetchAllRows |

**Total: 13 ændringer i 9 filer. Al forretningslogik, produktregler og datamapping bevares.**
