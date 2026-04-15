

# Fix Excel seriel-datoer — kun TDC Erhverv

## Problem
Excel gemmer datoer som serielle tal (f.eks. `46027` = 5. januar 2026). `parseExcelDate` håndterer kun tekstformater, så `46027` falder igennem til `new Date("46027")` → år 46027. Resultatet er "01/01/46027" i Uploadet data og Forskelle.

## Løsning
Tilføj Excel serial number-håndtering i `parseExcelDate`, men kun aktiveret via en parameter så det kun bruges for TDC Erhverv.

### Ændringer i `ApprovalQueueTab.tsx`

**1. Udvid `parseExcelDate` med valgfri serial-support (linje 89-107):**
```tsx
function parseExcelDate(val: unknown, handleSerialDates = false): Date | null {
  if (!val) return null;

  // Excel serial dates (only for TDC Erhverv)
  if (handleSerialDates) {
    const num = typeof val === "number" ? val
      : (typeof val === "string" && /^\d{4,6}$/.test(val.trim()) ? Number(val) : null);
    if (num && num > 1 && num < 200000) {
      const epoch = new Date(Date.UTC(1900, 0, 1));
      const d = new Date(epoch.getTime() + (num - 2) * 86400000);
      return isNaN(d.getTime()) ? null : d;
    }
  }

  // ...eksisterende dd/MM/yyyy, yyyy-MM-dd og native parse logik uændret
}
```

**2. I `computeDiff` — pass `handleSerialDates` videre (kaldested linje 124):**
Udvid `computeDiff` med en `isTdcErhverv` parameter og send den til `parseExcelDate`:
```tsx
function computeDiff(..., isTdcErhverv = false): DiffField[] {
  // ...
  const excelDate = parseExcelDate(excelRaw, isTdcErhverv);
```

**3. Ved kald af `computeDiff` — tilføj TDC-check:**
Send `clientId === TDC_ERHVERV_CLIENT_ID` som den nye parameter, der allerede eksisterer som konstant i filen.

### Resultat
- `46027` → "05/01/2026" for TDC Erhverv
- Andre klienter: ingen ændring i adfærd
- Én fil ændres, ~15 linjer tilføjet/ændret

