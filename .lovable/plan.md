
# Fix: 00:00 vises stadig i FM-vagtplan

## Hvorfor det stadig sker
Den tidligere plan ramte det forkerte lag.

Der er **ingen individuelle vagter** i `shift`-tabellen for uge 13, så 00:00 kommer ikke derfra.

Problemet kommer i stedet fra fallback-logikken i `VagtplanFMContent`:
- `team_standard_shifts` har **flere aktive vagter**
- én af dem er **"Deltid"** med `start_time = 00:00` og `end_time = 00:00`
- koden bruger bare `primaryShiftsData.shifts[0]` som “primær” vagt
- når den tilfældigvis vælger **Deltid**, vises `00:00-00:00` for alle uden individuel specialvagt

## Ændring

### 1. `src/pages/vagt-flow/VagtplanFMContent.tsx`
Ret logikken i `getWorkTimesForEmployeeAndDay` så teamets standardvagt vælges korrekt.

I stedet for:
```ts
const primaryShift = primaryShiftsData.shifts[0];
```

brug:
- et `specialShiftIds`-set fra `employeeStandardShifts.assignments`
- vælg teamets **default-vagt** som en aktiv vagt der **ikke** er brugt som medarbejder-specifik specialvagt
- hvis flere matcher, prioritér en vagt med dag-konfigurationer / ikke-00:00 tider

Så hierarchy bliver:
1. Individuel vagt fra `shift`
2. Medarbejder-specifik standardvagt fra `employee_standard_shifts`
3. Teamets reelle standardvagt (ikke “Deltid”-specialvagt)

### 2. Behold den tidligere 00:00-filtering
Filtreringen af `dayShiftsRaw` må gerne blive stående som ekstra sikkerhed, men den er **ikke** hovedfixet.

## Teknisk note
Den samme svaghed findes sandsynligvis også i:
- `src/pages/shift-planning/ShiftOverview.tsx`
- `src/pages/shift-planning/MySchedule.tsx`
- `src/components/profile/MyScheduleTabContent.tsx`

fordi de også antager én “primær” aktiv vagt, selvom teamet reelt har flere aktive vagter. Jeg vil derfor rette samme udvælgelsesregel dér, så 00:00 ikke dukker op andre steder senere.

## Filer
| Fil | Ændring |
|-----|---------|
| `src/pages/vagt-flow/VagtplanFMContent.tsx` | Vælg korrekt team-standardvagt i stedet for `shifts[0]` |
| `src/pages/shift-planning/ShiftOverview.tsx` | Samme valglogik for standardvagt |
| `src/pages/shift-planning/MySchedule.tsx` | Samme valglogik for standardvagt |
| `src/components/profile/MyScheduleTabContent.tsx` | Samme valglogik for standardvagt |
