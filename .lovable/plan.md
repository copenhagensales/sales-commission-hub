

# Analysér og opdatér Eesy TM survival-profil

## Kontekst
Survival-profilen styrer, hvor stor en andel af et nyt opstartshold der forventes stadig at være ansat efter dag 7, 14, 30 og 60. Den nuværende `MOCK_SURVIVAL_PROFILE` bruger uvaliderede tal:

| Dag | Nuværende (mock) |
|-----|-----------------|
| 7   | 92%             |
| 14  | 84%             |
| 30  | 74%             |
| 60  | 66%             |

Vi ved ikke om disse matcher virkeligheden for Eesy TM. Samme fremgangsmåde som ramp-up analysen.

## Trin

### 1. Dataanalyse (engangscript)
Kør SQL mod `employee_master_data`, `historical_employment` og `team_members`:

- Hent alle medarbejdere tilknyttet Eesy TM-teams (via `team_members` + `teams`) med `employment_start_date` fra f.eks. januar 2025+
- For stoppede medarbejdere: beregn `tenure_days` = `employment_end_date - employment_start_date`
- For aktive medarbejdere: beregn `tenure_days` = `today - employment_start_date`
- Beregn overlevelsesrate ved dag 7, 14, 30, 60:
  - `survival_day_N = antal der stadig var ansat efter N dage / total antal startere`
- Output: de fire faktiske survival-faktorer

### 2. Migration: Indsæt Eesy TM survival-profil
Baseret på analysen, indsæt i `forecast_survival_profiles`:
```sql
INSERT INTO forecast_survival_profiles (name, client_campaign_id, survival_day_7, survival_day_14, survival_day_30, survival_day_60)
SELECT 'Eesy TM Survival', cc.id, <dag7>, <dag14>, <dag30>, <dag60>
FROM client_campaigns cc
JOIN clients c ON cc.client_id = c.id
WHERE c.name ILIKE '%eesy%' AND cc.campaign_type = 'tm';
```

### 3. `useClientForecast.ts`: Hent kampagne-specifik survival-profil
Samme mønster som ramp-profiler:
- Hent `forecast_survival_profiles` med `.in("client_campaign_id", campaignIds)`
- Byg et map `campaignId → survivalProfile`
- Brug den matchede profil i `cohortInputs` i stedet for `MOCK_SURVIVAL_PROFILE`
- Fallback til `MOCK_SURVIVAL_PROFILE` for kampagner uden specifik profil

### 4. `Forecast.tsx`: Vis aktiv survival-profil i assumptions
Opdatér `ForecastAssumptions`-kaldet til at bruge den faktiske survival-profil fra forecast-data.

## Berørte filer
- **Engangscript**: SQL-analyse af faktisk overlevelse
- **Migration**: Ny række i `forecast_survival_profiles`
- **`src/hooks/useClientForecast.ts`**: Hent og brug kampagne-specifik survival-profil (~15 linjer)
- **`src/pages/Forecast.tsx`**: Videregiv korrekt survival-profil til UI (1 linje)

## Effekt
Kohort-forecastet afspejler Eesy TM's faktiske fastholdelse i stedet for generiske mock-tal. Andre kampagner forbliver uændrede.

