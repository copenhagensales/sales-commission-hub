

# Adskil churn fra individuelle forecasts

## Problem
Churn trækkes fra **hver medarbejders** forecast (linje 141: `expected - churnLoss`). Det gør at William, der måske har 45% churn-risiko, kun viser 1 salg — selvom hans reelle forventede produktion er højere. Churn er en statistisk risiko på holdniveau, ikke en individuel nedjustering.

## Løsning
Vis **fuld forecast per medarbejder** (uden churn-fradrag). Churn trækkes kun fra **totalen** som en samlet risiko-justering.

### `src/lib/calculations/forecast.ts`

**`forecastEstablishedEmployee`**: Beregn `forecastSales = expected` (uden `- churnLoss`). Behold `churnProbability` og `churnLoss` som informationsfelter, men lad dem ikke reducere individuelle tal.

```
forecastSales: Math.round(expected),          // FØR: expected - churnLoss
forecastSalesLow: Math.round(expected * LOW_FACTOR),
forecastSalesHigh: Math.round(expected * HIGH_FACTOR),
```

**`calculateFullForecast`**: `totalEstablishedChurnLoss` beregnes stadig som summen af alle individuelle `churnLoss` — men trækkes kun fra **totalen**, ikke per person.

### UI-effekt (automatisk)
- William viser fx 18 salg (hans reelle kapacitet) i stedet for 1
- Totalen viser: "Forventet: 1.250 — heraf churn-risiko: -85 salg"
- Drivers-panelet viser stadig "Etableret churn: -X salg" som samlet justering

| Fil | Ændring |
|-----|---------|
| `src/lib/calculations/forecast.ts` | Fjern `- churnLoss` fra individuel forecast, behold på total-niveau |

