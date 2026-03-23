

# Fjern fallback-estimering af vagter i forecast

## Problem
Når en medarbejder (f.eks. Sandra) har 0 bookede vagter i forecast-perioden, bruger systemet en fallback der estimerer vagter baseret på historisk salgsaktivitet eller `expected_monthly_shifts`. Det giver misvisende forecasts for medarbejdere der reelt ikke skal arbejde.

## Ændring

### `src/hooks/useClientForecast.ts` — linje 422-472

**Fjern hele fallback-blokken** for on-call medarbejdere. Hvis en medarbejder har 0 bookede vagter, skal forecastet være 0.

- Slet linje 422-472 (hele `if (grossShifts === 0 && shiftsEarlierInMonth === 0)` blokken)
- Fjern relateret `isOnCall`-variabel og dens brug nedstrøms
- Medarbejdere uden vagter vil dermed få `forecastShifts = 0` → `forecast = 0`

| Fil | Ændring |
|-----|---------|
| `src/hooks/useClientForecast.ts` | Fjern fallback-estimering (linje 422-472), brug kun faktiske vagter |

