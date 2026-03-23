

# Fix: Vis kun opstartshold inden for rapportens periode

## Problem
Rapporten viser alle opstartshold uanset startdato — fx et april-hold nævnes i en marts-rapport, hvor det ikke har nogen effekt.

## Ændring

### 1. `src/pages/ForecastClientReport.tsx` — `ReportCohorts` (linje 309)
Filtrér cohorts så kun dem med `startDate` inden for `forecast.periodStart`–`forecast.periodEnd` vises:
```
const activeCohorts = forecast.cohorts.filter(c => 
  (c.forecastSales > 0 || c.plannedHeadcount > 0) &&
  c.startDate <= forecast.periodEnd && c.startDate >= forecast.periodStart
);
```

Samme filter i `ReportSummary` (linje 164) og `ReportKeyFigures` (linje 222/241) hvor cohorts tælles/summeres.

### 2. `src/utils/forecastReportPdfGenerator.ts` (linje 16, 109, 113, 126)
Samme periodefilter på `forecast.cohorts` i PDF-generatoren, så print-versionen også kun inkluderer relevante hold.

| Fil | Ændring |
|-----|---------|
| `src/pages/ForecastClientReport.tsx` | Filtrér cohorts på periodStart/periodEnd i 3 komponenter |
| `src/utils/forecastReportPdfGenerator.ts` | Samme periodefilter i PDF-output |

