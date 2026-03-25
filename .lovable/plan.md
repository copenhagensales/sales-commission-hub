

# Inkludér danske helligdage i arbejdsdags-beregning

## Problem
`getWorkingDays()` i `ForecastKpiCards.tsx` tæller kun hverdage minus weekender. Danske helligdage (påske, Kr. Himmelfart, pinse, juledag osv.) ignoreres, hvilket giver et for højt antal arbejdsdage — og dermed et for lavt "salg/dag"-krav.

## Fix

### 1. `src/components/forecast/ForecastKpiCards.tsx`
- Fetch danske helligdage fra `danish_holiday`-tabellen for forecast-perioden (allerede brugt andre steder i appen, f.eks. `useEmployeeWorkingDays`)
- Opdatér `getWorkingDays` til også at filtrere helligdage fra
- Alternativt: flyt helligdage-fetch op i `Forecast.tsx` og send dem som prop

### Tilgang
Da `ForecastKpiCards` er en ren presentationskomponent, er det renere at:
1. Tilføje et `danishHolidays` prop til `ForecastKpiCards`
2. Fetche helligdage i `Forecast.tsx` (ligesom `MyGoals.tsx` allerede gør)
3. Sende dem ned som prop
4. Opdatere `getWorkingDays()` til at modtage en liste af helligdagsdatoer og ekskludere dem

### Konkret ændring i `getWorkingDays`:
```ts
function getWorkingDays(start: string, end: string, holidays: string[] = []): number {
  const holidaySet = new Set(holidays);
  const days = eachDayOfInterval({ start: parseISO(start), end: parseISO(end) });
  return days.filter(d => !isWeekend(d) && !holidaySet.has(format(d, 'yyyy-MM-dd'))).length;
}
```

## Berørte filer
| Fil | Ændring |
|-----|---------|
| `src/pages/Forecast.tsx` | Fetch `danish_holiday` for forecast-perioden, send som prop |
| `src/components/forecast/ForecastKpiCards.tsx` | Modtag `danishHolidays` prop, ekskludér dem i `getWorkingDays` |

## Effekt
April 2026: 22 hverdage → **19 arbejdsdage** (minus Skærtorsdag, Langfredag, 2. Påskedag). Salg/dag-tallet stiger tilsvarende og bliver mere realistisk.

