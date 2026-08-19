# Eksport-knap på "Mangler i PowerBI"

## Ændring
Tilføj en "Eksportér"-knap i højre side over tabellen på visningen "Mangler i PowerBI". Den downloader de rækker, der aktuelt vises i tabellen (samme periode, søgning, medarbejder-filter og sortering) som en .xlsx-fil.

Kolonner i filen svarer 1:1 til tabellen:

```text
Salgsdato | Sælger | Mobil | Tastselv
```

Filnavn: `mangler-i-powerbi-<fra>-<til>.xlsx` (datoer fra den valgte/effektive periode). Knappen er deaktiveret, når der ikke er rækker.

## Teknisk
- Fil: `src/pages/vagt-flow/EesyFmDeviations.tsx` (kun frontend).
- Genbrug `downloadExcel` fra `src/utils/excel.ts` (ExcelJS, findes allerede).
- Placér knappen i tabellens header-række (kun når `deviationMode === "missing"`), `variant="outline"` med `Download`-ikon fra lucide.
- Datakilde: den allerede filtrerede/sorterede `deviationRows` — ingen ekstra forespørgsler, ingen ændring i hooks, data eller pricing.
