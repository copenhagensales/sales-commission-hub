

## Fix: Eesy TM 5G-rækker routes ikke korrekt til 5G-matchingblokken + silent drop ved key-kollision

### Problem
1. **`isEesyTm5gRow` matcher ikke**: Betingelsen tjekker `resolvedProductTitle === "5g internet"`, men produktmappings resolver til `"5GI"`. Rækken sendes derfor til den **normale** matching-blok i stedet for 5G-blokken.
2. **Silent drop**: I den normale blok bruges `key = sale_id|5GI`. Når flere 5G-rækker matcher samme sælger+dato, kan én række tage nøglen, og de resterende droppes stille uden at blive tilføjet til `unmatchedSellers`.

### Løsning (kun Eesy TM)

**`src/components/cancellations/UploadCancellationsTab.tsx`** — 2 ændringer:

#### 1. Udvid `isEesyTm5gRow`-detektionen (linje 1590-1591)
Brug `isEesyTm5gSaleItem` til også at matche resolved titles som "5GI":
```typescript
const isEesyTm5gRow = selectedClientId === CLIENT_IDS["Eesy TM"]
  && (resolvedProductTitle?.toLowerCase() === "5g internet"
      || isEesyTm5gSaleItem(resolvedProductTitle || ""));
```
Dette sender 5G-rækker korrekt ind i den specialiserede 5G-blok med telefon+dato scoring.

#### 2. Tilføj fallback til `unmatchedSellers` ved key-kollision i 5G-blokken (linje 1631-1659)
Når `bestMatch` findes men nøglen allerede er taget:
```typescript
if (bestMatch) {
  const key = `${bestMatch.id}|${resolvedProductTitle}`;
  if (!matchedSaleProductKeys.has(key)) {
    // ... eksisterende match-logik (uændret)
  } else {
    // Key allerede brugt — send til manuel håndtering
    unmatchedSellers.push({
      rowIndex: idx,
      excelSellerName: excelSeller,
      excelDate,
      excelProduct: excelSubName,
      originalRow: row.originalRow,
    });
  }
}
```

### Resultat
- 5G-rækker for Eesy TM routes korrekt til den specialiserede blok med bedre scoring (dato + telefon)
- Hvis flere 5G-rækker konkurrerer om samme salg, vises overskydende rækker under "Fejl i match" i stedet for at forsvinde

