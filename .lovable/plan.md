

## Fix: Forhindre duplikerede produkt-matches på samme salg (Eesy TM)

### Rodårsag

I Pass 1 bruges `matchedSaleProductKeys` til at forhindre dubletter. Men nøglen er `sale.id|mapping.productName` — altså `saleId|Abonnement2` vs `saleId|Abonnement3`. Disse er **forskellige**, selvom begge Abo-felter peger på **det samme faktiske produkt** (f.eks. "Fri tale + 70 GB...").

Resultat: 3 Excel-rækker med 3 forskellige telefonnumre matcher Abo1, Abo2 og Abo3 på ét salg. To af dem resolver til samme produkt → ægte dublet i godkendelseskøen.

### Løsning

**Fil: `src/components/cancellations/UploadCancellationsTab.tsx`** — linje ~1127-1128

Ændr dedup-nøglen for Eesy TM til at bruge det **resolved** produktnavn i stedet for mapping-navnet:

```typescript
// Nuværende (linje 1127):
const key = `${sale.id}|${mapping.productName}`;

// Ny:
const resolvedName = selectedClientId === CLIENT_IDS["Eesy TM"]
  ? (matchingItem?.adversus_product_title || mapping.productName)
  : mapping.productName;
const key = `${sale.id}|${resolvedName}`;
```

Men `matchingItem` beregnes EFTER denne linje (linje 1131-1133). Så vi skal flytte dedup-checket til EFTER matchingItem er resolved:

```text
Nuværende rækkefølge (linje 1126-1149):
  1. if (excelPhone === payloadPhone)
  2. const key = sale.id|mapping.productName  ← dedup check
  3. matchedSaleProductKeys.has(key) → skip
  4. beregn posIndex + matchingItem
  5. push match
  6. break

Ny rækkefølge:
  1. if (excelPhone === payloadPhone)
  2. beregn posIndex + matchingItem          ← flyttes op
  3. const key = sale.id|resolvedName         ← bruger faktisk produktnavn
  4. matchedSaleProductKeys.has(key) → skip
  5. push match
  6. break
```

### Konsekvens
- Abo2 og Abo3 med **samme** produkt → kun ét match (korrekt)
- Abo1 og Abo2 med **forskellige** produkter → to matches (korrekt)
- Andre klienter: Uberørte (bruger stadig `mapping.productName` i nøglen)

### Teknisk ændring — én blok

Linje ~1126-1149 i `UploadCancellationsTab.tsx` omskrives til:

```typescript
if (excelPhone === payloadPhone) {
  // Resolve the matched sale_item FIRST (for Eesy TM dedup by actual product)
  const posIndex = parseInt(mapping.payloadPhoneField?.replace(/\D/g, "") || "0", 10) - 1;
  const allItems = saleItemsMap.get(sale.id) || [];
  const matchingItem = posIndex >= 0 && posIndex < allItems.length ? allItems[posIndex] : allItems[0];
  
  // Dedup key: use resolved product name for Eesy TM, mapping name for others
  const resolvedName = selectedClientId === CLIENT_IDS["Eesy TM"]
    ? (matchingItem?.adversus_product_title || mapping.productName)
    : mapping.productName;
  const key = `${sale.id}|${resolvedName}`;
  if (matchedSaleProductKeys.has(key)) continue;
  matchedSaleProductKeys.add(key);
  matchedIndicesLocal.add(idx);
  
  productMatched.push({
    saleId: sale.id,
    phone: String(payloadPhoneRaw),
    company: sale.customer_company || "",
    oppNumber: "",
    saleDate: sale.sale_datetime || "",
    employee: sale.agent_name || "Ukendt",
    currentStatus: sale.validation_status || "pending",
    uploadedRowData: row.originalRow,
    targetProductName: selectedClientId === CLIENT_IDS["Eesy TM"]
      ? (matchingItem?.adversus_product_title || mapping.productName)
      : mapping.productName,
    realProductName: matchingItem?.adversus_product_title || allItems[0]?.adversus_product_title || "Ukendt produkt",
    commission: matchingItem?.mapped_commission ?? undefined,
    revenue: matchingItem?.mapped_revenue ?? undefined,
  });
  if (selectedClientId === CLIENT_IDS["Eesy TM"]) break;
}
```

