

## Problem: Timing bug — filter ikke anvendt under matching

### Rod-årsag

Når en fil uploades, sker der to ting næsten samtidigt:
1. `applyConfig()` sætter `filterColumn`/`filterValue` via React state (asynkront)
2. `handleMatch()` køres via `useEffect` — men React har endnu ikke "flushed" state-opdateringerne fra step 1

**Bevis fra konsollen:**
```
[handleMatch] total rows: 1550 after filter: 1550 junk rows removed: 0 clean rows: 1550
```
Filteret "Annulled Sales = 1" blev aldrig anvendt — `filterColumn` var stadig `"__none__"` da handleMatch kørte.

Resultatet: handleMatch matcher mod alle 1550 rækker og gemmer `matchedRowIndices` som indices i det ufiltrerede array. Men `filteredDataForPreview` (som kører ved render) anvender det nu-opdaterede filter og viser kun 1351 rækker. Indices'ene passer ikke sammen → 199 rækker forsvinder.

### Løsning

**Fil: `src/components/cancellations/UploadCancellationsTab.tsx`**

**1. handleMatch: Læs filter fra config i stedet for state** (linje 770-773)

I stedet for at bruge state-variablerne `filterColumn`/`filterValue`, læs direkte fra `activeConfig` (som allerede er hentet på linje 745):

```typescript
// Brug config direkte i stedet for asynkron state
const cfgFilterColumn = activeConfig?.filter_column || "__none__";
const cfgFilterValue = activeConfig?.filter_value || "";

const filteredData = (uploadType !== "both" && cfgFilterColumn !== "__none__" && cfgFilterValue.trim())
  ? parsedData.filter(row => String(getCaseInsensitive(row.originalRow, cfgFilterColumn) ?? "").trim() === cfgFilterValue.trim())
  : parsedData;
```

**2. matchedRowIndices: Brug parsedData-index i stedet for cleanedData-index**

Problemet er at indices gemmes relativt til `cleanedData` (et filtreret subset), men bruges mod `filteredDataForPreview` (et andet filtreret subset).

Ændring: Gem det **originale parsedData-index** i stedet:

- I `cleanedData`-iterationerne (pass 1, 1b, 2 og standard matching), brug `row.originalIndex` i stedet for det lokale `idx`.
- Tilføj `originalIndex` når data oprettes: ændre linje 803 til at bevare original index:

```typescript
const cleanedDataWithIndex = filteredData
  .map((row, filteredIdx) => ({ ...row, originalIndex: parsedData.indexOf(row) }))
  .filter(row => !isJunkRow(row.originalRow));
```

Alternativt (enklere): Tilføj `originalIndex` allerede ved parsing (linje 700):
```typescript
setParsedData(jsonData.map((row, idx) => ({ originalRow: row, originalIndex: idx })));
```

Og brug `row.originalIndex` overalt hvor `idx` bruges til `matchedIndices.add(idx)`.

**3. filteredDataForPreview: Brug originalIndex til at tjekke match** (linje 1562)

```typescript
const unmatchedRows = filteredDataForPreview.filter(row => !matchedRowIndices.has(row.originalIndex));
```

**4. sendToQueueMutation: Samme fix** (linje 1435-1436)

```typescript
const unmatchedRows = filteredForQueue
  .filter(row => !matchedRowIndices.has(row.originalIndex))
  .map(r => r.originalRow);
```

### Resultat

- Filteret "Annulled Sales = 1" anvendes korrekt under matching (1351 rækker, ikke 1550)
- Matched/unmatched-indices er stabile og passer på tværs af alle visninger
- Alle 1351 filtrerede rækker vises korrekt (1307 matched + 44 unmatched = 1351)

