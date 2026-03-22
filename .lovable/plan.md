

# Tilføj opstartshold-sektion i kundarapporten

## Problem
Kundarapporten nævner kun opstartshold kort i teksten ("X opstartshold") og som en positiv effekt ("+Y salg"), men viser ikke **detaljer**: hvornår holdene starter, hvor mange personer, og hvad de forventes at bidrage med. Kunden kan ikke se at der er planlagt nye hold.

Cohort-salg er allerede inkluderet i forecast-beregningen (også næste måned) — det er kun rapporten der mangler at vise det tydeligt.

## Løsning
Tilføj en ny **"Planlagte opstartshold"**-sektion i kundarapporten, placeret mellem Nøgletal og Drivers.

### Ny sektion i `ForecastClientReport.tsx`
- Ny komponent `ReportCohorts` der viser:
  - Antal hold og samlet forventet bidrag
  - Per hold: startdato, antal sælgere, forventet salg, ramp-fase (fx "Uge 1-2: 35% kapacitet")
  - Kort tekst: "Nye hold er indregnet i det samlede forecast med gradvis optrapning"
- Vises kun hvis `forecast.cohorts.length > 0`

### Opdatering af PDF-generatoren (`forecastReportPdfGenerator.ts`)
- Tilføj samme cohort-sektion i HTML-rapporten mellem Nøgletal og Drivers
- Vis tabel med startdato, headcount og forventet salg per hold

### Ingen beregningsændringer
Cohort-salg er allerede korrekt inkluderet i `totalSalesExpected` for både denne og næste måned via `calculateFullForecast`.

| Fil | Ændring |
|-----|---------|
| `src/pages/ForecastClientReport.tsx` | Ny `ReportCohorts` sektion med hold-detaljer |
| `src/utils/forecastReportPdfGenerator.ts` | Tilføj cohort-tabel i PDF-rapporten |

