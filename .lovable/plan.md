

# Ramp-up model for nye sælgere (≤60 dage)

## Problem
Nye sælgere som Max (ansat 17. marts) behandles med EWMA ligesom etablerede sælgere. Men EWMA kræver historik — og nye sælgere har ingen. Resultatet er 0 SPH og 0 forecast, selvom de arbejder og forventes at sælge.

## Løsning
For medarbejdere med `daysSinceStart ≤ 60` (allerede markeret som `isEstablished = false`): brug **ramp-up modellen** (samme kurve som cohorts) i stedet for EWMA.

Ramp-kurven giver fx:
- Dag 1-7: 15% af baseline SPH
- Dag 8-14: 35%
- Dag 15-30: 60%
- Dag 31-60: 85%

Max med 5 dage → 15% af team-gennemsnitlig SPH → realistisk lavt forecast i stedet for 0.

## Ændringer

### `src/lib/calculations/forecast.ts`
- Ny funktion `forecastNewEmployee(emp, rampProfile, baselineSph, teamChurnRates)`:
  - SPH = `baselineSph × getRampFactor(daysSinceStart, rampProfile)`
  - Forecast = `plannedHours × attendanceFactor × rampedSph`
  - Markér med `isEstablished: false` i resultatet

- Opdater `calculateFullForecast` til at splitte employees i established vs new:
  - Established (>60 dage) → `forecastEstablishedEmployee` (EWMA, som nu)
  - New (≤60 dage) → `forecastNewEmployee` (ramp-up)

### `src/hooks/useClientForecast.ts`
- Send `baselineSph` og `rampProfile` med til `calculateFullForecast` (allerede beregnet i hooken)

### `src/types/forecast.ts`
- Tilføj `baselineSph` og `rampProfile` som optional parametre til `calculateFullForecast` signatur
- Tilføj `isNew?: boolean` til `EmployeeForecastResult` for UI-visning

### `src/components/forecast/ForecastBreakdownTable.tsx`
- Vis "Under ramp-up" badge (blå) for nye sælgere i stedet for "Churn-risiko"
- Vis ramp-faktor i tooltip (fx "15% af normal kapacitet")

## Effekt
- Max (dag 5) → forecast baseret på 15% af baseline SPH → fx 3-5 salg i stedet for 0
- Kasper (dag 5, har 3 salg) → også ramp-up, men reelle tal kan være højere end ramp-estimatet
- Nye sælgere flyttes fra "Ingen salgsdata" tilbage til hovedtabellen med realistisk forecast
- Ingen ændring for etablerede sælgere

| Fil | Ændring |
|-----|---------|
| `src/lib/calculations/forecast.ts` | Ny `forecastNewEmployee` + split i `calculateFullForecast` |
| `src/hooks/useClientForecast.ts` | Send `baselineSph` + `rampProfile` til forecast-beregning |
| `src/types/forecast.ts` | Tilføj `isNew`, `baselineSph`, `rampProfile` felter |
| `src/components/forecast/ForecastBreakdownTable.tsx` | "Under ramp-up" badge for nye sælgere |

