

# Tilføj Fridage og Udeblivelser til EmployeeCalendar

## Problem
`EmployeeCalendar` (brugt på medarbejderdetaljer og Min Profil) viser kun syg og ferie. Fridage (`day_off`) og udeblivelser (`no_show`) tildelt via vagtplan ignoreres — de vises som grønne "Arbejder"-dage.

## Løsning

### 1. Udvid Absence-typen
I `EmployeeCalendar.tsx`: Udvid `Absence.type` fra `"sick" | "vacation"` til `"sick" | "vacation" | "day_off" | "no_show"`.

### 2. Tilføj styling for nye typer
- **Fridag** (`day_off`): Blå baggrund med `CalendarX2`-ikon og "Fridag" label
- **Udeblivelse** (`no_show`): Grå baggrund med `UserX`-ikon og "Udeblivelse" label

### 3. Opdater legenden
Tilføj Fridag og Udeblivelse til legend-sektionen med matchende ikoner og farver.

### Filer der ændres
- `src/components/employee/EmployeeCalendar.tsx` — udvid type, tilføj styling og legend

### Ingen database-ændringer
Data hentes allerede med alle absence-typer fra `absence_request_v2`. Det er kun frontend-visningen der mangler.

