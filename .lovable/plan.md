

# Justér Eesy TM ramp-up profil til faktiske tal

## Ændringer

### 1. Migration: Indsæt Eesy TM ramp-profil i `forecast_ramp_profiles`
Tabellen eksisterer allerede med `client_campaign_id`-support. Vi indsætter en profil specifikt for Eesy TM-kampagner:

```sql
INSERT INTO forecast_ramp_profiles (name, client_campaign_id, day_1_7_factor, day_8_14_factor, day_15_30_factor, day_31_60_factor, steady_state_factor)
SELECT 'Eesy TM Ramp', cc.id, 0.65, 0.95, 1.0, 1.0, 1.0
FROM client_campaigns cc
JOIN clients c ON cc.client_id = c.id
WHERE c.name ILIKE '%eesy%'
  AND cc.campaign_type = 'tm';
```

Faktorer baseret på analysen:
- Uge 1 (dag 1-7): **65%** (op fra 15%)
- Uge 2 (dag 8-14): **95%** (op fra 35%)
- Uge 3-4 (dag 15-30): **100%** (op fra 60%)
- Uge 5-8 (dag 31-60): **100%** (op fra 85%)

### 2. `useClientForecast.ts`: Hent kampagne-specifik ramp-profil fra DB
I stedet for altid at bruge `MOCK_RAMP_PROFILE`, tilføj et query der henter fra `forecast_ramp_profiles` filtreret på de relevante `client_campaign_id`'er. Hvis en kampagne-specifik profil findes, brug den; ellers fald tilbage til `MOCK_RAMP_PROFILE`.

Ændringer:
- Hent `forecast_ramp_profiles` med `.in("client_campaign_id", campaignIds)` efter kampagne-ID'erne er kendte
- Byg et map `campaignId -> rampProfile`
- Brug den matchede profil i `cohortInputs`, `calculateFullForecast`-kald, og ved beregning af nye medarbejderes ramp-faktor

### 3. `Forecast.tsx`: Vis den aktive ramp-profil i assumptions-panelet
Opdatér `ForecastAssumptions`-kaldet til at bruge den faktiske profil fra forecast-data i stedet for `MOCK_RAMP_PROFILE`.

## Berørte filer
- **Migration** (ny): Insert Eesy TM ramp-profil
- **`src/hooks/useClientForecast.ts`**: Hent og brug kampagne-specifik ramp-profil
- **`src/pages/Forecast.tsx`**: Videregiv korrekt ramp-profil til UI

## Effekt
Nye Eesy TM-sælgere forecaster nu ~5.1 salg i uge 1 og ~7.4 i uge 2 (mod tidligere 1.2 og 2.7). Andre kampagner forbliver uændrede.

