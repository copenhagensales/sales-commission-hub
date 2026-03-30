

## Fix: Pass 2 dato-parsing fejler for europæiske datoformater

### Problem
Sælger-mappings eksisterer og er korrekte (som vist i screenshot). Pass 2-logikken finder også korrekt `employeeId` og `agentEmail`. Men **dato-sammenligningen fejler** fordi:

- Excel-datoen er i europæisk format: `"30.3.2026"` (DD.MM.YYYY)
- `new Date("30.3.2026")` returnerer `Invalid Date` i JavaScript
- Alle datosammenligninger (linje 1573-1576 og 1628-1632) fejler → `score = 0` → ingen match

### Løsning

**Fil: `src/components/cancellations/UploadCancellationsTab.tsx`**

Tilføj en robust dato-parser der håndterer europæiske formater (DD.MM.YYYY, DD/MM/YYYY, DD-MM-YYYY) samt standard ISO-format. Erstat `new Date(excelDate)` på linje 1539 med en parser-funktion:

```typescript
function parseFlexibleDate(dateStr: string): Date {
  // Try DD.MM.YYYY, DD/MM/YYYY, DD-MM-YYYY (European format)
  const euMatch = dateStr.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
  if (euMatch) {
    return new Date(Number(euMatch[3]), Number(euMatch[2]) - 1, Number(euMatch[1]));
  }
  // Fallback to native Date parsing (handles ISO, US formats, etc.)
  return new Date(dateStr);
}
```

Brug den på linje 1539:
```typescript
const excelDateObj = parseFlexibleDate(excelDate);
```

### Konsekvens
- 5G Internet-rækker med europæiske datoer (`30.3.2026`) vil nu matche korrekt i Pass 2
- Eksisterende ISO/US-datoer håndteres stadig via fallback
- Ingen påvirkning af andre klienter eller passes

