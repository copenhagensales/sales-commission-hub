
## Tilføj "Engelsk opsummering"-valg på TDC Opsummering

### Ændring
I `src/pages/TdcOpsummering.tsx` (og tilsvarende `TdcOpsummeringPublic.tsx` for konsistens):

1. Udvid `SummaryVariant`-typen med `"engelsk"`:
   ```
   type SummaryVariant = "standard" | "pilot" | "5g-fri" | "engelsk";
   ```

2. Tilføj en fjerde `RadioGroupItem` ved siden af "Kun 5g Fri Salg":
   - Værdi: `engelsk`
   - Label: "Engelsk opsummering"

### Adfærd
- Valget kan vælges visuelt, men ændrer **ikke** den genererede tekst endnu.
- Den eksisterende generator-logik (`summaryLines` useMemo) rører jeg ikke — `engelsk`-valget falder igennem til standard-flowet indtil oversættelser leveres.
- Validerings-bannerlogik (`showWarningBanner`) bevares uændret.

### Senere (når oversættelser modtages)
Tilføj `const isEngelsk = summaryVariant === "engelsk"` og en parallel tekstblok i `summaryLines`-genereringen — klar til drop-in.

### Filer berørt
- `src/pages/TdcOpsummering.tsx` (primær)
- `src/pages/TdcOpsummeringPublic.tsx` (samme tilføjelse for paritet)
