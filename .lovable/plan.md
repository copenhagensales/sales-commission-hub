

# Fix: Cohort forecast ignorerer startdato i perioden

## Problem
`forecastCohort()` antager altid **4 uger** arbejde (`weeklyHoursPerHead * 4`), uanset hvornår i perioden holdet starter. Et hold der starter 31. marts får kredit for 4 fulde uger — men de har reelt 0-1 arbejdsdag tilbage i marts.

Beregningen:
- `daysSinceStart = max(0, now - startDate)` = 0 (de er ikke startet endnu)
- `avgDays = 0 + 15 = 15` → ramp factor ~35%, survival ~84%
- `forecastHours = 5 × 0.84 × 37 × 4 × 0.90 = ~560 timer`
- `forecastSales = 560 × 0.45 × 0.35 = ~88` ... men med fuld 4 uger giver det ~225

## Løsning
Beregn faktiske arbejdsdage i forecast-perioden **efter** cohortens startdato, i stedet for fast 4 uger.

### Ændring i `src/lib/calculations/forecast.ts` — `forecastCohort()`

Tilføj `periodEnd` til `CohortForecastInput` (eller beregn det). Erstat den faste `* 4`:

```
daysInPeriod = min(periodEnd, now) - max(periodStart, cohort.start_date)
weeksInPeriod = max(0, daysInPeriod / 7)
forecastHours = effectiveHeads × weeklyHoursPerHead × weeksInPeriod × attendanceFactor
```

For et hold der starter 31/3 i marts-perioden: `weeksInPeriod ≈ 0.14` (1 dag) → forecast ~5-8 salg i stedet for 225.

### Ændringer i types
Tilføj `periodStart` og `periodEnd` til `CohortForecastInput`.

### Filer

| Fil | Ændring |
|-----|---------|
| `src/types/forecast.ts` | Tilføj `periodStart`, `periodEnd` til `CohortForecastInput` |
| `src/lib/calculations/forecast.ts` | Beregn faktiske uger i perioden i stedet for fast 4 |
| `src/hooks/useClientForecast.ts` | Send `periodStart`/`periodEnd` med til cohort inputs |

