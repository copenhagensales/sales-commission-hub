

# Fix: `countConcreteShifts` ignorerer fravær og helligdage

## Problem
`countConcreteShifts` tæller rå individuelle vagter + booking assignments UDEN at fratrække godkendt fravær (ferie/sygdom) og helligdage. Hvis Melissa har booking assignments i marts-uger hvor hun var fraværende, viser `concreteShiftsInWeek > 0`, og EWMA-loopet springer IKKE ugen over. Resultatet: uger med 0 salg men "konkrete" vagter (som hun reelt ikke arbejdede) tæller som 0 SPH → trækker gennemsnittet ned til ~143.

## Løsning
Ret `countConcreteShifts` til også at ekskludere:
1. Datoer med godkendt fravær (`absenceDateMap`)
2. Helligdage (`holidayDates`)

## Ændring i `src/hooks/useClientForecast.ts`

### Linje 377-389: Tilføj absence + holiday check
```typescript
function countConcreteShifts(empId: string, rangeStart: Date, rangeEnd: Date): number {
  const individualDates = individualShiftMap.get(empId) || new Set();
  const bookingDates = bookingAssignmentMap.get(empId) || new Set();
  const absenceDates = absenceDateMap.get(empId) || new Set();
  let count = 0;
  const cur = new Date(rangeStart);
  while (cur <= rangeEnd) {
    const dateStr = format(cur, "yyyy-MM-dd");
    if (holidayDates.has(dateStr) || absenceDates.has(dateStr)) {
      cur.setDate(cur.getDate() + 1);
      continue;
    }
    if (individualDates.has(dateStr) || bookingDates.has(dateStr)) {
      count++;
    }
    cur.setDate(cur.getDate() + 1);
  }
  return count;
}
```

## Resultat
- Melissa marts-uger: booking assignments eksisterer, men godkendt fravær → 0 concrete shifts → springes over → SPH baseres på jan/feb → ~254 salg i april
- Andre medarbejdere: uændret (absences allerede håndteret korrekt i `countShifts`)

| Fil | Ændring |
|-----|---------|
| `src/hooks/useClientForecast.ts` | Tilføj absence + holiday check til `countConcreteShifts` |

