

# Fix: Vis reelt fraværstab i forecast

## Problem
Fraværseffekten viser kun ~18 salg fordi:
- `plannedHours` er allerede reduceret for godkendt fravær (ferie, sygdom, no_show)
- `attendanceFactor` er derefter en lille korrektion (95-98%) for uforudset fravær
- `absenceLoss = totalExpected × (1 - avgAttendance)` viser kun den marginale effekt
- Det reelle tab fra ferie/sygdom er usynligt — gemt i lavere timer

## Løsning
Beregn **to** tal: timer med og uden fravær, så vi kan vise det fulde fraværstab.

### Ændringer i `useClientForecast.ts`
For hver medarbejder, beregn **to** shift-tal for forecast-perioden:
- `grossShifts` = vagter **uden** at trække fravær fra (fuld kapacitet)
- `netShifts` = vagter **med** fravær trukket fra (nuværende `forecastShifts`)

Tilføj nyt felt `grossPlannedHours` til `EmployeePerformance` interface.

### Ændringer i `forecast.ts`
- `forecastEstablishedEmployee`: Behold nuværende beregning (bruger netShifts som `plannedHours`)
- `calculateFullForecast`: Beregn `absenceLoss` som:
  ```
  absenceLoss = Σ (grossHours - plannedHours) × ewmaSph per employee
  ```
  Dvs. forskellen mellem fuld kapacitet og faktisk kapacitet, ganget med deres produktivitet.

### Ændringer i `types/forecast.ts`
- Tilføj `grossPlannedHours: number` til `EmployeePerformance`

### Resultat
- Fraværseffekten viser det **reelle** tab: "Du mister ~X salg pga. ferie og sygdom"
- Brugeren kan se om det er 18 eller 80 salg der forsvinder
- Drivers-panelet opdateres automatisk

### Filer
| Fil | Ændring |
|-----|---------|
| `src/types/forecast.ts` | Tilføj `grossPlannedHours` til `EmployeePerformance` |
| `src/hooks/useClientForecast.ts` | Beregn grossShifts (uden fravær) + netShifts (med fravær) |
| `src/lib/calculations/forecast.ts` | Beregn absenceLoss fra gross vs net timer × SPH |

