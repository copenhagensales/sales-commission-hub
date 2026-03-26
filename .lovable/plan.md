

## Simplificér vagter: brug arbejdsdage i måneden

### Ændring
Fjern hele vagt-hierarkiet (individual shifts, employee standard, team standard, absences) og erstat med simpel beregning: **vagter = hverdage (man-fre) i måneden**.

### Hvad ændres i `src/hooks/useClientForecast.ts`

1. **Slet** `isWorkingDay`-funktionen og alle relaterede queries (individual shifts, employee standard shifts, team standard shifts, shift days, absences).

2. **Ny simpel logik**:
   - `shiftCount` = antal hverdage (man-fre) fra månedens start til cutoff-dato
   - `remainingShifts` = antal hverdage fra dagen efter cutoff til månedens slutning
   - Samme tal for alle medarbejdere — ren kalenderbaseret beregning

3. **isNew-klassifikation**: Basér på `employment_start_date` i stedet for historisk vagtantal. Ny = ansat i under `threshold` arbejdsdage (fra ansættelsesdato til i dag).

4. **Fjern unødvendige parallel-queries**: Kun `team_members`, `employee_master_data`, sales og rolling avg queries beholdes. De 5 scheduling-queries slettes.

### Resultat
- Alle medarbejdere får korrekte vagttal (fx ~19 hverdage i marts)
- Ingen afhængighed af shift/standard-shift tabeller
- Hurtigere load (færre DB-kald)
- Korrekt ny/etableret klassifikation baseret på ansættelsesdato

