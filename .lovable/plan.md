

## Gør junk-row filter konfigurerbart per kunde

### Problem
Rule 3 i junk-filteret fjerner rækker hvor telefon er tom og ingen andre match-kolonner har værdier. For nogle kunder (f.eks. Tryg med pivot-tabeller) er det korrekt. For andre kunder mister vi reelle datarækker (199 rækker i dette tilfælde).

Filteret skal være kundespecifikt — ligesom alle andre upload-logikker allerede er det via `cancellation_upload_configs`.

### Løsning

**1. Database: Tilføj kolonne**

Tilføj `skip_empty_row_filter` (boolean, default `false`) til `cancellation_upload_configs`. Eksisterende kunder beholder nuværende adfærd (Rule 3 aktiv). Kun kunder der slår det til, bevarer tomme rækker.

```sql
ALTER TABLE cancellation_upload_configs
ADD COLUMN skip_empty_row_filter boolean NOT NULL DEFAULT false;
```

**2. UploadCancellationsTab.tsx — Junk-logik (2 steder)**

Læs `activeConfig?.skip_empty_row_filter` og betinget spring Rule 3 over:

**Sted 1 — `handleMatch` (linje 767-769):**
```typescript
// Rule 3: Kun aktiv hvis kunden IKKE har slået skip_empty_row_filter til
if (!activeConfig?.skip_empty_row_filter) {
  const hasAnyMatchValue = sellerVal.length > 0 || companyVal.length > 0 || oppVal.length > 0 || memberVal.length > 0;
  if (!hasAnyMatchValue) return true;
}
```

**Sted 2 — `filteredDataForPreview` (linje 1526):**
Samme betingelse wrappet om den eksisterende tomme-række-check.

**3. Config wizard — Tilføj toggle**

I både opret-wizard (`handleSave`, linje 239) og redigerings-dialog (linje 376), tilføj feltet `skip_empty_row_filter`. 

UI: En `Switch` komponent med label "Behold rækker uden telefonnummer" og beskrivelse "Slå til hvis filen indeholder rækker uden telefon/OPP som stadig er reelle data".

Feltet gemmes ved insert og update af config.

**4. Gem/opdater config (3 steder)**

- Wizard insert (linje 239): tilføj `skip_empty_row_filter: cfgSkipEmptyFilter`
- Edit dialog update (linje 376): tilføj `skip_empty_row_filter: cfgSkipEmptyFilter`  
- Save config mutation (linje 606): tilføj `skip_empty_row_filter: skipEmptyRowFilter`

### Resultat
- Alle eksisterende kunder: Ingen ændring — default `false` holder Rule 3 aktiv.
- Kunder med manglende rækker: Slå toggle til → alle rækker inkluderes, umatchede ender i "Fejl i match" i stedet for at blive slettet.
- Setup er ensartet på tværs af kunder — kun konfigurationen er kundebestemt.

