

# Fix: Sandra R forecast i klientforecast (useClientForecast.ts)

## Problem
Rettelsen fra `useTeamGoalForecast.ts` (bookingOnly-logikken) blev **ikke** spejlet i `useClientForecast.ts`. Denne hook har sin egen `countShifts`-funktion (linje 330-369) som stadig falder igennem til team standard shifts (mon-fre = ~22 vagter). Derudover returnerer `getNormalWeeklyShifts` (linje 395) `return 5` som fallback.

Det er derfor Sandra R stadig fremskrives med 144 salg — systemet bruger `useClientForecast` på forecast-siden, ikke `useTeamGoalForecast`.

## Løsning

### 1. `useClientForecast.ts` — Tilføj bookingOnly-logik til `countShifts`
- Tilføj `bookingOnly`-parameter til `countShifts` (ligesom i useTeamGoalForecast)
- Når `bookingOnly = true`: spring employee standard og team standard over

### 2. `useClientForecast.ts` — Brug bookingOnly for forecast-måneden
- Før `grossShifts` og `forecastShifts` beregnes (linje 479-482): check om medarbejderen har individuelle vagter eller booking assignments i forecast-perioden
- Hvis ingen af delene findes: brug `countShifts(..., bookingOnly=true)` som giver 0

### 3. `useClientForecast.ts` — Ret `getNormalWeeklyShifts` fallback
- Fjern `return 5` fallback. Hvis ingen standard shifts og ingen bookinger findes, returnér 0 i stedet for 5

| Fil | Ændring |
|-----|---------|
| `src/hooks/useClientForecast.ts` | Tilføj bookingOnly til countShifts + brug det for forecast-vagter + ret fallback |

## Resultat
Sandra R (og alle andre FM-medarbejdere uden bookinger i forecast-måneden) vil få `grossShifts = 0`, `plannedHours = 0`, og dermed `forecast = 0`.

