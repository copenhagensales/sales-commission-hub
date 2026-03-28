

## Fix: "Begge" mode skal skippe row-filter

### Problem
Den gemte konfiguration har filteret `Annulled Sales = 1`, som fjerner alle rækker hvor "Annulled Sales" er tom. Når `uploadType === "both"`, skal **alle** rækker med — dem med værdi (annulleringer) og dem uden (kurvrettelser). Filteret reducerer ~1550 → 183 rækker.

### Ændring

**Fil: `src/components/cancellations/UploadCancellationsTab.tsx`, linje 746**

Tilføj `uploadType !== "both"` til betingelsen:

```typescript
// Before
const filteredData = (filterColumn !== "__none__" && filterValue.trim())
  ? parsedData.filter(row => ...)
  : parsedData;

// After
const filteredData = (uploadType !== "both" && filterColumn !== "__none__" && filterValue.trim())
  ? parsedData.filter(row => ...)
  : parsedData;
```

Én betingelse tilføjet. Når brugeren vælger "Begge", ignoreres row-filteret, og alle rækker sendes videre til matching. Per-række type-logikken i queue-insert (`Annulled Sales` har værdi → cancellation, tom → basket_difference) håndterer klassificeringen.

