

## Fix: Tilføj produkt/provision/omsætning i standard matching path

### Problem
Der er to matching-paths i `handleMatch`:
1. **Product-phone mapping path** (linje 892-1206) — populerer `targetProductName`, `realProductName`, `commission`, `revenue` fra `saleItemsMap`. Bruges kun når config har `product_phone_mappings`.
2. **Standard matching path** (linje 1209-1380) — matcher via telefon/virksomhed/OPP, men opretter `MatchedSale` objekter **uden** produkt/provision/omsætning (linje 1362-1371). Derfor vises "-" for alle disse felter.

Eesy FM Standard config bruger standard-path'en (ingen product_phone_mappings), så alle 1307 matches mangler produktdata — selvom `saleItemsMap` allerede er hentet med alle sale_items.

### Ændring

**Fil: `src/components/cancellations/UploadCancellationsTab.tsx`, linje 1362-1371**

Udvid `allMatched.map()` til at slå sale_items op fra det allerede hentede `saleItemsMap`:

```typescript
const matched: MatchedSale[] = allMatched.map(sale => {
  const items = saleItemsMap.get(sale.id) || [];
  const firstItem = items[0];
  return {
    saleId: sale.id,
    phone: sale.customer_phone || "",
    company: sale.customer_company || "",
    oppNumber: extractOpp(sale.raw_payload),
    saleDate: sale.sale_datetime || "",
    employee: sale.agent_name || "Ukendt",
    currentStatus: sale.validation_status || "pending",
    uploadedRowData: findUploadedRow(sale),
    targetProductName: firstItem?.adversus_product_title || undefined,
    realProductName: firstItem?.adversus_product_title || undefined,
    commission: firstItem?.mapped_commission ?? undefined,
    revenue: firstItem?.mapped_revenue ?? undefined,
  };
});
```

Én ændring — henter det første sale_item for hvert matchet salg og populerer de fire manglende felter. Data er allerede tilgængelig i `saleItemsMap`.

