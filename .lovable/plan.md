

## Fuld auto-opdatering af alle regelændringer på MgTest-siden

### 1. Database — kampagne include/exclude
Tilføj på `product_pricing_rules` og `pricing_rule_history`:
- `campaign_match_mode TEXT NOT NULL DEFAULT 'include'` (CHECK: `'include' | 'exclude'`)

Eksisterende rækker = `'include'` → uændret adfærd.

### 2. UI — kampagne-toggle i editor

**`PricingRuleEditor.tsx`**
- `RadioGroup` over kampagne-multivælgeren:
  - "Kun for valgte kampagner" (default)
  - "For alle kampagner UNDTAGEN valgte"
- Skjules når 0 kampagner valgt
- Inkluderes i upsert + `pricing_rule_history`

**`ProductPricingRulesDialog.tsx`**
- Vis i listen: "Kampagner: X, Y" eller "Alle undtagen: X, Y"

### 3. Matching-logik (alle forbrugere)
```
ids = rule.campaign_mapping_ids
if ids null/tom:           match (universel)
else if mode = 'include':  match hvis campaignId ∈ ids
else if mode = 'exclude':  match hvis campaignId ∉ ids
```

Opdateres i:
- `src/hooks/useDashboardSalesData.ts`
- `src/pages/reports/DailyReports.tsx`
- `src/components/dashboard/DailyRevenueChart.tsx`
- `supabase/functions/rematch-pricing-rules/index.ts`
- `supabase/functions/_shared/pricing-service.ts`
- `src/lib/calculations/fmPricing.ts` (udvides — se punkt 4)

### 4. FM-pricing — kampagne-aware
`fmPricing.ts` (async + sync) udvides:
- Returnerer lookup-funktion `(productName, campaignMappingId?) => FmPricing`
- Iterér regler efter prioritet, evaluér mod `campaignMappingId` med include/exclude
- Bagudkompatibel uden `campaignMappingId`

Kald-sites opdateres til at sende `client_campaign_id` (søges via `code--search_files`).

### 5. Centralt auto-rematch + invalidation hook (NYT)

**Ny hook `useMgTestMutationSync`** der wrapper enhver mutation på MgTest-siden:
- Kører rematch (når relevant for pricing)
- Invaliderer komplet query-set
- Kalder `calculate-kpi-incremental` edge function
- Viser toast med progress

**Anvendes på ALLE mutationer på MgTest-siden:**

| Komponent | Mutation | Trigger rematch | Invalidation-set |
|---|---|---|---|
| `PricingRuleEditor` | create/update/delete prisregel | ✅ ja (fra `effective_from`) | pricing + sales + KPI |
| `ProductPriceEditDialog` | basispris-ændring | ✅ ja (eksisterer, udvides) | pricing + sales + KPI |
| `ProductCampaignOverrides` | upsert/delete override | ✅ ja | pricing + sales + KPI |
| `ProductMergeWizard` | merge/unmerge produkter | ✅ ja | products + pricing + sales |
| `IntegrationMappingEditor` | gem felt-mapping | ❌ nej | mappings + field-defs |
| `FieldDefinitionsManager` / `FieldDefinitionDialog` | create/update/delete felt | ❌ nej | field-defs + mappings |
| `CampaignSuggestionDialog` (godkend) | upsert kampagne→klient | ✅ ja | campaign-mappings + sales + KPI |
| Adversus product-mapping (manuel) | upsert mapping | ✅ ja | product-mappings + sales + KPI |
| Counting-product toggle | update `products.counts_in_kpi` | ❌ nej (kun KPI) | products + KPI cache |

### 6. Komplet invalidation-set
Defineret centralt i hook:
```
pricing:    ["pricing-rules", "product-pricing-rules", "product-campaign-overrides"]
products:   ["mg-aggregated-products", "mg-manual-products", "products", "needs-mapping"]
sales:      ["dashboard-sales-data", "daily-revenue-chart", "daily-reports", "sales-aggregates"]
mappings:   ["adversus-campaign-mappings", "adversus-product-mappings", "client-campaigns"]
fielddefs:  ["data-field-definitions", "integration-field-mappings"]
kpi:        invokér calculate-kpi-incremental
```

### 7. Realtime broadcast på tværs af sessioner
- `rematch-pricing-rules` poster `pricing_rules_updated`-event på Supabase realtime-kanal når færdig
- Nyt frontend-hook `useMgTestRealtimeSync` (mountet i App-niveau) abonnerer og invaliderer relevante queries i alle åbne sessioner/browsere/TV-dashboards
- Sikrer at andre brugeres dashboards opdateres uden refresh

### 8. Progress-toast under rematch
- "Opdaterer X salg…" → "Færdig: Y salg opdateret"
- Eksisterende `useRematchPricingRules` udvides med progress-callback

### Hvad jeg IKKE rører
- Default-adfærd for eksisterende regler (`include`)
- Snapshot-tabeller (`kpi_period_snapshots`) — historiske, må ikke auto-overskrives
- RLS, FM-attribuering, andre integrationer
- `product_campaign_overrides`-mekanismen (bevares parallelt med prisregler)

