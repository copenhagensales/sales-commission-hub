

# Fix: Respektér special shifts med 0 dage (Sandra, Jesus, Martin Lind m.fl.)

## Problem
Flere FM-medarbejdere (Sandra R, Jesus, Martin Lind osv.) har en **special shift** tildelt i `employee_standard_shifts`, men den shift har **0 dage konfigureret**. Det betyder: "denne medarbejder har ikke faste vagter".

Men `countShifts` ser `empStandardDays = undefined` (fordi `shiftDaysMap` ikke har nogen dage for det shift_id) og falder igennem til **team standard** (man-fre = 22 dage). Det giver forkert forecast.

Den korrekte logik (som vagtplanen bruger): Hvis medarbejderen HAR en special shift → brug KUN den, også selvom den har 0 dage. Fald ALDRIG igennem til team standard.

## Ændringer i `src/hooks/useClientForecast.ts`

### 1. Ret `countShifts` fallback (linje 361-367)
**Fra:**
```typescript
} else if (!bookingOnly) {
  if (empStandardDays !== undefined) {
    if (empStandardDays.includes(dayNumber)) count++;
  } else if (teamDays && teamDays.includes(dayNumber)) {
    count++;
  }
}
```

**Til:**
```typescript
} else {
  const empHasSpecialShift = empShiftIdMap.has(empId);
  if (empHasSpecialShift) {
    // Employee has a special shift — use ONLY its days (even if 0)
    if (empStandardDays && empStandardDays.includes(dayNumber)) count++;
  } else if (teamDays && teamDays.includes(dayNumber)) {
    // No special shift — fall back to team standard
    count++;
  }
}
```

### 2. Fjern FM bookingOnly-logik (linje 486-492)
Fjern `isFmEmployee`, `useBookingOnly` og `bookingOnly`-parameteren fra forecast-kaldene. Standard `countShifts` håndterer det nu korrekt for alle.

### 3. Ret `getNormalWeeklyShifts` tilsvarende
Samme logik: Hvis medarbejder har special shift → brug dens dage, fald ikke igennem til team standard.

## Resultat
- Sandra R, Jesus, Martin Lind (special shift, 0 dage): 0 vagter → 0 forecast ✓
- Andre FM-medarbejdere uden special shift: Team standard (man-fre) tælles → "ikke booket" = rigtig vagt ✓
- Non-FM medarbejdere: Uændret

| Fil | Ændring |
|-----|---------|
| `src/hooks/useClientForecast.ts` | Ret countShifts fallback, fjern bookingOnly FM-logik, ret getNormalWeeklyShifts |

