

# Fix: ForecastSummary skal bruge override-justeret total

## Problem
`ForecastSummary` (linje 20) bruger `forecast.totalSalesExpected` direkte og kender ikke til manuelle overrides. Tallet i toppen ("forventede salg") matcher derfor ikke totalen i bunden af tabellen efter justeringer.

## Løsning

### 1. `ForecastSummary.tsx`
- Tilføj optional `overrideTotal?: number` prop
- Brug `overrideTotal ?? forecast.totalSalesExpected` som `totalSales` (linje 20)
- Samme for target-diff beregningen (linje 122)

### 2. `Forecast.tsx`
- Send `overrideAdjustedTotal` (allerede beregnet) som prop til `ForecastSummary`

| Fil | Ændring |
|-----|---------|
| `src/components/forecast/ForecastSummary.tsx` | Ny `overrideTotal` prop, brug den i visning + target-diff |
| `src/pages/Forecast.tsx` | Send `overrideAdjustedTotal` til `ForecastSummary` |

