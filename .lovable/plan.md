

# Fix: Urealistisk høj churn-beregning

## Problemer fundet

### 1. Forkert rate-beregning
Formlen `exits.bucket0_60 / (headcount × 12 × 0.3)` beregner ikke en reel månedlig churn-rate. Den dividerer totale exits med et vilkårligt estimat af "risiko-pool", og capper ved 60%. Resultatet er alt for højt.

**Korrekt tilgang**: Månedlig churn-rate = antal exits i bucket / (antal medarbejdere der har VÆRET i den bucket i perioden). Dvs. vi skal tælle hvor mange medarbejdere der startede i de 12 måneder (og dermed gennemlevede 0-60 dages perioden), ikke bruge nuværende headcount som proxy.

### 2. Forkert tab-beregning
`churnLoss = expected × churnProbability` antager at alle medarbejdere mister en procentdel af salget. Korrekt: der er X% chance for at personen stopper, og ved stop mistes ca. halvdelen af månedens salg (mid-month departure).

**Korrekt**: `churnLoss = expected × churnProbability × 0.5`

## Ændringer

### `src/hooks/useClientForecast.ts` (linje 388-424)
Ny rate-beregning:
- Tæl **alle medarbejdere der har startet** i de 12 måneder (fra `historical_employment` starts + `employee_master_data` starts) som denominator for 0-60 bucket
- For 61-180 og 180+: brug medarbejdere der har nået den anciennitet
- Formel: `monthlyRate = exits_in_bucket / (people_who_entered_bucket × months_at_risk)`
- Sænk caps: 0-60 → max 25%, 61-180 → max 12%, 180+ → max 5%

### `src/lib/calculations/forecast.ts` (linje 162, 199)
- Ændre `churnLoss = expected × churnProbability` til `churnLoss = expected × churnProbability × 0.5`
- 0.5 = mid-month departure assumption (gennemsnitligt mister vi halvdelen af månedens salg)

### Effekt
- Eesy TM churn falder fra ~665 til et mere realistisk tal (fx ~50-80 salg)
- Forecast-totalen stiger tilsvarende og afspejler virkeligheden bedre
- Samme model, bare korrekt matematik

| Fil | Ændring |
|-----|---------|
| `src/hooks/useClientForecast.ts` | Korrekt rate-beregning med rigtig denominator og lavere caps |
| `src/lib/calculations/forecast.ts` | Halvér churn-tab (mid-month departure) |

