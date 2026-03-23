

# Tilføj OPP-nummer matching til annullerings-upload

## Problem
Når TDC Erhverv bruger annullerings-upload, matcher systemet kun på telefonnummer og virksomhedsnavn. TDC Erhverv identificerer salg via OPP-nummer (gemt i `adversus_opp_number` kolonnen i `sales`-tabellen), så der skal tilføjes OPP-matching.

## Ændring

### `src/components/cancellations/UploadCancellationsTab.tsx`

**1. Tilføj OPP-kolonne state**
- Ny state: `oppColumn` med default `"__none__"`
- Reset i `handleReset()`

**2. Tilføj OPP-kolonne vælger i mapping UI**
- Nyt `<Select>` felt: "OPP-kolonne (valgfri)" ved siden af telefon og virksomhed
- Grid ændres fra 3 til 4 kolonner

**3. Udvid matching-logik i `handleMatch()`**
- Udtræk OPP-værdier fra parsed data (normaliser til `OPP-XXXXXX` format)
- Valideringscheck: mindst én af telefon/virksomhed/OPP skal vælges
- Tilføj `.or()` filter på `adversus_opp_number` i salgs-queryen
- Merge OPP-matches med telefon/virksomhed-matches

**4. Vis OPP-nummer i preview-tabel**
- Tilføj `oppNumber` felt til `MatchedSale` interface
- Vis OPP-nummer kolonne i bekræftelses-tabellen

| Fil | Ændring |
|-----|---------|
| `src/components/cancellations/UploadCancellationsTab.tsx` | Tilføj OPP-nummer som matchingkolonne |

