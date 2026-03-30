

## Fix: Scope alle ændringer til kun Eesy TM

### Nuværende status
- **Dedup-nøgle** (ApprovalQueueTab linje 635-650): ✅ Allerede scopet til Eesy TM via `isEesyTm` check
- **Produkt-filtrering** (ApprovalQueueTab linje 515): ✅ Allerede scopet via `clientId === CLIENT_IDS["Eesy TM"]`
- **Batch confirm target_product_name** (MatchErrorsSubTab linje 382-403): ⚠️ Henter `target_product_name` for **alle** klienter — skal scopes
- **Individuel re-match** (MatchErrorsSubTab linje 240-249): ⚠️ Mangler `target_product_name` helt — skal tilføjes kun for Eesy TM

### Ændringer

#### 1. MatchErrorsSubTab.tsx — Batch confirm (linje 382-403)
Wrap `target_product_name`-hentning i en Eesy TM-check:

```typescript
const isEesyTm = clientId === CLIENT_IDS["Eesy TM"];

let saleItemMap = new Map<string, string>();
if (isEesyTm) {
  const saleIds = entries.map(e => e.saleId);
  const { data: saleItemsData } = await supabase
    .from("sale_items")
    .select("sale_id, adversus_product_title")
    .in("sale_id", saleIds);
  for (const si of (saleItemsData || [])) {
    if (!saleItemMap.has(si.sale_id)) {
      saleItemMap.set(si.sale_id, si.adversus_product_title || "");
    }
  }
}

const inserts = entries.map(({ saleId, row: r }) => ({
  ...existing fields...,
  target_product_name: isEesyTm ? (saleItemMap.get(saleId) || null) : null,
}));
```

#### 2. MatchErrorsSubTab.tsx — Individuel re-match / upsertMapping (linje 240-249)
Tilføj `target_product_name` kun for Eesy TM:

```typescript
let targetProductName: string | null = null;
if (clientId === CLIENT_IDS["Eesy TM"]) {
  const { data: matchedSaleItems } = await supabase
    .from("sale_items")
    .select("adversus_product_title")
    .eq("sale_id", sales[0].id)
    .limit(1);
  targetProductName = matchedSaleItems?.[0]?.adversus_product_title || null;
}

const { error: queueError } = await supabase
  .from("cancellation_queue")
  .insert([{
    ...existing fields...,
    target_product_name: targetProductName,
  }]);
```

#### 3. ApprovalQueueTab.tsx — Begræns "×2" fix (linje 515-520)
Allerede korrekt scopet — ingen ændring nødvendig. Tilføj dog `[filtered[0]]` begrænsningen:

```typescript
if (clientId === CLIENT_IDS["Eesy TM"] && targetProductName) {
  const filtered = saleItems.filter(si =>
    si.product_name.toLowerCase().trim() === targetProductName.toLowerCase().trim()
  );
  if (filtered.length > 0) saleItems = [filtered[0]]; // Kun 1 pr. annullering
}
```

### Import
Tilføj `CLIENT_IDS` import i `MatchErrorsSubTab.tsx`:
```typescript
import { CLIENT_IDS } from "@/utils/clientIds";
```

### Konsekvens
- Alle tre ændringer er nu **eksplicit scopet til Eesy TM**
- Andre klienter påvirkes ikke — `target_product_name` forbliver `null` for dem

