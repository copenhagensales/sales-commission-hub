

## Fix: Sygdoms-ikon vises ikke når medarbejder har en vagt

### Problem
Når Melissa meldes syg på en dag hvor hun allerede har en vagt, registreres sygdommen korrekt i databasen, men ikonet (Thermometer + "Syg") vises ikke i kalenderoversigten. Det skyldes at alle status-badges (Syg, Ferie, Fridag, Udeblivelse) kun renderes når `!hasShift` er opfyldt (linje 1465-1491 i `ShiftOverview.tsx`).

### Løsning
Ændr renderingslogikken i `ShiftOverview.tsx` så absence-badges vises OGSÅ når der er en vagt. Konkret:

1. **Fjern `!hasShift`-betingelsen** fra sick/vacation/no_show/day_off badge-renderingen (linje 1465, 1472, 1479, 1486).
2. **Vis badges under shift-kortet**, så begge informationer er synlige — man kan se både vagttiden og sygdoms-status.

### Fil der ændres

| Fil | Ændring |
|-----|---------|
| `src/pages/shift-planning/ShiftOverview.tsx` | Fjern `!hasShift &&` fra de 4 absence-badge betingelser (linje 1465, 1472, 1479, 1486) |

### Resultat
Sygdoms-ikonet (og øvrige status-ikoner) vises uanset om medarbejderen har en planlagt vagt den dag.

