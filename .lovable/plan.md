

# Fix: Ramp-up model mangler i forecast-beregningen

## Problem
`forecastNewEmployee`-funktionen blev aldrig faktisk tilføjet til `src/lib/calculations/forecast.ts`. Linje 229 kører **alle** medarbejdere gennem `forecastEstablishedEmployee` (EWMA), uanset anciennitet. Max har 5 dages anciennitet, ingen afsluttede uger, EWMA = 0 → remaining forecast = 0 → total = kun hans 7 faktiske salg.

## Løsning
Implementér den tidligere godkendte ramp-up plan i praksis:

### `src/lib/calculations/forecast.ts`
1. Tilføj `forecastNewEmployee(emp, rampProfile, baselineSph, teamChurnRates)`:
   - SPH = `baselineSph × getRampFactor(daysSinceStart, rampProfile)`
   - Forecast = `plannedHours × attendanceFactor × rampedSph`
   - Sæt `isEstablished: false`, `isNew: true`, `rampFactor`

2. Opdater `calculateFullForecast` signatur til at acceptere `baselineSph` og `rampProfile` (optional)

3. Split medarbejdere: `isEstablished` → EWMA, ellers → ramp-up

### `src/hooks/useClientForecast.ts`
- Send `baselineSph` og `MOCK_RAMP_PROFILE` til `calculateFullForecast`

### `src/components/forecast/ForecastBreakdownTable.tsx`
- Vis nye medarbejdere med "Under oplæring" badge + ramp-faktor i stedet for "Churn-risiko"

### Effekt
Max (dag 5, 15% ramp) med fx baseline SPH 0.45 og 7 resterende vagter → remaining forecast ~4 salg → total = 7 + 4 = 11 salg i stedet for bare 7.

| Fil | Ændring |
|-----|---------|
| `src/lib/calculations/forecast.ts` | Tilføj `forecastNewEmployee`, opdater `calculateFullForecast` |
| `src/hooks/useClientForecast.ts` | Send baselineSph + rampProfile til beregning |
| `src/components/forecast/ForecastBreakdownTable.tsx` | "Under oplæring" badge for nye sælgere |

