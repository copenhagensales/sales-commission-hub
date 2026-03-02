

# Sørg for at Excel-arket indeholder al data

## Problem
Eksport-knappen kan klikkes før rådata er færdigindlæst, fordi den kun tjekker om opsummeringsdata er klar (`!employees.length`). Rådata-queryen kører asynkront i baggrunden og kan stadig paginere. Resultatet: Excel-filen kan mangle Rådata-fanen eller have ufuldstændige data.

## Løsning

### 1. Tilføj loading-state for rådata
- Brug `isLoading`/`isFetching` fra `useQuery` for `rawSalesData`-queryen.
- Disable eksport-knappen når enten opsummering ELLER rådata stadig indlæses.
- Vis en loading-indikator på knappen (spinner + "Henter data...") når data stadig hentes.

### 2. Opdater knap-logik
- Ændr `disabled`-betingelsen til: `!employees.length || isLoadingRaw`
- Vis antal rækker i knappen når data er klar, fx "Download Excel (1.523 rækker)"

Ingen database-ændringer nødvendige — paginering er allerede implementeret korrekt.

