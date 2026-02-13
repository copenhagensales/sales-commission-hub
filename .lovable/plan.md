

# Komplet fix: Pricing rules ikke anvendt korrekt + historisk data-rettelse

## Overblik over fundne problemer

### Problem A: 673 sale_items med forkerte mapped_commission/mapped_revenue (historisk data)
Der er 673 sale_items med universelle prisregler (ingen kampagne-begransning) der aldrig er blevet rematched korrekt. Derudover er der 129 sale_items med `needs_mapping = true` der aldrig er blevet behandlet overhovedet. Disse stammer fra december 2025 og tidligere.

**Losning**: Kald `rematch-pricing-rules` edge function for at rette historiske data. Alternativt kores en SQL-opdatering direkte.

### Problem B: 7 frontend-filer bruger forkert pricing-logik

Fejlene falder i to kategorier:

---

## Kategori 1: FM-salg bruger `products.commission_dkk`/`revenue_dkk` direkte (ignorerer pricing rules)

Disse 5 filer slaar FM-produktpriser op direkte fra `products`-tabellen i stedet for at tjekke `product_pricing_rules` foerst:

| Fil | Paavirkede tal |
|-----|---------------|
| `src/pages/reports/RevenueByClient.tsx` (linje 262-273) | FM omsaetning/provision i rapport |
| `src/components/salary/ClientDBTab.tsx` (linje 495-521 + 733-770) | FM daeknigsbidrag (2 steder!) |
| `src/components/employee/EmployeeCommissionHistory.tsx` (linje 210-226) | Medarbejders FM-provision |
| `src/components/dashboard/DailyRevenueChart.tsx` (linje 135-151) | FM-soejler i daglig graf |
| `src/hooks/useDashboardKpiData.ts` (linje 241-259) | KPI-tiles "Omsaetning" |

### Kategori 2: TM-salg override maps ignorerer universelle regler (campaign_mapping_ids = null)

Disse 3 filer bygger override-maps der KUN inkluderer kampagne-specifikke regler og ignorerer universelle regler:

| Fil | Paavirkede tal |
|-----|---------------|
| `src/components/home/HeadToHeadComparison.tsx` (linje 551-563) | Head-to-Head konkurrence |
| `src/components/dashboard/DailyRevenueChart.tsx` (linje 68-88) | TM daglig omsaetning |
| `src/pages/reports/RevenueByClient.tsx` (linje 231-245) | TM omsaetning pr. klient |

### Kategori 3: KPI "sales-revenue" bruger `products.revenue_dkk` i stedet for `mapped_revenue`

`useDashboardKpiData.ts` (linje 241-259) joiner `products!inner(revenue_dkk)` direkte i stedet for at bruge `sale_items.mapped_revenue` som allerede er korrekt sat af backend-rematchen.

---

## Loesningsplan

### Trin 1: Opret faelles pricing-helper (ny fil)

Opret `src/lib/calculations/fmPricing.ts` med en genbrugelig funktion der implementerer det korrekte hierarki for FM-produkter:

```text
async function buildFmPricingMap(supabase): Map<string, { commission: number; revenue: number }>
  1. Hent alle products (base prices)
  2. Hent aktive product_pricing_rules (sorteret efter priority desc)
  3. For hver regel: override base price (hoejeste priority vinder)
  4. Returner map: product_name (lowercase) -> { commission, revenue }
```

Denne logik er identisk med backend `pricing-service.ts` og med `useDashboardSalesData.ts` linje 346-366.

### Trin 2: Opret faelles TM override-helper

Opret en hjalpefunktion der bygger en override-map der inkluderer BAADE kampagne-specifikke OG universelle regler:

```text
function buildTmOverrideMap(pricingRules): 
  Map<string, { commission: number; revenue: number }>
  
  For hvert produkt:
    1. Check kampagne-specifik regel (product_id + campaign_mapping_id)
    2. Fallback til universel regel (campaign_mapping_ids = null/tom)
    3. Ellers: brug mapped_commission/mapped_revenue fra sale_items
```

### Trin 3: Ret `useDashboardKpiData.ts` - "sales-revenue" og "avg-order-value"

Aendr fra `products!inner(revenue_dkk)` til `mapped_revenue` fra `sale_items`:

```text
// FRA (forkert):
sale_items(quantity, product_id, products!inner(revenue_dkk))
revenue = item.products.revenue_dkk * quantity

// TIL (korrekt):
sale_items(quantity, mapped_revenue)
revenue = item.mapped_revenue  // allerede korrekt sat af backend rematch
```

### Trin 4: Ret FM-pricing i 4 filer

Erstat direkte `products.commission_dkk`/`revenue_dkk` lookup med den nye `buildFmPricingMap()`:

- `RevenueByClient.tsx` (linje 262-273, 337-338)
- `ClientDBTab.tsx` (linje 495-521, 733-771) - 2 steder
- `EmployeeCommissionHistory.tsx` (linje 210-226, 325)
- `DailyRevenueChart.tsx` (linje 135-151)

### Trin 5: Ret TM override maps i 3 filer

Tilfoej universelle regler (null campaign) til override-maps:

- `HeadToHeadComparison.tsx` (linje 551-563)
- `DailyRevenueChart.tsx` (linje 68-88)
- `RevenueByClient.tsx` (linje 231-245)

For alle 3: Aendr logikken sa regler med `campaign_mapping_ids = null` ogsa inkluderes som fallback.

### Trin 6: Ret historiske data

Kald `rematch-pricing-rules` for at genberegne alle sale_items. Dette vil:
- Rette de 673 sale_items med forkerte mapped vaerdier
- Behandle de 129 sale_items med `needs_mapping = true`
- Sikre at alle historiske data matcher de aktuelle prisregler

### Trin 7: Verificering

Sammenlign vaerdier paa tvaers af alle dashboards for at sikre konsistens. Saerligt:
- KPI-tiles vs. DailyRevenueChart vs. RevenueByClient
- FM-provision i ClientDBTab vs. EmployeeCommissionHistory
- Head-to-Head tal vs. dashboard

## Tekniske detaljer

**Hvorfor `mapped_revenue`/`mapped_commission` er korrekt for TM**: Backend `rematch-pricing-rules` koerer allerede ved prisregel-aendringer og saetter `mapped_commission` og `mapped_revenue` korrekt paa `sale_items`, inklusive kampagne-specifikke og universelle regler med conditions-matching. Frontend behover derfor IKKE at gentage denne logik for TM-salg - den skal blot bruge de allerede beregnede vaerdier.

**Hvorfor FM kraever separat logik**: FM-salg har IKKE `sale_items` - de er enkelte poster i `sales`-tabellen med produktnavnet i `raw_payload.fm_product_name`. Derfor skal FM-pricing slaaes op via produktnavn mod pricing rules/products.

**Filer der allerede er korrekte** (reference-implementeringer):
- `useDashboardSalesData.ts` - bruger `findMatchingRule()` for TM og pricing-aware maps for FM
- `DailyReports.tsx` - bruger `findMatchingRule()` med korrekt fallback
- Backend `pricing-service.ts` og `rematch-pricing-rules` - korrekt hierarki

