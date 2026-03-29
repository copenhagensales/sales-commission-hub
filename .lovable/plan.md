

## Fix: 5G Internet phone-matching kun strengere for annulleringer

### Problem
Pass 1b matcher på telefonnummer. Når salgets produkt er "5G Internet" (phone_excluded), tvinges `finalTarget = realProduct` — uanset upload-rækkens produkt. En upload-række med "Fri tale + 70 GB data" matches fejlagtigt til et "5G Internet"-salg.

### Krav
- **Annulleringer:** Kræver match på Produkt + Sælger + (Dato ELLER Kunde via andet salg). Telefon alene er ikke nok.
- **Ikke-annulleringer (correct_match/basket_difference):** Nuværende phone-matching-logik beholdes.

### Løsning

**Ændring i `src/components/cancellations/UploadCancellationsTab.tsx` — Pass 1b (linje ~1137-1156)**

Når `isRealProductExcluded` er true, tilføj et tjek:

1. **Bestem om rækken er en annullering:** Hvis `uploadType === "cancellation"` → altid annullering. Hvis `uploadType === "both"` → tjek `type_detection_column`/`type_detection_values` og "Annulled Sales" på rækkens data (samme logik som linje 1686-1700, men udført inline her).

2. **Hvis rækken ER en annullering:** Tjek om upload-rækkens produkt også er phone_excluded. Hvis ja → `finalTarget = realProduct` (behold match). Hvis nej → `continue` (skip, lad Pass 2 håndtere med sælger+produkt+dato/kunde).

3. **Hvis rækken IKKE er en annullering:** Behold nuværende logik (`finalTarget = realProduct` for phone_excluded).

```text
if (isRealProductExcluded) {
  // Determine if this row is a cancellation
  let isRowCancellation = uploadType === "cancellation";
  if (!isRowCancellation && uploadType === "both") {
    const typeCol = activeQueueConfig?.type_detection_column;
    const typeVals = (activeQueueConfig?.type_detection_values as string[]) || [];
    if (typeCol && typeVals.length > 0) {
      const cellVal = String(getCaseInsensitive(row.originalRow, typeCol) || "").trim().toLowerCase();
      isRowCancellation = typeVals.some(v => v.toLowerCase() === cellVal);
    }
    if (!isRowCancellation) {
      const annulledVal = String(getCaseInsensitive(row.originalRow, "Annulled Sales") || "").trim();
      isRowCancellation = annulledVal !== "" && annulledVal !== "0";
    }
  }

  if (isRowCancellation) {
    // Strict: only match if upload product is also phone_excluded
    const uploadProduct = (resolvedProduct || rawRowProduct || "").toLowerCase().trim();
    const isUploadAlsoExcluded = !uploadProduct || phoneExcludedProducts.some(
      p => uploadProduct.includes(p.toLowerCase().trim()) || p.toLowerCase().trim().includes(uploadProduct)
    );
    if (isUploadAlsoExcluded) {
      finalTarget = realProduct;
    } else {
      continue; // Skip → Pass 2 handles with seller+product+date/customer
    }
  } else {
    // Non-cancellation: keep current behavior
    finalTarget = realProduct;
  }
}
```

### Effekt
- Annulleringsrækker med "Fri tale + 70 GB data" vil **ikke** fejlagtigt matche et "5G Internet"-salg via telefon — de falder til Pass 2 som matcher med sælger+produkt+dato/kunde
- Ikke-annulleringsrækker (correct_match, basket_difference) beholder nuværende phone-matching
- Ægte 5G Internet annulleringer (hvor upload-produktet også er 5G Internet) fungerer stadig i Pass 1b

### Fil
- `src/components/cancellations/UploadCancellationsTab.tsx`

