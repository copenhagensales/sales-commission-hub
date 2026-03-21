

# Fix: Vis forventet fravær (probabilistisk) i forecast

## Problem
Fraværseffekten viser kun **allerede godkendt** fravær. For fremtidige måneder har ingen meldt sig syge endnu, så tabet viser 0 — selvom vi statistisk ved at ~5-8% af vagterne forsvinder til sygdom.

Forecastet er faktisk korrekt (det bruger allerede `attendanceFactor`), men **driveren** viser ikke tabet.

## Løsning
Udvid `absenceLoss`-beregningen til at inkludere forventet uforudset sygdom baseret på historisk attendance.

### Ændring i `src/lib/calculations/forecast.ts`

I `calculateFullForecast`, erstat `absenceLoss`-beregningen:

**Nu**: `lostHours = grossPlannedHours - plannedHours` (kun kendte fraværsdage)

**Ny**:
```
knownAbsenceHours = grossPlannedHours - plannedHours
predictedAbsenceHours = plannedHours × (1 - attendanceFactor)
totalLostHours = knownAbsenceHours + predictedAbsenceHours
absenceLoss = totalLostHours × SPH
```

Opdater driver-teksten til at vise breakdown:
- "Planlagt fravær: X salg"
- "Forventet uforudset sygdom: Y salg"
- "Total fraværseffekt: Z salg"

| Fil | Ændring |
|-----|---------|
| `src/lib/calculations/forecast.ts` | Ny absenceLoss med predicted absence + opdateret driver-tekst |

Én fil, ~15 linjer ændret. Forecast-tallet ændres ikke — kun driveren viser nu det reelle tab.

