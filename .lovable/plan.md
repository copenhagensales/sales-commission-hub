

# Analysér og justér Eesy FM ramp-up profil

## Tilgang
Samme metode som Eesy TM: analysér faktisk salgsperformance for nye Eesy FM-sælgere, sammenlign med den nuværende generiske ramp-profil (15%/35%/60%/85%), og indsæt en kampagne-specifik profil i `forecast_ramp_profiles`.

## Trin

### 1. Datanalyse (script)
Kør en analyse af nye Eesy FM-sælgere (ansat fra juni 2025+):
- Hent medarbejdere med `employment_start_date` inden for perioden, tilknyttet Eesy FM-teams
- Beregn salg pr. uge relativt til ansættelsesdato (uge 1, 2, 3, 4)
- Sammenlign med etablerede sælgeres gennemsnit for at udlede faktiske ramp-faktorer
- FM-salg bruger `source = 'fieldmarketing'` og `fm_seller_id` i stedet for `agent_email`

### 2. Migration: Indsæt Eesy FM ramp-profil
Baseret på analyseresultaterne, indsæt en profil i `forecast_ramp_profiles` for Eesy FM-kampagner:
```sql
INSERT INTO forecast_ramp_profiles (name, client_campaign_id, day_1_7_factor, ...)
SELECT 'Eesy FM Ramp', cc.id, <faktisk_uge1>, <faktisk_uge2>, ...
FROM client_campaigns cc
JOIN clients c ON cc.client_id = c.id
WHERE c.name ILIKE '%eesy%' AND cc.campaign_type = 'fm';
```

### 3. Ingen kodeændringer
`useClientForecast.ts` henter allerede kampagne-specifikke profiler fra databasen (implementeret i forrige ændring). Eesy FM vil automatisk bruge den nye profil.

## Berørte filer
- **Kun database**: Ny række i `forecast_ramp_profiles`
- Analysen køres som et engangscript

