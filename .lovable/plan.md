

# Fix: Totaler opdateres ikke ved manuelle overrides

## Problem
Når du manuelt justerer forecast-tal for individuelle medarbejdere, opdateres hverken:
1. **Total-rækken** i bunden af etablerede sælgere-tabellen (bruger `e.forecastSales` i stedet for override-værdien)
2. **KPI-kortet "Forventet salg"** i toppen (bruger `forecast.totalSalesExpected` som ikke kender til overrides)

## Løsning

### 1. `ForecastBreakdownTable.tsx` — Total-rækken (linje 288-300)
Erstat `e.forecastSales` med override-aware logik:
```
const getDisplayForecast = (e) => overrides?.get(e.employeeId)?.override_sales ?? e.forecastSales;
```
Brug denne i alle `reduce()` kald i footer-rækken.

### 2. `ForecastKpiCards.tsx` — Modtag override-justeret total
Tilføj en optional `overrideTotal` prop. Når sat, brug den i stedet for `forecast.totalSalesExpected`.

### 3. `Forecast.tsx` — Beregn og send justeret total
Beregn en `adjustedTotal` baseret på `forecast.totalSalesExpected` + summen af alle override-forskelle (override - original). Send som prop til `ForecastKpiCards`.

## Berørte filer

| Fil | Ændring |
|-----|---------|
| `src/components/forecast/ForecastBreakdownTable.tsx` | Footer bruger override-værdier i totaler |
| `src/components/forecast/ForecastKpiCards.tsx` | Ny optional `overrideTotal` prop |
| `src/pages/Forecast.tsx` | Beregn justeret total og send til KPI-kort |

