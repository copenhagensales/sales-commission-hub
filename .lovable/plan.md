

## Fix: Tryg KPI `this_month`/`payroll_period` viser 0

### Problem
`calculateClientKpiValue` har to fejl:
1. **Sales query rammer 1000-rows limit**: Tryg har 1701 salg i payroll_period, men `.select("id")` returnerer max 1000 (Supabase default).
2. **`.in("sale_id", saleIds)` med 650+ UUIDs overskrider URL-laengden**: PostgREST koder alle vaerdier som GET-parametre. Queryen fejler stille og returnerer `null`, som fallback `(saleItems || [])` goer til tom array = 0.

### Loesning
Der findes allerede en `fetchAllSaleItems` helper (linje 114-136) der batcher i chunks af 500. Den bruges i leaderboard-koden men IKKE i `calculateClientKpiValue`. Fix:

**1. Tilfoej generisk `queryInBatches` helper** (ved siden af `fetchAllSaleItems`):

```typescript
async function queryInBatches<T>(
  supabase: SupabaseClient,
  table: string,
  filterColumn: string,
  ids: string[],
  selectColumns: string,
  batchSize = 200
): Promise<T[]> {
  if (ids.length === 0) return [];
  const results: T[] = [];
  for (let i = 0; i < ids.length; i += batchSize) {
    const batch = ids.slice(i, i + batchSize);
    const { data, error } = await supabase
      .from(table)
      .select(selectColumns)
      .in(filterColumn, batch);
    if (error) {
      console.error(`[queryInBatches] ${table} error:`, error.message);
      continue;
    }
    if (data) results.push(...(data as T[]));
  }
  return results;
}
```

**2. Tilfoej pagineret sales-fetch helper**:

```typescript
async function fetchAllSaleIds(
  supabase: SupabaseClient,
  campaignIds: string[],
  startStr: string,
  endStr: string
): Promise<string[]> {
  const allIds: string[] = [];
  const PAGE = 1000;
  let offset = 0;
  while (true) {
    const { data } = await supabase
      .from("sales")
      .select("id")
      .in("client_campaign_id", campaignIds)
      .gte("sale_datetime", startStr)
      .lte("sale_datetime", endStr)
      .range(offset, offset + PAGE - 1);
    if (!data || data.length === 0) break;
    allIds.push(...data.map((s: { id: string }) => s.id));
    if (data.length < PAGE) break;
    offset += PAGE;
  }
  return allIds;
}
```

**3. Erstat 3 steder i `calculateClientKpiValue`** (linje 2050-2165):

Alle tre KPI-cases (`sales_count`, `total_commission`, `total_revenue`) har samme moenster:
- Erstat `sales.select("id")...` med `fetchAllSaleIds()`
- Erstat `sale_items.select(...).in("sale_id", saleIds)` med `queryInBatches()`
- Erstat `products.select(...).in("id", productIds)` med `queryInBatches()` (for sales_count casen)

### Fil-aendringer

**Fil: `supabase/functions/calculate-kpi-values/index.ts`**

| Aendring | Linjer | Beskrivelse |
|----------|--------|-------------|
| Tilfoej `queryInBatches` | Efter linje 136 | Generisk batchet `.in()` helper |
| Tilfoej `fetchAllSaleIds` | Efter `queryInBatches` | Pagineret sales ID fetch |
| `sales_count` case | ~2050-2084 | Brug `fetchAllSaleIds` + `queryInBatches` for sale_items og products |
| `total_commission` case | ~2104-2121 | Brug `fetchAllSaleIds` + `queryInBatches` for sale_items |
| `total_revenue` case | ~2148-2165 | Brug `fetchAllSaleIds` + `queryInBatches` for sale_items |

### Eksempel (sales_count efter fix):

```typescript
case "sales_count":
case "antal_salg": {
  let telesalesCount = 0;
  if (campaignIds.length > 0) {
    const saleIds = await fetchAllSaleIds(supabase, campaignIds, startStr, endStr);
    if (saleIds.length > 0) {
      const saleItems = await queryInBatches<{quantity: number|null; product_id: string|null}>(
        supabase, "sale_items", "sale_id", saleIds, "quantity, product_id"
      );
      const productIds = [...new Set(saleItems.map(si => si.product_id).filter(Boolean))] as string[];
      let countingProductIds = new Set<string>();
      if (productIds.length > 0) {
        const products = await queryInBatches<Product>(
          supabase, "products", "id", productIds, "id, counts_as_sale"
        );
        countingProductIds = new Set(products.filter(p => p.counts_as_sale !== false).map(p => p.id));
      }
      for (const item of saleItems as SaleItem[]) {
        if (!item.product_id || countingProductIds.has(item.product_id)) {
          telesalesCount += item.quantity || 1;
        }
      }
    }
  }
  // FM count stays unchanged
  ...
}
```

### Pavirkning
- Fixer Tryg og alle klienter med 300+ salg i en periode
- Ingen brud paa eksisterende funktionalitet
- Lille performance-overhead (2-4 ekstra queries for store klienter)
- Deploy og test med `{"chunk": "kpis"}` derefter verificer cached vaerdier
