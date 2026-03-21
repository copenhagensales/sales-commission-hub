

# Fix: Forecast for indeværende måned skal inkludere faktiske salg

## Problem
Forecastet for marts viser 801, men der er allerede lavet 896 salg med 7 arbejdsdage tilbage. Forecastet beregner hele måneden fra scratch baseret på EWMA SPH × planlagte timer, men:

1. **Ingen "actual + remaining"-logik**: For indeværende måned bør forecast = faktiske salg hidtil + forecast for resterende dage
2. **EWMA trækkes ned af 0-salgs-uger**: Fx Hans har 0 salg i ugen 23-28. feb (på tværs af ALLE kampagner), men 4 registrerede vagter → SPH = 0 den uge, som trækker hans EWMA fra ~1.3 ned til ~0.85

## Data-validering
- Hans: 102 salg i marts, men en hel uge i feb med 0 salg (muligt uregistreret fravær) → SPH=0 tanker EWMA
- Samme mønster rammer flere medarbejdere
- 896 faktiske salg ÷ ~15 arbejdsdage = ~60/dag. 7 dage tilbage → naiv projektion ~1.315

## Løsning: To ændringer

### 1. `useClientForecast.ts` — Hent faktiske salg for indeværende måned
Når `period === "current"`:
- Hent faktiske salg fra `sales` + `sale_items` for perioden `forecastStart` til `now`
- Beregn resterende arbejdsdage fra `now` til `forecastEnd`
- For hver medarbejder: beregn forecast KUN for resterende dage (shifts fra i dag til månedens slutning)
- Samlet forecast = `actualSales + remainingForecast`
- Tilføj `actualSales` og `remainingDays` til return-data så UI kan vise "896 faktiske + 419 forventet = 1.315"

### 2. `useClientForecast.ts` — EWMA: Skip uger med 0 salg OG lav aktivitet
Nuværende logik skipper kun uger med `shiftsInWeek === 0`. Udvid til også at skippe uger hvor medarbejderen har 0 salg men normalt performer over 0.5 SPH (indikerer uregistreret fravær):
```
if (shiftsInWeek === 0) continue;
if (salesInWeek === 0 && shiftsInWeek <= 2) continue; // Likely unrecorded absence
```

### 3. `forecast.ts` + `types/forecast.ts` — Udvid ForecastResult
Tilføj felter til ForecastResult:
- `actualSalesToDate: number` (kun for current period)
- `remainingForecast: number`
- `daysElapsed: number`
- `daysRemaining: number`

### 4. `Forecast.tsx` — Vis actual + remaining i UI
For indeværende måned, vis KPI-kortet som:
- "896 faktiske + 419 forventet = **1.315** total"
- Eller et progress-bar-agtigt element der viser hvor langt vi er

## Filer

| Fil | Ændring |
|-----|---------|
| `src/hooks/useClientForecast.ts` | Hent actual sales for current period, beregn remaining-only forecast, forbedret EWMA skip-logik |
| `src/lib/calculations/forecast.ts` | Accepter `actualSales` parameter, returnér udvidede felter |
| `src/types/forecast.ts` | Tilføj `actualSalesToDate`, `remainingForecast`, `daysElapsed`, `daysRemaining` |
| `src/pages/Forecast.tsx` | Vis actual + remaining for indeværende måned |
| `src/components/forecast/ForecastKpiCards.tsx` | Tilpas visning med actual/remaining split |

## Forventet resultat
Marts forecast for Eesy TM: ~896 (actual) + ~400 (7 remaining days) = **~1.300** — langt mere realistisk end 801.

