

# Vis fuldt månedligt fraværstab i driveren

## Problem
For indeværende måned beregnes fraværstabet kun for **resterende dage** (fra i morgen til månedens slutning), fordi `remainingPerformances` kun indeholder timer for resterende dage. Det giver et misvisende lavt tal — fx 14 tabte salg i stedet for det reelle helhedsbillede.

## Løsning
Beregn fraværstabet separat for **hele måneden** og brug det i driveren, mens forecast-beregningen stadig kun bruger resterende dage til at forudsige fremtidige salg.

### `src/hooks/useClientForecast.ts`

I current-period blokken (efter linje ~534):

1. Beregn et **full-month absence loss** ved at bruge de originale `employeePerformances` (hele måneden):
   - `fullMonthKnownAbsenceLoss`: `(grossPlannedHours - plannedHours) × SPH` for hele måneden
   - `fullMonthPredictedAbsenceLoss`: `plannedHours × (1 - attendanceFactor) × SPH` for hele måneden

2. Erstat fraværs-driveren i `combinedForecast.drivers` med den fulde månedsberegning inkl. breakdown:
   - "Planlagt fravær (ferie/fridage): X salg"
   - "Forventet uforudset sygdom (~Y%): Z salg"
   - "Total fraværseffekt hele måneden: W salg"

3. Opdater `combinedForecast.absenceLoss` til det fulde tal.

### Ingen ændringer i `forecast.ts`
Selve `calculateFullForecast` forbliver uændret — den beregner korrekt for de data den får. Ændringen er i hooket, der overrider driveren med hele-måneds-data.

| Fil | Ændring |
|-----|---------|
| `src/hooks/useClientForecast.ts` | Beregn full-month absence loss, erstat driver med breakdown |

