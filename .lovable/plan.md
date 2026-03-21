
# Kobl Forecast til rigtig data

## Overblik
Erstat mock data med et nyt `useClientForecast` hook der henter rigtige data fra databasen: sælger-performance (salg per uge), vagtplaner (shifts/standard shifts), fravær, og onboarding cohorts. Beregningslogikken i `forecast.ts` genbruges uændret.

## Datakilde-mapping

| Forecast-input | Datakilde |
|---|---|
| Sælgere pr. kunde | `team_clients` → `team_members` → `employee_master_data` (aktive) |
| Ugentlig salg/time (8 uger EWMA) | `sales` + `sale_items` grupperet pr. uge pr. agent via `employee_agent_mapping` |
| Planlagte timer næste måned | `shift` + `employee_standard_shifts` + `team_standard_shifts` (samme logik som `useTeamGoalForecast`) |
| Fravær/attendance | `absence_request_v2` (approved, seneste 90 dage) → personlig attendance-faktor |
| Nye opstartshold | `client_forecast_cohorts` tabel (allerede oprettet, tom) + mulighed for at hente fra `onboarding_cohorts` |
| Forecast vs Actual | `sales` aggregeret pr. måned for de seneste 3 måneder |
| Churn-profiler | Auto-beregnet fra `employee_master_data` (start/end dates) pr. team |

## Ændringer

### 1. Nyt hook: `src/hooks/useClientForecast.ts`
React Query hook der:
- Tager `clientId` (eller "all") som input
- Finder relevante teams via `team_clients`
- Henter aktive medarbejdere fra `team_members` + `employee_master_data`
- Henter ugentligt salg (seneste 8 uger) via `sales` + `sale_items` filtreret på `client_campaign_id`
- Beregner planlagte vagter næste måned via shift-hierarkiet (individuel → employee_standard → team_standard) minus godkendte fraværsdage
- Beregner personlig attendance-faktor fra seneste 90 dages fravær
- Henter `client_forecast_cohorts` for valgt kunde
- Kalder de eksisterende pure functions fra `forecast.ts`
- Returnerer `ForecastResult` + loading state

### 2. Nyt hook: `src/hooks/useForecastVsActual.ts`
Henter faktisk salg for de seneste 3-4 måneder pr. kunde og sammenligner med gemte forecasts fra `client_forecasts` tabellen. Hvis ingen gemte forecasts findes, viser kun faktisk salg.

### 3. Opdater `src/pages/Forecast.tsx`
- Erstat `generateMockForecast()` med `useClientForecast(selectedClient)`
- Hent rigtige kunder til dropdown via `useQuery` på `clients` tabel
- Erstat `generateMockForecastVsActual()` med `useForecastVsActual(selectedClient)`
- Cohort-manager kobles til `client_forecast_cohorts` tabel (insert via Supabase)
- Behold `ForecastAssumptions` med default ramp/survival profiler (kan senere hentes fra DB)
- Tilføj loading states

### 4. Timer-beregning
Genbruger `useTeamGoalForecast`-mønstret til at tælle "normal shifts" i forecast-perioden:
- Individuelle shifts → employee standard shifts → team standard shifts
- Minus godkendte absences (sick, vacation, no_show)
- Antager 7,5 timer pr. vagt for at konvertere til timer

### 5. SPH (Sales Per Hour) beregning
For hver medarbejder:
- Hent salg pr. uge (seneste 8 uger) filtreret på kundens kampagner
- Hent vagter pr. uge for samme periode
- SPH = salg / (vagter × 7.5)
- Feed til EWMA-beregning

### 6. Churn auto-beregning
Beregn survival-profil fra historisk data:
- Hent alle medarbejdere startet i seneste 12 mdr pr. team
- Beregn andel der stadig var aktive efter 7, 14, 30, 60 dage
- Bruges som default survival-profil

## Resultat
- Forecast-siden viser rigtige sælgere med rigtige salgstal
- Kunder fra databasen i dropdown (Tryg, TDC, Eesy etc.)
- Planlagte timer baseret på vagtplaner
- Fravær reducerer forecast realistisk
- Cohorts kan oprettes i `client_forecast_cohorts`
- Demo-badge fjernes, erstattes med data-freshness indikator
