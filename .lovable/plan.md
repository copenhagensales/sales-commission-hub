

# Planlagt afgang i forecast

## Hvad der bygges
Mulighed for at registrere at en medarbejder stopper på en bestemt dato (fx "Hans stopper 14. april"), så forecastet automatisk kun tæller vagter frem til den dato.

## Hvordan det virker
`employee_master_data` har allerede feltet `employment_end_date`. Når det er sat til en fremtidig dato, skal forecastet begrænse medarbejderens planlagte timer til kun at dække perioden fra forecast-start til `employment_end_date` (whichever is earlier). Personen forbliver `is_active = true` indtil de faktisk stopper.

## Ændringer

### 1. `src/hooks/useClientForecast.ts`
- Tilføj `employment_end_date` til employee select-queryen (linje 106)
- I forecast-beregningen (linje 354-358): Hvis `employment_end_date` er sat og falder inden for forecast-perioden, brug `employment_end_date` som `forecastEnd` for den specifikke medarbejder i stedet for månedens slutning
- Hvis `employment_end_date` er før forecast-periodens start, ekskludér medarbejderen helt
- Markér medarbejderen med `isNew: false` + evt. flag så UI kan vise "stopper dd/mm"

### 2. `src/types/forecast.ts`
- Tilføj `plannedEndDate?: string` til `EmployeeForecastResult` interfacet

### 3. `src/components/forecast/ForecastBreakdownTable.tsx`
- Vis en badge/indikator ved medarbejdere med planlagt afgang (fx "Stopper 14/4") i tabellen

### 4. UI til at sætte slutdato
- I den eksisterende medarbejder-redigering (`EmployeeMasterData.tsx`) kan `employment_end_date` allerede sættes
- Tilføj en hurtig-adgang i `ForecastBreakdownTable`: klik-ikon der åbner en lille dialog til at sætte/ændre `employment_end_date` for en medarbejder direkte fra forecast-visningen

### Ny komponent: `SetPlannedDepartureDialog.tsx`
- Simpel dialog med datovælger + gem-knap
- Opdaterer `employee_master_data.employment_end_date` via Supabase
- Invaliderer forecast-query

## Beregningslogik (pseudo)
```text
for each employee:
  effectiveEnd = min(forecastEnd, emp.employment_end_date || forecastEnd)
  if effectiveEnd < forecastStart → skip employee
  plannedHours = countShifts(emp.id, forecastStart, effectiveEnd) × 7.5
```

| Fil | Ændring |
|-----|---------|
| `src/hooks/useClientForecast.ts` | Hent `employment_end_date`, begræns vagter til slutdato |
| `src/types/forecast.ts` | Tilføj `plannedEndDate` til `EmployeeForecastResult` |
| `src/components/forecast/ForecastBreakdownTable.tsx` | Vis "Stopper dd/mm" badge + ikon til at sætte dato |
| `src/components/forecast/SetPlannedDepartureDialog.tsx` | Ny dialog til at registrere planlagt afgang |

