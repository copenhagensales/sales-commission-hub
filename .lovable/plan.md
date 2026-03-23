

# Tilføj redigering af opstartshold (antal + dato + note)

## Ændringer

### 1. `src/components/forecast/EditForecastCohortDialog.tsx` (ny fil)
- Dialog med felter for startdato, antal personer og note — præudfyldt med eksisterende værdier
- `onSubmit` returnerer cohort-id + opdaterede felter

### 2. `src/components/forecast/ForecastCohortManager.tsx`
- Tilføj `onEdit` prop
- Tilføj edit-state og edit-knap (blyant-ikon) ved siden af slet-knappen på hver række
- Åbn `EditForecastCohortDialog` med valgt cohort

### 3. `src/pages/Forecast.tsx`
- Tilføj `updateCohort` mutation der kalder `.update()` på `client_forecast_cohorts` med nyt headcount/dato/note
- Send `onEdit` prop til `ForecastCohortManager`

| Fil | Ændring |
|-----|---------|
| `src/components/forecast/EditForecastCohortDialog.tsx` | Ny dialog til redigering |
| `src/components/forecast/ForecastCohortManager.tsx` | Edit-knap + state + onEdit prop |
| `src/pages/Forecast.tsx` | Update-mutation + onEdit handler |

