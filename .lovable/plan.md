

# Etableret churn med tenure-baseret risiko

## Observation fra jeres data

Jeres historik viser tydeligt at churn er **kraftigt afhængig af anciennitet**:

| Team | Exits 0-30d | Exits 31-60d | Exits 61-180d | Exits 180d+ |
|------|-------------|--------------|---------------|-------------|
| United | 42 (55%) | 17 (22%) | 16 (21%) | 2 (3%) |
| Eesy TM | 48 (63%) | 16 (21%) | 12 (16%) | 0 (0%) |
| FM | 8 (29%) | 6 (21%) | 10 (36%) | 4 (14%) |

En medarbejder med 2 ugers anciennitet har 10-20× højere churn-risiko end en med 1 år.

## Nuværende mangel

Forecastet antager 0% churn for alle etablerede medarbejdere — uanset om de har været der 3 uger eller 3 år. Det er urealistisk, især for teams som United og Eesy TM med mange nye.

## Beregningsmodel

For hver **etableret medarbejder** beregnes en individuel månedlig churn-sandsynlighed baseret på:

1. **Team-historik**: Fra `historical_employment` — hvor mange stoppede i hvert tenure-bucket
2. **Individuel anciennitet**: Medarbejderens `daysSinceStart` afgør hvilken risiko-kurve de sidder på

### Tenure-buckets og månedlig churn-rate (beregnet fra historik):

```text
For hvert team:
  exits_in_bucket / (avg_headcount_in_bucket × months_observed)
  
Eksempel United:
  0-60 dage:   (42+17) exits / ~12 mdr ≈ 4.9 exits/mdr
               Avg headcount ~10 → 49% månedlig churn
  61-180 dage: 16 exits / 12 mdr ≈ 1.3/mdr
               Avg headcount ~8 → 16% månedlig churn  
  180+ dage:   2 exits / 12 mdr ≈ 0.17/mdr
               Avg headcount ~6 → 3% månedlig churn
```

### Forecast-formel per medarbejder:
```text
churnProbability = lookup(team, daysSinceStart) → månedlig %
expectedLoss = forecastSales × churnProbability
```

### Samlet:
```text
establishedChurnLoss = Σ (employee.forecastSales × employee.churnProbability)
```

## Ændringer

### `src/hooks/useClientForecast.ts`
- Hent team-churn-historik fra `historical_employment`: exits per tenure-bucket per team (seneste 12 mdr)
- Hent gennemsnitlig headcount per team per bucket for at beregne rater
- Byg et `teamChurnRates: Map<teamName, { bucket0_60: rate, bucket61_180: rate, bucket180plus: rate }>` objekt
- Send med til `calculateFullForecast`

### `src/lib/calculations/forecast.ts`
- Ny funktion `getEstablishedChurnRate(daysSinceStart, teamChurnRates)` → månedlig sandsynlighed
- I `calculateFullForecast`: for hver established employee, beregn `churnProbability` og `churnLoss`
- Tilføj `establishedChurnLoss` til totaler og drivers
- Reducer `totalSalesExpected` med denne værdi
- Ny driver: "Etableret churn" med breakdown (fx "8 medarbejdere med <60 dage = høj risiko")

### `src/types/forecast.ts`
- Tilføj `establishedChurnLoss: number` til `ForecastResult`
- Tilføj `churnProbability: number` til `EmployeeForecastResult`
- Ny type `TeamChurnRates` for team-bucket-rater

### UI (automatisk via drivers)
- Drivers-panelet viser "Etableret churn: -X salg" med forklaring
- Breakdown-tabellen kan vise churn-risiko per medarbejder (lav/mellem/høj badge)

## Eksempel med jeres nuværende data

Eesy TM har 13 medarbejdere med <60 dage anciennitet. Historisk churn i den bucket er ~50%/mdr. Hvis de gennemsnitligt forecaster 15 salg/person → churnLoss ≈ 13 × 15 × 0.50 = ~97 salg tabt. Det er meget mere realistisk end 0.

Medarbejdere med 180+ dage på samme team: ~0% churn → tæller fuldt.

| Fil | Ændring |
|-----|---------|
| `src/types/forecast.ts` | Ny `TeamChurnRates` type + `establishedChurnLoss` + `churnProbability` |
| `src/hooks/useClientForecast.ts` | Hent historical_employment churn per team/bucket, beregn rater |
| `src/lib/calculations/forecast.ts` | Ny churn-funktion, anvend per medarbejder, tilføj driver |

