

# Fix: Skip uger med 0 salg og kun team-standard vagter i EWMA

## Problem
Melissa har 0 salg i marts fordi hun har haft fri. Men `countShifts` returnerer 5 vagter/uge (fra team standard man-fre), så 50%-reglen springer IKKE ugen over. Resultatet: uger med 0 salg tæller som 0 SPH → trækker hele gennemsnittet ned.

Linje 460-461 har allerede en safety: "skip weeks with 0 sales and ≤2 shifts" — men team standard giver 5 shifts, så den trigges ikke.

## Løsning
Udvid skip-logikken (linje 460-461) til også at springe uger over hvor:
- Medarbejderen har **0 salg** i ugen
- Medarbejderen har **0 individuelle vagter og 0 booking assignments** i ugen (dvs. alle vagter kommer kun fra team/employee standard)

Hvis der ikke er nogen konkret vagtdata (kun standard-fallback) OG ingen salg, er det sandsynligt at medarbejderen ikke arbejdede den uge.

## Ændring i `src/hooks/useClientForecast.ts`

### Linje 438-461: Tilføj check for "kun standard-vagter"
Tilføj en hjælpefunktion `countConcreteShifts(empId, start, end)` der KUN tæller individuelle vagter + booking assignments (ikke standard fallback). Brug den i EWMA-loopet:

```typescript
// After line 461, replace the skip condition:
const concreteShiftsInWeek = countConcreteShifts(emp.id, ws, we);
if (salesInWeek === 0 && concreteShiftsInWeek === 0) continue;
```

### Ny hjælpefunktion `countConcreteShifts` (efter linje 374)
Tæller kun individuelle vagter + booking assignments for en periode, ignorerer standard-fallback. Bruges kun til at afgøre om en uge skal springes over.

## Resultat
- Melissa marts-uger: 0 salg + 0 konkrete vagter → springes over → SPH baseres kun på jan/feb
- Melissa med salg+bookinger: tælles normalt
- Non-FM medarbejdere med rigtige vagter (individuelle): uændret

| Fil | Ændring |
|-----|---------|
| `src/hooks/useClientForecast.ts` | Tilføj `countConcreteShifts`, ret EWMA skip-logik |

