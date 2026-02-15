

# Udfyld FM sale_items med korrekte provisioner

## Status efter forrige aendring
- 3.487 FM sale_items er oprettet med `mapped_commission = 0` og `mapped_revenue = 0`
- Alle FM produktnavne matcher korrekt mod `products`-tabellen (0 ukendte)
- `product_id` er NULL paa alle FM sale_items (ingen FK-kobling)

## Verificerede fund

### Provision (commission) - INGEN dobbelt-taelling risiko
De tre `commission`-cases i `useDashboardKpiData.ts` (linje 420, 586, 1160) summerer `mapped_commission` fra `sale_items` UDEN FM-eksklusion og UDEN at tilfoeje FM provision separat. Det betyder:
- **Nu**: FM provision mangler helt fra disse beregninger (vaerdi = 0)
- **Efter opdatering**: FM provision inkluderes korrekt via sale_items
- **Ingen dobbelt-taelling**, da der ikke er separat FM-addition i disse cases

Filer der allerede er beskyttet (har FM-eksklusion + separat FM-addition):
- `useKpiTest.ts` (linje 466: `source=neq.fieldmarketing` + separat FM beregning)
- `FormulaLiveTest.tsx` (linje 466: `source=neq.fieldmarketing`)
- `useSalesAggregates.ts` (linje 81: `.neq("source", "fieldmarketing")`)

### Revenue - neutral
Revenue-casen (linje 607-625) bruger `products(revenue_dkk)` via FK-join. FM sale_items har `product_id = NULL`, saa de returnerer 0 revenue. At opdatere `mapped_revenue` aendrer ikke denne query, da den ikke laeser `mapped_revenue`. Sikkert.

## Plan

### Trin 1: SQL-opdatering af eksisterende FM sale_items
Opdater alle 3.487 raekker med korrekt provision og omsaetning baseret paa produktnavn-match:

```sql
UPDATE sale_items si
SET 
  mapped_commission = COALESCE(pr.commission_dkk, p.commission_dkk, 0),
  mapped_revenue = COALESCE(pr.revenue_dkk, p.revenue_dkk, 0)
FROM sales s
JOIN products p ON LOWER(p.name) = LOWER(si.display_name)
LEFT JOIN LATERAL (
  SELECT commission_dkk, revenue_dkk
  FROM product_pricing_rules
  WHERE product_id = p.id
    AND is_active = true
    AND (campaign_mapping_ids IS NULL OR campaign_mapping_ids = '{}')
  ORDER BY priority DESC
  LIMIT 1
) pr ON true
WHERE si.sale_id = s.id
  AND s.source = 'fieldmarketing'
  AND si.mapped_commission = 0;
```

### Trin 2: Opdater useCreateFieldmarketingSale hook
**Fil: `src/hooks/useFieldmarketingSales.ts`**

Importer `buildFmPricingMap` fra `fmPricing.ts` og brug den til at slaa korrekte provisioner op naar nye sale_items oprettes (i stedet for hardcoded 0).

### Trin 3: Opdater EditSalesRegistrations
**Fil: `src/pages/vagt-flow/EditSalesRegistrations.tsx`**

Ved aendring af produktnavn (baade enkelt- og gruppe-redigering), slaa ny provision/omsaetning op via `buildFmPricingMap` og opdater `mapped_commission`/`mapped_revenue` i sale_items.

## Samlet aendringsoversigt

| Komponent | Aendring |
|-----------|----------|
| SQL data-opdatering | UPDATE 3.487 FM sale_items med korrekte provisioner |
| `useFieldmarketingSales.ts` | Brug `buildFmPricingMap()` ved oprettelse af sale_items |
| `EditSalesRegistrations.tsx` | Brug `buildFmPricingMap()` ved redigering af sale_items |

## Hvad aendres IKKE
- Ingen nye filtre nødvendige (provision-queries er allerede korrekte)
- `raw_payload` forbliver intakt
- Dashboard-logik uaendret
- Revenue-beregninger upaavirkede
