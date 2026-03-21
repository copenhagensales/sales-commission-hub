

# Auto-hent opstartshold fra onboarding_cohorts med max_capacity som headcount

## Problem
Forecast bruger kun manuelt oprettede `client_forecast_cohorts`. I har allerede kommende hold i `onboarding_cohorts` med `max_capacity` og `daily_bonus_client_id`. Forecastet skal bruge **max_capacity** (måltal) som `planned_headcount`, ikke det faktiske antal tilmeldte.

## Ændringer

### 1. `src/types/forecast.ts` — Udvid `ClientForecastCohort`
Tilføj optional felter:
- `source?: 'manual' | 'onboarding'`
- `name?: string`
- `actual_members?: number` (til visning: "4/8 tilmeldt")

### 2. `src/hooks/useClientForecast.ts` — Hent onboarding_cohorts
Efter step 7 (fetch `client_forecast_cohorts`), tilføj:
- Hent `onboarding_cohorts` med `status IN ('planned', 'in_progress')` og `start_date` relevant for forecast-perioden (eller nyligt startet, inden for 60 dage)
- Hent `cohort_members` count per cohort (til UI-visning)
- Map `daily_bonus_client_id` → `client_id`. Hvis null, slå op via `team_clients` fra cohortens `team_id`
- Filtrér på valgt kunde hvis `clientId !== 'all'`
- Konvertér til `ClientForecastCohort` med `planned_headcount = max_capacity` (IKKE antal tilmeldte)
- Merge med manuelle cohorts, undgå dubletter
- Markér med `source: 'onboarding'`

### 3. `src/components/forecast/ForecastCohortManager.tsx` — Vis begge typer
- Onboarding-hold vises med navn, badge "Kommende opstart", og "4/8 tilmeldt"
- Manuelle hold vises som nu med badge "Manuelt tilføjet"
- "Tilføj hold"-knappen forbliver for manuelle forecast-cohorts

### Eksempel
"Eesy TM - 31. marts" har `max_capacity = 8`, 4 tilmeldte:
- Forecast bruger **8** som `planned_headcount`
- UI viser: "Eesy TM - 31. marts · 8 personer (4 tilmeldt) · Kommende opstart"

