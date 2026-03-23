

# Fix: Sandra forecaster +18 salg trods ingen vagter

## Problem
Tilkaldevagt-fallbacken (linje 422-468) aktiveres når `grossShifts === 0` for den resterende periode. Sandra har haft vagter **tidligere** denne måned, men har ingen **flere** planlagte vagter. Koden skelner ikke mellem:
- "Ingen vagter overhovedet" (ægte tilkaldevikar) → brug historisk estimat
- "Ingen vagter **mere** denne måned" (normal medarbejder færdig) → forecast = 0

## Løsning
Tjek om medarbejderen har haft vagter **tidligere** i hele måneden. Hvis ja, er hun en normal medarbejder uden flere vagter — ikke en tilkaldevikar. Fallbacken skal kun aktiveres for medarbejdere der heller ikke har vagter i starten af måneden.

## Ændring

### `src/hooks/useClientForecast.ts` — linje 422-423
Før tilkalde-fallbacken, tjek om medarbejderen har haft vagter fra månedens start til i dag:

```typescript
// Kun aktiver on-call fallback hvis medarbejderen OGSÅ har 0 vagter 
// i hele måneden (ikke bare i den resterende periode)
const monthStart = startOfMonth(new Date(year, month - 1, 1));
const shiftsEarlierInMonth = countShifts(emp.id, monthStart, now, false);

if (grossShifts === 0 && shiftsEarlierInMonth === 0) {
  // On-call fallback logic...
}
```

Medarbejdere som Sandra, der har haft vagter tidligere på måneden men ingen flere, vil nu korrekt få forecast = 0 for resten af perioden.

| Fil | Ændring |
|-----|---------|
| `src/hooks/useClientForecast.ts` | Tilføj check for vagter tidligere i måneden før tilkalde-fallback |

