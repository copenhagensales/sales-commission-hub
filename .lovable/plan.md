

# Hybrid forecast-model for nye sælgere (≤60 dage)

## Vurdering af Codex-forslaget
Forslaget er gennemtænkt og passer godt ind i den eksisterende arkitektur. Kerneidéen — at blende ramp-modellen med empirisk SPH baseret på datakvalitet — løser et reelt problem: nye sælgere med faktiske data bliver i dag ignoreret til fordel for en ren ramp-kurve.

Et par justeringer i forhold til konteksten:
- Guardrail-clamp `[0.6x, 1.4x]` af team baseline giver god mening — men bør bruge **kampagne-specifik** baseline (vi har allerede `getCampaignBaselineSph`)
- Momentum-cap på ±15% for nye er konservativ og fornuftig
- Feature-flaget bør ligge i `src/config/kpiRuntime.ts` sammen med de andre feature flags

## Ændringer

### 1. `src/config/kpiRuntime.ts` — Feature flag
Tilføj `enableHybridNewHireForecast: boolean` til `KpiFeatureFlags`, default `true`.

### 2. `src/lib/calculations/forecast.ts` — Hybrid-logik

**Ny funktion: `calculateReliabilityWeight()`**
```ts
function calculateReliabilityWeight(
  totalHours: number, totalSales: number, validWeeks: number
): number {
  if (validWeeks < 2 || totalHours < 20) return 0;
  // w scales 0→1 as data grows: ramp at 2 weeks, plateau ~6 weeks
  const weekFactor = Math.min((validWeeks - 1) / 5, 1);
  const hourFactor = Math.min(totalHours / 80, 1);
  return Math.min(weekFactor * hourFactor, 1);
}
```

**Ny funktion: `forecastNewEmployeeHybrid()`**
- Beregner `rampSph = baselineSph * rampFactor` (eksisterende)
- Beregner `empiricalSph = calculateEwmaSph(emp.weeklySalesPerHour)`
- Beregner `w = calculateReliabilityWeight(...)`
- Clamper `empiricalSph` til `[0.6, 1.4] * baselineSph * rampFactor` (guardrail)
- `finalSph = (1 - w) * rampSph + w * clampedEmpiricalSph`
- Momentum: kun hvis `validWeeks >= 3`, cap ±15% i stedet for +25%
- Returnerer `EmployeeForecastResult` med ekstra metadata (`reliabilityWeight`, `empiricalSph`)

**Opdatér `calculateFullForecast()`**
- Modtag feature-flag som parameter
- Hvis `enableHybrid`: brug `forecastNewEmployeeHybrid()` for nye sælgere
- Ellers: brug eksisterende `forecastNewEmployee()` (fallback)

### 3. `src/types/forecast.ts` — Udvid typer
Tilføj til `EmployeeForecastResult`:
- `reliabilityWeight?: number`
- `empiricalSph?: number`
- `hybridBlend?: boolean`

Tilføj til `EmployeePerformance`:
- `totalHoursWorked?: number`
- `totalSalesCount?: number`
- `validWeekCount?: number`

### 4. `src/hooks/useClientForecast.ts` — Berig data
- I EWMA-loopet (linje 501-524): tæl `totalHoursWorked`, `totalSalesCount`, `validWeekCount` op per medarbejder
- Send dem med i `EmployeePerformance`
- Læs feature-flag og videregiv til `calculateFullForecast()`

### 5. `src/components/forecast/ForecastBreakdownTable.tsx` — Vis blend-info
For nye sælgere med `hybridBlend = true`: vis reliability-weight og empirisk vs. ramp SPH i tooltip.

### 6. Unit tests
Små tests i `src/lib/calculations/__tests__/forecast.test.ts`:
- Ramp-only fallback (w=0 når < 2 uger)
- Blending ved lav/mellem/høj reliability
- Momentum-cap ±15% for nye
- Guardrail clamp virker

## Berørte filer
| Fil | Ændring |
|-----|---------|
| `src/config/kpiRuntime.ts` | +1 feature flag |
| `src/types/forecast.ts` | +5 felter på interfaces |
| `src/lib/calculations/forecast.ts` | +2 funktioner, opdatér `calculateFullForecast` |
| `src/hooks/useClientForecast.ts` | Berig `EmployeePerformance` med timetal/ugetal |
| `src/components/forecast/ForecastBreakdownTable.tsx` | Vis hybrid-info |
| `src/lib/calculations/__tests__/forecast.test.ts` | +4 tests |

## Effekt
- Nye sælgere **uden** historik → ren ramp-up (uændret)
- Nye sælgere **med** 2+ gyldige uger → gradvis blending mod faktisk performance
- Guardrails forhindrer outlier-dominans
- Feature-flag gør det risikofrit at rulle ud

