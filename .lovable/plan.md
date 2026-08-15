# PB Dato-kolonne i afvigelsesoversigten

Salgsdatoen i tabellen kommer i dag fra Stork (`sales.sale_datetime`), ikke fra Excel-arket. For at kunne se om PowerBI har en anden dato, tilføjes datoen fra arket som egen kolonne.

## Hvad brugeren får

- Ny kolonne "PB Dato" i "Afvigelser — oversigt", placeret lige efter "Salgsdato".
- Viser datoen fra det uploadede PowerBI-ark for den matchede række, eller "-" hvis den ikke findes.
- "Salgsdato" (Stork) og sortering fungerer uændret.

## Teknisk

- `src/hooks/useEesyFmDeviations.ts`: eksponér arkets dato på den matchede PowerBI-række i `DeviationRow` som `powerBiDate` (feltet indlæses allerede fra kolonne A ved import).
- `src/pages/vagt-flow/EesyFmDeviations.tsx`: tilføj "PB Dato" i `OVERVIEW_COLUMNS` og en tilhørende celle i `DeviationsPanel`, formateret `dd/MM/yyyy`.

Ingen ændringer i database, import-logik eller matchning.
