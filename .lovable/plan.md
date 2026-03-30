

## Fix: 5G Internet matching for Eesy TM

### Root Cause (3 problems)

1. **`phone_excluded_products` er `null`** i Eesy TM config → rækker med telefonnummer afvises i Pass 2 guard (linje 1466-1469)
2. **`product_columns` er `[]`** → `excelSubName` forbliver tom → `resolvedProductTitle` bliver `null` → tidligt return på linje 1524
3. **Produkt-mismatch**: Selv hvis `resolvedProductTitle` blev sat, sammenligner linje 1571 eksakt med `adversus_product_title` ("5GI" eller "5GI - 279 kr./md..."), men Excel har "5G Internet Ubegrænset data"

### Løsning — hardcoded Eesy TM 5G fallback (scoped)

**Fil: `src/components/cancellations/UploadCancellationsTab.tsx`**

#### 1. Tilføj 5G-hjælpere (top-level)
```typescript
const EESY_TM_5G_EXCEL_PATTERNS = ["5g internet"];
const EESY_TM_5G_SALE_PATTERNS = ["5gi"];

function isEesyTm5gExcelProduct(value: string): boolean {
  const lower = value.toLowerCase().trim();
  return EESY_TM_5G_EXCEL_PATTERNS.some(p => lower.includes(p));
}

function isEesyTm5gSaleItem(title: string): boolean {
  const lower = title.toLowerCase().trim();
  return EESY_TM_5G_SALE_PATTERNS.some(p => 
    lower === p || lower.startsWith(p + " ") || lower.startsWith(p + " -")
  );
}
```

#### 2. Pass 2 guard — tillad 5G-rækker igennem (linje 1466-1469)
Når klient er Eesy TM og produktet er 5G Internet, skip IKKE rækken selvom den har telefon og `phone_excluded_products` er tom:
```typescript
const isExcluded2 = phoneExcludedProducts.some(...existing...);
const isEesyTm5g = selectedClientId === CLIENT_IDS["Eesy TM"] 
  && isEesyTm5gExcelProduct(rowProduct2);
if (!isExcluded2 && !isEesyTm5g) return;
```

#### 3. Product resolution fallback (efter linje 1522, før linje 1524)
Hvis `resolvedProductTitle` stadig er null og rækken er Eesy TM 5G, sæt fallback:
```typescript
if (!resolvedProductTitle && selectedClientId === CLIENT_IDS["Eesy TM"]) {
  if (isEesyTm5gExcelProduct(excelSubName || rowProduct3_fromKeys)) {
    resolvedProductTitle = "5G Internet"; // Internal product name
  }
}
```
Bemærk: `excelSubName` kan være tom pga. manglende `product_columns`. Brug PRODUCT_KEYS fallback til at finde "Subscription Name" etc.

#### 4. Kandidat-produktmatch — tolerant for 5G (linje 1570-1573)
Erstat eksakt `===` med alias-match kun for Eesy TM 5G:
```typescript
const hasProduct = items.some(item => {
  const title = item.adversus_product_title?.toLowerCase() || "";
  if (resolvedProductTitle!.toLowerCase() === "5g internet") {
    return isEesyTm5gSaleItem(title);
  }
  return title === resolvedProductTitle!.toLowerCase();
});
```

#### 5. Target product name — brug intern produktnavn
I matched result (linje 1615), behold `resolvedProductTitle` ("5G Internet") som `targetProductName` da dette matcher det interne produkt.

#### 6. Sørg for at `excelSubName` finder produktet uden konfigureret kolonne
`excelSubName` læses allerede via PRODUCT_KEYS fallback (linje 1481-1486: "Subscription Name", "Product", etc.), men dette kører kun hvis `excelSubName` er tom efter productCol-tjek. **Dette virker allerede** — "Subscription Name" fra Excel fanges her.

### Ingen databaseændringer
Alt er kodeændringer i én fil, scopet til `CLIENT_IDS["Eesy TM"]`.

### Resultat
- Excel "5G Internet Ubegrænset data" → `resolvedProductTitle = "5G Internet"`
- Sale item "5GI" eller "5GI - 279 kr./md..." → matcher via `isEesyTm5gSaleItem`
- Godkendelseskø modtager `targetProductName = "5G Internet"`

