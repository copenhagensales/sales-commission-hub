

# Problem: Cohort-forecast stadig ~3x for højt (876 salg for 15 nye sælgere)

## To fejl identificeret

### Fejl 1: Weekender tælles som arbejdsdage
I `forecastCohort()` (linje 269-291 i `forecast.ts`):
```ts
const dailyHours = weeklyHoursPerHead / 7; // = 5.29 timer/dag
for (let d = 0; d < activeDays; d++) { ... } // alle kalenderdage inkl. weekender
```
Simuleringen kører over **alle 30 kalenderdage** i april og giver 5.29 timer til hver — inkl. lørdag og søndag. Det er ~8 dage for meget, altså ~27% overvurdering.

**Fix**: Skip weekender (og helligdage) i loopet. Brug `dailyHours = weeklyHoursPerHead / 5` for hverdage.

### Fejl 2: Ramp-faktorerne er forkerte som "% af etableret SPH"
Ramp-profilen for Eesy TM siger:
- Uge 1: 65%, Uge 2: 95%, Uge 3+: 100%

Disse blev udregnet fra **absolutte salgstal** (uge 1: ~8, uge 2: ~12, uge 3: ~10, uge 4: ~12). Men i forecast-modellen ganges de på **etablerede sælgeres SPH** (~0.83 for Eesy TM).

100% af 0.83 SPH = ~0.83 SPH for nye sælgere i uge 3+.
Men empirisk laver nye sælgere ~41 salg/måned ≈ 0.26 SPH ved steady state.

Så ramp 100% burde reelt svare til ~31% af etableret SPH — **ikke** 100%.

**Årsag**: Ramp-procenterne blev beregnet relativt til uge 4 (den bedste nye-sælger-uge), men bruges som om de er relativt til etablerede sælgere. Det er to helt forskellige baselines.

## Løsning

### Mulighed A: Recalibrér ramp-profilen (anbefalet)
Genberegn ramp-faktorerne som faktisk andel af etablerede sælgeres SPH:
- Nye sælgeres steady-state SPH ≈ 0.26 (baseret på ~41 salg/måned ved ~159 timer)
- Etableret SPH ≈ 0.83
- Uge 3-4 ramp = 0.26 / 0.83 ≈ **31%**
- Uge 1 ramp = (8 salg/uge) / (0.83 × 37) ≈ **26%** (eller relativt: 65% × 31% ≈ **20%**)
- Uge 2 ramp = 95% × 31% ≈ **30%**

Opdatér `forecast_ramp_profiles` i databasen for Eesy TM-kampagnen.

### Mulighed B: Brug absolut baseline SPH i ramp-profilen
I stedet for at ramp-faktorerne er relative til etablerede sælgere, lad profilen definere en absolut steady-state SPH for nye sælgere. Ramp-faktorerne forbliver som de er (65%/95%/100%), men baseline ændres fra etableret SPH til en kampagne-specifik "ny-sælger-SPH".

**Fordel**: Enklere at forstå ("100% = fuld ny-sælger-kapacitet").
**Ulempe**: Kræver et nyt felt i profilen.

### Weekend-fix (uanset A/B)
I `forecastCohort()`:

```text
Nuværende:
  dailyHours = weeklyHoursPerHead / 7
  loop over alle kalenderdage

Nyt:
  dailyHours = weeklyHoursPerHead / 5
  loop over kalenderdage, skip lør+søn (og helligdage hvis tilgængelige)
```

## Ændringer

| Fil | Ændring |
|-----|---------|
| `src/lib/calculations/forecast.ts` | Skip weekender i cohort-simulation, juster `dailyHours` til `/5` |
| `src/hooks/useClientForecast.ts` | Videregiv helligdage til cohort-input (allerede beregnet) |
| `src/types/forecast.ts` | Tilføj `holidays?: Set<string>` til `CohortForecastInput` |
| Migration | Opdatér Eesy TM ramp-profil med recalibrerede faktorer |

## Forventet effekt
Med begge fixes:
- Hold 1 (7 pers, 31/3, ~22 hverdage i april): ~50-70 salg i stedet for ~400+
- Hold 2 (8 pers, 14/4, ~13 hverdage): ~30-45 salg
- **Total cohort: ~80-115 salg** i stedet for 876

Det matcher langt bedre den empiriske ~41 salg/måned ved steady state, justeret for ramp-up og frafald.

