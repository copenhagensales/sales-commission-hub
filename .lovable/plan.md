

# Debug & Fix: Sandra R stadig med 144 salg i forecast

## Problem
Koden i `useClientForecast.ts` ser korrekt ud — `useBookingOnly`-logikken burde give Sandra 0 vagter og dermed 0 forecast. Men hun viser stadig 144. Der er to mulige årsager:

1. **Sandra har en `employee_standard_shift`-entry** i databasen, som giver hende et shift_id. I det tilfælde finder `empStandardDays` dage (f.eks. man-fre), og selvom `bookingOnly=true` burde springe det over, kan der være et subtilt problem.

2. **Ændringerne er ikke trådt i kraft** — React Query cacher resultater med `staleTime`, og brugerens browser kan vise cached data fra før rettelsen.

## Plan

### 1. Tilføj debug-logging for Sandra
Tilføj midlertidig `console.log` i forecast-loopet der viser:
- `hasAnyForecastShifts`, `hasAnyForecastBookings`, `useBookingOnly`
- `grossShifts`, `forecastShifts`, `plannedHours`
- Om hun har `empStandardDays`

Denne log gør det muligt at se i konsollen præcis hvad der sker.

### 2. Forcer `useBookingOnly`-logikken med ekstra sikkerhed
Tilføj en **sekundær check**: Hvis `grossShifts > 0` men `useBookingOnly === true`, tving `grossShifts = 0`. Dette er et safety-net i tilfælde af en edge case i `countShifts`.

### 3. Check om `employee_standard_shifts` giver Sandra vagter
I `countShifts`-funktionen: Selv med `bookingOnly=true` springes standard shifts korrekt over (linje 361). Men der kan være en timing-bug hvor `empStandardDays` linker til et shift_id der også bruges som team standard shift. Tilføj ekstra logging for at verificere.

| Fil | Ændring |
|-----|---------|
| `src/hooks/useClientForecast.ts` | Tilføj debug-log + safety-net for bookingOnly |

