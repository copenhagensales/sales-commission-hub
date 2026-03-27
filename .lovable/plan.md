

## Problem: 1740 umatchede rækker ved Tryg-upload

### Årsag
Tryg's Excel-fil (`data_2.xlsx`) har en **pivottabel-struktur** — ikke flade datarækker. Strukturen er hierarkisk:

```text
Kilde          | Booker_id                    | Årsagsangivelse | Indtastet telefonnummer | Bookede møder | Afholdelse %
FDM CPH        | Total                        |                 |                        | 1,354         | 0.62        ← GRUPPE-HEADER
               | nacj@copenhagensales.dk      | Total           |                        | 544           | 0.61        ← SÆLGER-HEADER
               |                              |                 | Total                  | 228           | 0.34        ← KATEGORI-SUBTOTAL
               |                              |                 | 20209663               | 1             | 1           ← RIGTIG DATAREKKE
               |                              |                 | 20238444               | 1             | 1           ← RIGTIG DATAREKKE
```

Systemet behandler **alle rækker** som potentielle salg, inklusiv:
- **"Total"-rækker** (gruppe-, sælger- og kategori-subtotaler)
- **Rækker uden telefonnummer** (headers hvor "Kilde" eller "Booker_id" er udfyldt men telefon er tom)

Disse rækker kan aldrig matche et salg og ender derfor som "umatchede".

### Løsning: Filtrér ikke-data-rækker fra inden matching

Tilføj filtrering i `handleMatch()` i `UploadCancellationsTab.tsx` — efter det eksisterende `filterColumn`/`filterValue`-filter, men før phone-extraction:

**Filtreringsregler for Tryg-formatet:**
1. Fjern rækker hvor `phone_column` ("Indtastet telefonnummer") indeholder teksten "Total" (case-insensitive)
2. Fjern rækker hvor `phone_column` er tom/null OG `seller_column` ("Booker_id") indeholder "Total"
3. Fjern rækker hvor alle kolonner er tomme undtagen "Bookede møder" og "Afholdelse %"

Denne filtrering skal være **generisk** (ikke Tryg-specifik) så den virker for alle klienter:
- **Regel**: Hvis den konfigurerede `phone_column` har værdien "Total" (eller lignende summary-tekst), skip rækken
- **Regel**: Hvis `phone_column` er tom og ingen andre match-kolonner (company, opp, member_number) har reelle værdier, skip rækken

### Teknisk plan

**Fil: `src/components/cancellations/UploadCancellationsTab.tsx`**

1. **Tilføj helper-funktion** `isJunkRow(row, phoneCol, sellerCol)` der returnerer `true` for:
   - Rækker hvor phone-kolonnen indeholder "Total" (case-insensitive)
   - Rækker hvor phone-kolonnen er tom og alle øvrige match-kolonner også er tomme eller "Total"

2. **Anvend filteret** i `handleMatch()` lige efter linje ~748 (efter filterColumn-filter):
   ```
   const cleanedData = filteredData.filter(row => !isJunkRow(row.originalRow, ...));
   ```
   Brug `cleanedData` i stedet for `filteredData` i resten af funktionen.

3. **Opdater toast-besked** til at vise antal filtrerede rækker, så brugeren kan se at f.eks. "1740 header/total-rækker blev ignoreret".

### Forventet resultat
- De ~1740 "Total"- og header-rækker filtreres fra inden matching
- Kun rækker med faktiske telefonnumre (8-cifrede danske numre) forsøges matchet
- Ingen ændringer i database eller konfiguration — kun kodeændring

### Risiko
Lav — filtreret er defensiv (tjekker for "Total"-tekst og tomme match-kolonner). Eksisterende klienter med flade Excel-filer påvirkes ikke.

