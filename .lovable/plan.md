

## Fix: Omvendt 5G Internet-match (upload=5G, salg≠5G)

### Problem
Den nuværende fix håndterer kun: **salg** er phone_excluded → tjek om upload også er det.

Men det omvendte mangler: Når **upload-produktet** er phone_excluded (f.eks. "5G Internet") men **salgets** produkt er noget andet (f.eks. "Eesy"), falder koden ind i `else`-grenen (linje 1171) og accepterer matchet via telefon. Det er forkert for annulleringer.

### Løsning

**Fil:** `src/components/cancellations/UploadCancellationsTab.tsx` — `else`-grenen i Pass 1b (linje ~1171-1185)

Tilføj et spejlet tjek i `else`-grenen: Hvis upload-produktet er phone_excluded men salgets produkt ikke er det, og rækken er en annullering → `continue`.

```text
} else {
  // Standard product resolution
  finalTarget = resolvedProduct || rawRowProduct || "Ukendt produkt";
  if (resolvedProduct && realProduct && resolvedProduct.toLowerCase() !== realProduct.toLowerCase()) {
    // ... existing ambiguous condition check (unchanged) ...
  }

  // NEW: Reverse check — upload product is phone_excluded but sale is not
  const uploadProductLower = finalTarget.toLowerCase().trim();
  const isUploadProductExcluded = uploadProductLower && phoneExcludedProducts.some(
    p => uploadProductLower.includes(p.toLowerCase().trim()) || p.toLowerCase().trim().includes(uploadProductLower)
  );

  if (isUploadProductExcluded) {
    // Determine if this row is a cancellation (same logic as above)
    let isRowCancellation = uploadType === "cancellation";
    if (!isRowCancellation && uploadType === "both") {
      const typeCol = activeConfig?.type_detection_column;
      const typeVals = ((activeConfig?.type_detection_values as string[]) || []);
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
      continue; // Upload is 5G but sale is not → skip, Pass 2 handles
    }
  }
}
```

### Effekt
- Upload "5G Internet" + salg "Eesy" → phone-match afvises for annulleringer → falder til Pass 2
- Ikke-annulleringer bevarer nuværende logik
- Den eksisterende fix (salg=5G, upload≠5G) bevares uændret

### Fil
- `src/components/cancellations/UploadCancellationsTab.tsx` (linje ~1171-1185)

