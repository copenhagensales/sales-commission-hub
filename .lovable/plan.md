

## Tillad oprettelse af vagter på helligdage

### Problem
Kalenderen i "Opret ny vagt" dialogen deaktiverer alle standard-arbejdsdage (f.eks. mandag-fredag), fordi de allerede er dækket af team-standardvagten. Det betyder at helligdage der falder på hverdage (f.eks. juledag på en onsdag) også er deaktiverede — og man kan ikke oprette en manuel vagt på dem.

### Løsning
Importér `useDanishHolidays` i `CreateShiftDialog` og tilføj et tjek i `isDateDisabled`: hvis datoen er en helligdag, skal den **ikke** deaktiveres (return false), så brugeren kan vælge den og oprette en vagt.

### Teknisk ændring

**`src/components/shift-planning/CreateShiftDialog.tsx`**
1. Importér `useDanishHolidays` fra `@/hooks/useShiftPlanning`
2. Kald hooket i komponenten
3. I `isDateDisabled`-funktionen: tilføj et tidligt return `false` hvis datoen matcher en helligdag — før de øvrige tjek for standard-arbejdsdage

Logik:
```text
isDateDisabled(date):
  1. Har allerede en individuel vagt? → disabled (uændret)
  2. Er det en helligdag? → IKKE disabled (NY)
  3. Er det en standard-arbejdsdag? → disabled (uændret)
```

Ingen database-ændringer. Kun én fil ændres.

