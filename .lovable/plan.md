

# Tilkaldevagts-forecast: Historisk gennemsnit + manuelt override

## Problem
FM-medarbejdere uden fast vagtplan (tilkaldevikarer) har 0 planlagte vagter → 0 forecast, selvom de har salgshistorik og reelt arbejder jævnligt.

## Løsning
1. **Nyt felt på `employee_master_data`**: `expected_monthly_shifts` (integer, nullable) — manuelt override for forventede vagter pr. måned
2. **Historisk fallback**: Hvis feltet er tomt OG medarbejderen har 0 planlagte vagter, beregn gennemsnitlige vagter/måned fra de seneste 8 ugers salgsdata (antal unikke dage med salg → omregnet til månedligt)
3. **UI**: Vis/rediger feltet i `SetPlannedDepartureDialog` eller tilsvarende fra forecast-tabellen

## Ændringer

### 1. Database migration
- Tilføj `expected_monthly_shifts integer` til `employee_master_data` (nullable, default null)

### 2. `src/hooks/useClientForecast.ts`
- Hent `expected_monthly_shifts` i employee select (linje 106)
- I linje 383-388: Når `grossShifts === 0` og medarbejderen har salgshistorik:
  - Brug `expected_monthly_shifts` hvis sat
  - Ellers beregn fra historik: tæl unikke salgsdage over 8 uger → `(uniqueSalesDays / 8) * 4.33` som månedligt estimat
  - Sæt `plannedHours = estimatedShifts * HOURS_PER_SHIFT`

### 3. `src/components/forecast/ForecastBreakdownTable.tsx`
- Vis en badge "Tilkalde" ved medarbejdere hvor timer er estimeret (ikke fra vagtplan)
- Tilføj ikon til at sætte `expected_monthly_shifts` direkte fra tabellen

### 4. Ny dialog/udvidelse af `SetPlannedDepartureDialog.tsx`
- Tilføj felt for "Forventede vagter/måned" med number input
- Opdaterer `employee_master_data.expected_monthly_shifts`

## Beregningslogik (pseudo)
```text
if plannedShifts > 0:
  use plannedShifts (normal flow)
elif emp.expected_monthly_shifts:
  use expected_monthly_shifts (manual override)  
elif uniqueSaleDaysLast8Weeks > 0:
  estimatedMonthly = (uniqueSaleDays / 8) * 4.33
  use estimatedMonthly
else:
  forecast = 0 (no data at all)
```

| Fil | Ændring |
|-----|---------|
| Database migration | Tilføj `expected_monthly_shifts` til `employee_master_data` |
| `src/hooks/useClientForecast.ts` | Fallback-logik for medarbejdere uden vagtplan |
| `src/components/forecast/ForecastBreakdownTable.tsx` | "Tilkalde" badge + ikon til at sætte forventede vagter |
| `src/components/forecast/SetPlannedDepartureDialog.tsx` | Udvid med felt for forventede vagter/måned |

