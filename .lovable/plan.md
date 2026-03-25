

# Fix: Forecast-interval Low/High skal følge override-justeret total

## Problem
Når du manuelt justerer medarbejder-forecasts, opdateres "Expected" i interval-kortet korrekt (via `overrideTotal`), men **Low og High bruger stadig de originale ukorrigerede værdier** fra `forecast.totalSalesLow/High`.

Eksempel: Expected = 1691 (override-justeret), men Low = 537 (baseret på original beregning × 0.85).

## Løsning

I `ForecastKpiCards.tsx`: Når `overrideTotal` er sat, beregn Low/High ud fra den justerede total:

```typescript
const effectiveLow = overrideTotal 
  ? Math.round(overrideTotal * LOW_FACTOR) 
  : forecast.totalSalesLow;
const effectiveHigh = overrideTotal 
  ? Math.round(overrideTotal * HIGH_FACTOR) 
  : forecast.totalSalesHigh;
```

Brug `effectiveLow`/`effectiveHigh` i begge kort ("Forventet salg" og "Forecast-interval").

| Fil | Ændring |
|-----|---------|
| `src/components/forecast/ForecastKpiCards.tsx` | Beregn override-justeret low/high fra `effectiveTotal` × faktorerne |

