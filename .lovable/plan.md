

# Fjern december og januar fra Forecast vs. Actual chart

## Problem
Chartet viser de seneste 5 måneder, men december og januar havde ingen salg og giver støj i grafen.

## Løsning
Filtrer perioder uden data (0 actual + 0 forecast) fra resultatet i `useForecastVsActual.ts`.

### `src/hooks/useForecastVsActual.ts`

Efter `results.push(...)` (linje 103-110), tilføj et filter inden return:

```ts
return results.filter(r => r.actual > 0 || r.forecastExpected > 0);
```

Dette fjerner automatisk alle måneder hvor der hverken er faktiske salg eller forecast — altså december og januar, samt fremtidige tomme måneder.

| Fil | Ændring |
|-----|---------|
| `src/hooks/useForecastVsActual.ts` | Filtrer tomme perioder fra resultatet |

