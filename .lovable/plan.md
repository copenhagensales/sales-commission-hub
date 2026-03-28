

## Tilføj "Ekskluderede rækker" badge i preview

### Problem
Brugeren kan ikke se hvor mange rækker der blev filtreret væk (af filter-kolonne eller junk-regler). De 199 rækker forsvinder uden synlig forklaring.

### Løsning
Tilføj en tredje badge der viser antal ekskluderede rækker, med mulighed for at klikke og se dem.

### Ændringer i `UploadCancellationsTab.tsx`

**1. Beregn ekskluderede rækker (ved `filteredDataForPreview`, linje ~1573)**

```typescript
const excludedRows = parsedData.filter(row => !filteredDataForPreview.some(fp => fp.originalIndex === row.originalIndex));
const excludedCount = excludedRows.length;
```

**2. Udvid `previewTab` type (linje 1576)**
Tilføj `"excluded"` som mulig tab-værdi.

**3. Tilføj badge i UI (efter "umatchede rækker" badge, linje ~1822)**
```
{excludedCount} ikke-uploadede rækker
```
Grå/neutral styling. Klikbar → viser de ekskluderede rækker med årsag (filter eller junk).

**4. Tilføj tab-indhold for excluded**
Vis en tabel med de ekskluderede rækker og en kolonne der forklarer årsagen:
- "Filtreret (kolonnenavn ≠ filterværdi)" for rækker fjernet af filter
- "Tom række / Total-række" for junk-rækker

### Resultat
Brugeren ser f.eks.: `1307 matchede salg | 31 umatchede rækker | 199 ikke-uploadede rækker` — fuld gennemsigtighed over alle rækker i filen.

