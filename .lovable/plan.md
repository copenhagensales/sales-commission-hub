

## Ny-medarbejder toggle i forecast breakdown

### Mål
I forecast-breakdown-tabellen (når man opretter teammål) skal medarbejdere der er startet inden for de seneste 20 dage markeres med et ikon. En toggle-knap ved siden af deres navn lader brugeren erstatte deres individuelle S/D med teamets gennemsnit-S/D, så forecasted opdateres tilsvarende.

### Ændringer

**1. `src/hooks/useTeamGoalForecast.ts`**
- Tilføj `employment_start_date` til `employee_master_data` query
- Tilføj `employeeId` og `startDate` felter til `EmployeeForecast` interfacet
- Beregn `isNew` (startet inden for 20 dage fra nu) og inkluder i output

**2. `src/pages/TeamGoals.tsx`**
- Tilføj state: `overriddenEmployees: Set<string>` — tracker hvilke nye medarbejdere der bruger gennemsnit
- Beregn `avgSalesPerDay` fra alle medarbejdere der IKKE er overridden og IKKE er nye (eller kun fra dem med data)
- I breakdown-tabellen:
  - Vis et 🆕 ikon/badge ved nye medarbejdere (< 20 dage)
  - Vis en toggle-knap ved nye medarbejdere
  - Når toggled: erstat S/D med teamgennemsnit, genberegn forecast for den medarbejder
- Opdater total forecast-tallet dynamisk baseret på overrides
- Forecast-knapperne (+5%, +10%, +15%) bruger det justerede total

### UI i breakdown-tabellen
```text
Navn              Salg  Vagter  S/D    Vagter*  Forecast
Christoffer L.    112   20      5.60   22       123
🆕 [⟳] Ny Medarbj  5    20      0.25   22       → 94  (bruger avg 4.25)
```

Toggle-knappen skifter mellem medarbejderens eget S/D og teamgennemsnittet. Forecast-totalen opdateres live.

