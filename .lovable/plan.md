
# Konsolider FM-produkter i sale_items - Komplet Plan

## KRITISK FUND: Dobbelt-tælling risiko

Under grundig gennemgang fandt jeg at **7 filer med ~12 forespørgsler** ville dobbelt-tælle eller fejlagtigt inkludere FM-salg, hvis vi blot tilføjer `sale_items` uden at beskytte eksisterende logik.

**Årsag:** Mange dashboards tæller salg via `sale_items` OG tæller FM separat. FM-salg har `client_campaign_id` sat (f.eks. "Eesy gaden"), så de ville blive fanget af begge tællinger.

**Eksempel fra `useDashboardKpiData.ts`:**
- Linje 550-566: Tæller salg via `sale_items` (filtreret på `client_campaign_id`) -- FM ville nu tælles her
- Linje 570-579: Tæller FM separat via `source = 'fieldmarketing'` -- FM tælles IGEN
- Linje 581: `return telesalesCount + fieldmarketingCount` -- DOBBELT TÆLLING!

## Løsning: Tilføj eksklusions-filter

Vi tilføjer `.neq("source", "fieldmarketing")` til alle eksisterende `sale_items`-baserede forespørgsler, så FM fortsat kun tælles via sin dedikerede logik.

---

## Trin 1: SQL-migration

Indsæt `sale_items` for alle 3.487 eksisterende FM-salg:

```sql
INSERT INTO sale_items (sale_id, adversus_product_title, display_name, quantity, mapped_commission, mapped_revenue)
SELECT 
  s.id,
  s.raw_payload->>'fm_product_name',
  s.raw_payload->>'fm_product_name',
  1, 0, 0
FROM sales s
WHERE s.source = 'fieldmarketing'
  AND NOT EXISTS (SELECT 1 FROM sale_items si WHERE si.sale_id = s.id)
  AND s.raw_payload->>'fm_product_name' IS NOT NULL;
```

---

## Trin 2: Beskyt eksisterende forespørgsler mod dobbelt-tælling

### Filer med DOBBELT-TÆLLING risiko (har separat FM-tælling + sale_items):

**A. `src/hooks/useDashboardKpiData.ts`** (3 steder)
- Linje ~187: Tilføj `.neq("source", "fieldmarketing")` til sales-query
- Linje ~554: Tilføj `.neq("source", "fieldmarketing")` til sales-query
- Linje ~977: Tilføj `.neq("source", "fieldmarketing")` til sales-query

**B. `src/hooks/useKpiTest.ts`** (1 sted)
- Linje ~171: Tilføj `&source=neq.fieldmarketing` til URL-baseret query

**C. `src/components/kpi/FormulaLiveTest.tsx`** (2 steder)
- `total_sales` blok (~linje 403): Tilføj `&source=neq.fieldmarketing`
- `total_commission` blok (~linje 463): Tilføj `&source=neq.fieldmarketing`

**D. `supabase/functions/calculate-leaderboard-incremental/index.ts`** (1 sted)
- `fetchAllSalesWithItems` (~linje 166): Tilføj `.neq("source", "fieldmarketing")`

**E. `src/components/salary/ClientDBTab.tsx`** (2 steder)
- Linje ~477: Tilføj `.neq("source", "fieldmarketing")` til telesales-query
- Linje ~728: Tilføj `.neq("source", "fieldmarketing")` til tilsvarende query

### Filer med NY TÆLLING risiko (ingen separat FM, men sale_items ville nu inkludere FM):

**F. `src/pages/UnitedDashboard.tsx`** (3 queries)
- Linje ~185, ~190, ~195: Tilføj `.neq("source", "fieldmarketing")` til alle tre

**G. `src/hooks/useSalesAggregates.ts`** (1 sted)
- Tilføj source-filter i `fetchAllRows` callback

### Filer der er SIKRE (ingen adfærdsændring):
- `DailyRevenueChart.tsx` -- bruger kun revenue (FM = 0, neutral)
- `useClientPeriodComparison.ts` -- bruger truthy-check, FM products = null = falsy

---

## Trin 3: Opdater FM-salgsregistrering

**`src/hooks/useFieldmarketingSales.ts`** - `useCreateFieldmarketingSale`:
- Ændr `.insert(enrichedSales)` til `.insert(enrichedSales).select()` for at få ID'er retur
- Indsæt `sale_items`-række per nyt salg med `display_name` = produktnavn, `quantity` = 1

---

## Trin 4: Opdater redigering af FM-salg

**`src/pages/vagt-flow/EditSalesRegistrations.tsx`**:

- **Enkelt-redigering (~linje 260):** Efter opdatering af `raw_payload.fm_product_name`, upsert tilhørende `sale_items`
- **Gruppe-redigering - opdatering (~linje 337):** Opdater også tilhørende `sale_items`
- **Gruppe-redigering - oprettelse (~linje 385):** Brug `.insert().select()` og opret `sale_items`
- **Sletning:** CASCADE-constraint på `sale_items.sale_id` håndterer automatisk oprydning

---

## Trin 5: CancellationDialog sikkerhedsnet

**`src/components/cancellations/CancellationDialog.tsx`**:
- Ændr linje 287 fra `saleItems.length > 0 && !allCancelled` til `!allCancelled`
- Sikrer at annulleringsknapper vises selv hvis et salg undtagelsesvist mangler items

---

## Samlet oversigt over ændringer

| Fil | Ændring | Formål |
|-----|---------|--------|
| SQL migration | INSERT sale_items for 3.487 FM-salg | Historisk data |
| `useDashboardKpiData.ts` | 3x `.neq("source", "fieldmarketing")` | Undgå dobbelt-tælling |
| `useKpiTest.ts` | 1x source-filter | Undgå dobbelt-tælling |
| `FormulaLiveTest.tsx` | 2x source-filter | Undgå dobbelt-tælling |
| `calculate-leaderboard-incremental` | 1x `.neq("source", "fieldmarketing")` | Undgå dobbelt-tælling |
| `ClientDBTab.tsx` | 2x `.neq("source", "fieldmarketing")` | Undgå dobbelt-tælling |
| `UnitedDashboard.tsx` | 3x `.neq("source", "fieldmarketing")` | Undgå nye forkerte tællinger |
| `useSalesAggregates.ts` | 1x source-filter | Undgå nye forkerte tællinger |
| `useFieldmarketingSales.ts` | Opret sale_items ved nye salg | Fremtidige salg |
| `EditSalesRegistrations.tsx` | Sync sale_items ved redigering | Hold data synkront |
| `CancellationDialog.tsx` | Vis knapper altid | Sikkerhedsnet |

## Hvad forbliver uændret
- `raw_payload` beholdes intakt (bruges stadig til FM-provision/omsætning)
- Al FM-specifik provisions-beregning via `product_pricing_rules` forbliver
- FM dashboards (`FieldmarketingDashboardFull.tsx`, `FieldmarketingDashboard.tsx`) uændret
- `DailyReports.tsx`, `EmployeeCommissionHistory.tsx`, `MyProfile.tsx` -- uændret
- `DailyRevenueChart.tsx`, `useClientPeriodComparison.ts` -- sikre uden ændringer
