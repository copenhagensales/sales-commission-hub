

# Fix: Tillad weekend-bookinger i Fieldmarketing booking-systemet

## Problem

Booking-dialogerne (`EditBookingDialog` og `AddEmployeeDialog`) bruger en `hasShiftOnDay`-funktion til at filtrere dage ved submission. Paa loerdag/soendag returnerer `hasShiftOnDay` `false` fordi Fieldmarketing-teamets standardvagter kun daekker mandag-fredag. Det betyder at selvom en medarbejder vaelges til loerdag, bliver dagen stille filtreret fra ved gem.

Advarslen "Ingen vagt planlagt" vises korrekt som information, men `.filter(dayIndex => hasShiftOnDay(employeeId, dayIndex))` paa linje ~495 (AddEmployeeDialog) og ~822 (EditBookingDialog) fjerner reelt loerdagen fra de gemte dage.

## Loesning

Fjern `hasShiftOnDay`-filteret fra submission-logikken i begge dialoger. Advarslen forbliver synlig som information, men den blokerer ikke laengere tildelingen.

### Fil 1: `src/components/vagt-flow/AddEmployeeDialog.tsx` (linje ~493-497)

Aendring: Fjern `.filter(dayIndex => hasShiftOnDay(employeeId, dayIndex))` fra dates-arrayet i submit-logikken.

Foer:
```typescript
dates: Array.from(selectedDays)
  .filter(dayIndex => hasShiftOnDay(employeeId, dayIndex))
  .filter(dayIndex => !isBookedOnDay(employeeId, dayIndex))
  .map(dayIndex => format(addDays(weekStart, dayIndex), "yyyy-MM-dd")),
```

Efter:
```typescript
dates: Array.from(selectedDays)
  .filter(dayIndex => !isBookedOnDay(employeeId, dayIndex))
  .map(dayIndex => format(addDays(weekStart, dayIndex), "yyyy-MM-dd")),
```

### Fil 2: `src/components/vagt-flow/EditBookingDialog.tsx` (linje ~820-824)

Samme aendring: Fjern `.filter(dayIndex => hasShiftOnDay(employeeId, dayIndex))`.

Foer:
```typescript
dates: Array.from(selectedEmployeeDays)
  .filter(dayIndex => hasShiftOnDay(employeeId, dayIndex))
  .filter(dayIndex => !isBookedOnDay(employeeId, dayIndex))
  .map(dayIndex => format(addDays(weekStart, dayIndex), "yyyy-MM-dd")),
```

Efter:
```typescript
dates: Array.from(selectedEmployeeDays)
  .filter(dayIndex => !isBookedOnDay(employeeId, dayIndex))
  .map(dayIndex => format(addDays(weekStart, dayIndex), "yyyy-MM-dd")),
```

### Hvad der IKKE aendres

- Advarslen "Ingen vagt planlagt" forbliver synlig som information (gul/orange tekst)
- `anySelectedHasNoShiftOnDay` og `getNoShiftWarnings` forbliver til visning af advarsler
- Validering for dobbeltbooking (`isBookedOnDay`) forbliver aktiv
- Al anden booking-logik er uaendret

## Risiko

Lav. Aendringen fjerner kun et filter der blokerede gyldige weekend-bookinger. Dobbeltbooking-beskyttelsen (database UNIQUE constraint) er stadig aktiv.

