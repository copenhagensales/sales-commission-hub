

## Excel-intern dedup af dublet-rækker (før database-matching)

### Problem
Når Excel-arket indeholder flere rækker med samme telefonnummer (f.eks. to 5G Internet-rækker for `51759867`), og disse rækker aldrig matches mod databasen (fordi de er `phone_excluded`), ender de alle i "Fejl i match". Den eksisterende dedup-logik (`mergedMatchedSales`) virker kun på rækker der **allerede er matchet** — den fanger aldrig rækker der blev sprunget over.

### Løsning
Tilføj et Excel-internt dedup-step **umiddelbart efter `cleanedData`** (linje ~864), **før** Pass 1a/1b/2 kører. Rækker med samme normaliserede telefonnummer merges, så kun én repræsentant sendes videre. De øvrige markeres som "Excel-dubletter" og inkluderes i `coveredRowIndices`.

### Hvad ændres IKKE
- Pass 1a, 1b, 2 matching-logik
- `phone_excluded_products` håndtering (`if (isExcluded) return;`)
- Merge-logik for matchede salg (`mergedMatchedSales`)
- Rollback, godkendelseskø, LocateSaleDialog
- Klassificering (cancellation/correct_match/basket_difference)

### Ændringer — kun `UploadCancellationsTab.tsx`

**1. Nyt pre-processing step i `handleMatch` (efter linje 864)**
- Gruppér `cleanedData` rækker efter normaliseret telefonnummer
- For grupper med >1 række: behold første som repræsentant, gem resten i et `excelDuplicateIndices: Set<number>` (state)
- Kun repræsentant-rækker bruges videre i `cleanedData` til matching

**2. Udvid `coveredRowIndices` (linje ~1970)**
- Tilføj `excelDuplicateIndices` til `covered`-settet, så dublet-rækkerne ikke vises som umatched og heller ikke ender i annulleringer/kurvrettelser-fanerne

**3. Vis Excel-dubletter i preview**
- Tilføj en info-sektion i preview der viser antal Excel-interne dubletter der er fjernet

### Resultat
- Dublet-rækker i Excel fjernes automatisk før matching og vises ikke i "Fejl i match", "Annulleringer" eller "Kurvrettelser"
- Kun én repræsentant per telefonnummer sendes til database-matching
- Alle eksisterende matching-regler forbliver 100% uændrede

