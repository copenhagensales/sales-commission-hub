

## Plan: Ny matching-logik for phone-excluded produkter

### Dit krav (ordret)
> Skal matche på sælger og produkt.  
> Og derefter skal den matche på dato eller på kunden.  
> Hvis ingen match → skal den fremgå i unmatched (fejl-kø).

### Nuværende adfærd (problem)

**Pass 2 (linje 1270-1313)** kræver i dag at ALLE tre matcher: Sælger + Dato + Produkt. For phone-excluded produkter som "5G Internet" er der to problemer:

1. **Kunde-matching bruges ikke** — Excel-rækkens telefonnummer ignoreres helt i Pass 2, selvom det kan matche salgets `customer_phone`
2. **Stille fejl** — Hvis en phone-excluded række har gyldig sælger-mapping men ingen sale matcher alle tre kriterier, forsvinder rækken stille. Den ender HVERKEN i `productMatched` eller `unmatchedSellers`. Brugeren ser den aldrig.

### Ny logik for phone-excluded produkter

For rækker hvis produkt er i `phone_excluded_products`-listen:

```text
TRIN 1 (krævet):  Sælger (agent_email) — skal matche
TRIN 2 (krævet):  Produkt (sale_items) — skal matche
TRIN 3 (krævet):  Mindst én af:
                   a) Dato — Excel-dato = salgets dato (same day)
                   b) Kunde — Excel-telefon = salgets customer_phone
```

**Prioritering** når flere kandidater opfylder reglerne:
- Dato + Kunde matcher → vælges først (bedste match)
- Kun dato matcher → næstbedste
- Kun kunde matcher → accepteres også

**Ingen match → fejl-kø (unmatched)**:  
Hvis ingen kandidat opfylder sælger + produkt + (dato ELLER kunde), tilføjes rækken til `unmatchedSellers` så den vises i "Fejl i match"-fanen. I dag forsvinder den bare — det skal rettes.

### Tekniske ændringer

#### 1. `UploadCancellationsTab.tsx` — Pass 2 (linje 1173-1313)

**a) Detekter phone-excluded rækker** (allerede delvist på plads, linje 1180-1191):
- Genbruger `phoneExcludedProducts` fra linje 1043
- Marker rækken som `isPhoneExcludedRow`

**b) Erstat `for`-løkken (linje 1270-1313) med branching logik:**

For **normale rækker** (ikke phone-excluded): Behold nuværende logik uændret — sælger + dato + produkt, alle tre krævet, `break` ved første match.

For **phone-excluded rækker**: Ny logik:
```typescript
if (isPhoneExcludedRow) {
  // Step 1+2: Collect ALL candidates matching seller + product
  const candidates = [];
  for (const sale of candidateSales) {
    if (existingIds.has(sale.id)) continue;
    const saleAgentEmail = (sale.agent_email || "").toLowerCase();
    if (saleAgentEmail !== agentEmail) continue;
    const items = saleItemsMap.get(sale.id) || [];
    const hasProduct = items.some(item => 
      item.adversus_product_title?.toLowerCase() === resolvedProductTitle!.toLowerCase()
    );
    if (!hasProduct) continue;
    candidates.push(sale);
  }

  // Step 3: Score each candidate on date and customer match
  let bestMatch = null;
  let bestScore = 0; // 2=date+customer, 1=date or customer, 0=none

  for (const sale of candidates) {
    const saleDateObj = new Date(sale.sale_datetime);
    const dateMatch = excelDateObj.getFullYear() === saleDateObj.getFullYear() &&
                      excelDateObj.getMonth() === saleDateObj.getMonth() &&
                      excelDateObj.getDate() === saleDateObj.getDate();
    
    const customerMatch = !!excelPhone && 
      normalizePhone(sale.customer_phone || "") === excelPhone;
    
    const score = (dateMatch ? 1 : 0) + (customerMatch ? 1 : 0);
    if (score === 0) continue; // neither date nor customer
    if (score > bestScore) {
      bestMatch = sale;
      bestScore = score;
    }
    if (bestScore === 2) break; // perfect, stop looking
  }

  if (bestMatch) {
    // Add to productMatched (same as current code)
    const key = `${bestMatch.id}|${resolvedProductTitle}`;
    if (!matchedSaleProductKeys.has(key)) {
      matchedSaleProductKeys.add(key);
      matchedIndicesLocal.add(idx);
      const matchedItem = (saleItemsMap.get(bestMatch.id) || []).find(item => 
        item.adversus_product_title?.toLowerCase() === resolvedProductTitle!.toLowerCase()
      );
      productMatched.push({
        saleId: bestMatch.id,
        phone: bestMatch.customer_phone || "",
        company: bestMatch.customer_company || "",
        oppNumber: "",
        saleDate: bestMatch.sale_datetime || "",
        employee: bestMatch.agent_name || "Ukendt",
        currentStatus: bestMatch.validation_status || "pending",
        uploadedRowData: row.originalRow,
        targetProductName: resolvedProductTitle!,
        realProductName: matchedItem?.adversus_product_title || resolvedProductTitle!,
        commission: matchedItem?.mapped_commission ?? undefined,
        revenue: matchedItem?.mapped_revenue ?? undefined,
        matchConfidence: bestScore === 2 ? "high" : "medium",
      });
    }
  } else {
    // NO match found → send to error queue (unmatched)
    unmatchedSellers.push({
      rowIndex: idx,
      excelSellerName: excelSeller,
      excelDate,
      excelProduct: excelSubName,
      originalRow: row.originalRow,
    });
  }
} else {
  // Existing logic for non-excluded products (unchanged)
  for (const sale of candidateSales) {
    // ... current sælger + dato + produkt code ...
  }
}
```

**c) Fix: Rækker der matcher sælger+produkt men IKKE dato/kunde ender nu i fejl-køen**  
I dag forsvinder de stille. Med den nye kode sendes de eksplicit til `unmatchedSellers` → vises i "Fejl i match"-fanen.

#### 2. `MatchedSale` interface (linje 55-68)

Tilføj:
```typescript
matchConfidence?: "high" | "medium";
```

#### 3. `ApprovalQueueTab.tsx` — Vis match-type badge

Tilføj badge ved siden af eksisterende match-indikatorer:
- `matchConfidence === "high"` → grøn badge "Dato + Kunde"
- `matchConfidence === "medium"` → gul badge "Kun dato" eller "Kun kunde"

### Filer der ændres
1. **`src/components/cancellations/UploadCancellationsTab.tsx`** — Interface, Pass 2 branching, fejl-kø for umatchede rækker
2. **`src/components/cancellations/ApprovalQueueTab.tsx`** — Confidence badge i godkendelseskøen

