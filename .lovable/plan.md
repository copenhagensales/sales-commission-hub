
## Plan: Fix produkt-matching i upload-flowet (Pass 1b)

### Problem
Når en Excel-række med "5G Internet Ubegrænset data" uploades, matcher Pass 1b den til et salg baseret udelukkende på telefonnummer — uden at verificere om salgets produkt stemmer overens med den konfigurerede produkt-mapping. Resultatet er, at en 5G Internet-række kobles til et Eesy-salg, fordi kunden tilfældigvis har begge salg med samme telefonnummer.

Derudover sætter Pass 1b `targetProductName` til salgets første `adversus_product_title` (f.eks. "Eesy uden første måned"), i stedet for det resolvede produkt fra betingelserne. Derfor viser godkendelseskøen forkert produkt og `target_product_name` er `null` i databasen.

### Løsning

**Fil: `src/components/cancellations/UploadCancellationsTab.tsx`**

**Ændring i Pass 1b (linje ~1070-1098):**

Før Pass 1b starter telefonmatching, resolv først produktet via condition-based matching og legacy mappings (samme logik som Pass 2 allerede bruger). Derefter:

1. Hvis et produkt resolves (f.eks. "5G Internet"), kræv at det matchede salg har det produkt i sine `sale_items` — ellers spring salget over
2. Sæt `targetProductName` til det resolvede produkt, ikke til salgets første item
3. Hvis intet produkt kan resolves, behold nuværende adfærd (match på telefon alene)

```typescript
// Resolve expected product for this row via conditions/mappings
let resolvedProduct: string | null = null;
if (groupedConditions.length > 0) {
  const matchedPid = findMatchingProductId(groupedConditions, row.originalRow);
  if (matchedPid) resolvedProduct = condProductNames.get(matchedPid) || null;
}
if (!resolvedProduct) {
  // Try legacy mapping
  let excelSubName = "";
  // ... (same product column lookup as Pass 2)
  if (excelSubName) {
    resolvedProduct = productMappingLookup.get(excelSubName.toLowerCase().trim()) || null;
  }
}

for (const sale of candidateSales) {
  // ... phone match check ...
  
  const allItems = saleItemsMap.get(sale.id) || [];
  
  // If we resolved a product, verify the sale has it
  if (resolvedProduct) {
    const hasProduct = allItems.some(item =>
      item.adversus_product_title?.toLowerCase() === resolvedProduct!.toLowerCase()
    );
    if (!hasProduct) continue; // Skip — wrong product
  }
  
  const firstItem = allItems[0];
  productMatched.push({
    // ...
    targetProductName: resolvedProduct || firstItem?.adversus_product_title || "Ukendt produkt",
    realProductName: resolvedProduct 
      ? (allItems.find(i => i.adversus_product_title?.toLowerCase() === resolvedProduct!.toLowerCase())?.adversus_product_title || resolvedProduct)
      : firstItem?.adversus_product_title || "Ukendt produkt",
  });
}
```

**Forudsætning:** `groupedConditions`, `condProductNames`, og `productMappingLookup` er allerede tilgængelige i scope, da de hentes før Pass 2 (linje ~1108-1139). Disse skal flyttes op FØR Pass 1b, så de også er tilgængelige der.

### Ændringer i detaljer

| Hvad | Linje (ca.) | Ændring |
|------|-------------|---------|
| Flyt condition/mapping-fetch op | ~1108-1139 → ~1042 | Flyt fetch af `conditionRows`, `groupedConditions`, `condProductNames`, `productMappingLookup` til FØR Pass 1b |
| Pass 1b produkt-verifikation | ~1070-1098 | Resolv produkt og verificér match mod sale_items |
| `targetProductName` | ~1092 | Brug resolvet produkt i stedet for salgets første item |

### Effekt
- "5G Internet Ubegrænset data" vil kun matche salg der faktisk har et 5G Internet-produkt i sine sale_items
- Eesy-salg springes over, selv om telefonnummeret er det samme
- `target_product_name` sættes korrekt i køen, så godkendelsesvisningen også viser korrekt produktmatch
