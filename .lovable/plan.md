

## Fix: Produkt- og sælger-mapping automatisk på nye uploads

### Problem
Pass 2 (sælger+dato+produkt fallback for rækker uden telefon) har to huller:

1. **Produktkolonnen er hardcoded** til `"Subscription Name"` (linje 1059) i stedet for at bruge den konfigurerede `productColumn` fra upload-config + config's `product_columns`.
2. **`cancellation_product_mappings`** (produkt-mappings fra Mapping-fanen) bruges **ikke** i Pass 2. Kun `cancellation_product_conditions` og `fallback_product_mappings` fra config tjekkes. Det betyder at produkt-mappings oprettet via auto-match eller manuelt i Mapping-fanen aldrig anvendes til at resolves produktnavne i Pass 2.

Sælger-mappings (`cancellation_seller_mappings`) hentes og bruges allerede korrekt i Pass 2 (linje 1020-1024). Ingen ændring nødvendig der.

### Ændringer

**Fil: `src/components/cancellations/UploadCancellationsTab.tsx`**

**Ændring 1 — Brug konfigureret produktkolonne i Pass 2 (linje ~1059)**

Erstat hardcoded `"Subscription Name"` med den aktive upload-configs produktkolonne, med fallback til kendte nøgler:

```typescript
// Hent produktnavn fra konfigureret kolonne (eller fallback til kendte nøgler)
const productCol = activeConfig?.product_columns?.[0];
const PRODUCT_KEYS = ["Subscription Name", "Product", "Produkt", "Abonnement", "Product Name", "Produktnavn"];
let excelSubName = "";
if (productCol) {
  excelSubName = String(getCaseInsensitive(row.originalRow, productCol) || "").trim();
} 
if (!excelSubName) {
  for (const key of PRODUCT_KEYS) {
    const val = getCaseInsensitive(row.originalRow, key);
    if (val && String(val).trim()) { excelSubName = String(val).trim(); break; }
  }
}
```

**Ændring 2 — Tilføj `cancellation_product_mappings` som trin 2 i Pass 2 produktresolution (linje ~1070)**

Hent `cancellation_product_mappings` for klienten (allerede tilgængelig som query eller kan fetches) og brug dem som et ekstra trin mellem condition-based og fallback:

```typescript
// 2. Legacy cancellation_product_mappings
if (!resolvedProductTitle && excelSubName) {
  const mappedName = productMappingLookup.get(excelSubName.toLowerCase().trim());
  if (mappedName) resolvedProductTitle = mappedName;
}

// 3. Fallback to config fallback_product_mappings (eksisterende kode)
```

For at bygge `productMappingLookup` skal vi hente `cancellation_product_mappings` + product names én gang før loopet:

```typescript
// Før Pass 2 loop — hent product mappings
const { data: legacyProductMappings } = await supabase
  .from("cancellation_product_mappings")
  .select("excel_product_name, product_id")
  .eq("client_id", selectedClientId);

const productMappingLookup = new Map<string, string>();
if (legacyProductMappings && legacyProductMappings.length > 0) {
  const mappedPids = [...new Set(legacyProductMappings.map(m => m.product_id))];
  const { data: mappedProds } = await supabase.from("products").select("id, name").in("id", mappedPids);
  const pidToName = new Map((mappedProds || []).map(p => [p.id, p.name]));
  for (const m of legacyProductMappings) {
    const prodName = pidToName.get(m.product_id);
    if (prodName) productMappingLookup.set(m.excel_product_name.toLowerCase().trim(), prodName);
  }
}
```

### Resultat
- Nye uploads anvender automatisk eksisterende sælger-mappings (allerede OK) og produkt-mappings fra Mapping-fanen
- Produktresolution bruger konfigureret kolonne i stedet for hardcoded "Subscription Name"
- Kurv-rettelser og match virker med tidligere oprettede mappings
- Ingen breaking changes — eksisterende condition-based og fallback logik bevares

