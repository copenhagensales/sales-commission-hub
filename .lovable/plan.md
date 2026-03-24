

# Eesy TM annulleringsfil: Filtrér på "Annulled Sales" = 1

## Problem
Excel-filen indeholder alle salg (bekræftede, afviste, annullerede). Kun rækker med `Annulled Sales = 1` skal behandles som annulleringer. Systemet har i dag ingen filtreringsfunktion — alle rækker sendes til matching.

## Løsning
Tilføj en **filterkolonne** og **filterværdi** til mapping-trinnet, så kun rækker der matcher filteret inkluderes i matching.

| Fil | Ændring |
|-----|---------|
| `src/components/cancellations/UploadCancellationsTab.tsx` | Tilføj `filterColumn` og `filterValue` state. Filtrér `parsedData` i `handleMatch` så kun rækker med den valgte filterværdi behandles. Tilføj UI-selectors i mapping-trinnet. |
| `cancellation_upload_configs` (DB) | Tilføj `filter_column TEXT` og `filter_value TEXT` kolonner, så filteret kan gemmes i opsætningen. |

## Konkret flow

1. **Mapping-trinnet**: Ny sektion "Filtrer rækker (valgfri)" med:
   - Dropdown: vælg filterkolonne (f.eks. "Annulled Sales")
   - Tekstfelt: angiv filterværdi (f.eks. "1")
   - Badge der viser: "X af Y rækker inkluderet"

2. **Matching**: Før matching starter, filtreres `parsedData` så kun rækker hvor `row.originalRow[filterColumn] == filterValue` inkluderes. Umatchede rækker beregnes kun ud fra de filtrerede rækker.

3. **Config**: `applyConfig` og `saveConfigMutation` udvides til at inkludere `filter_column` og `filter_value`.

## For Eesy TM
Brugeren sætter:
- Telefonkolonne → "Phone Number"
- Filterkolonne → "Annulled Sales"  
- Filterværdi → "1"

Gemmes som standard-opsætning for Eesy TM.

