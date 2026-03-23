

# Månedsprogress baseret på kundetarget

## Problem
Progress-baren bruger `totalSalesExpected` (forecast) som mål. Den bør bruge kundens manuelle target fra `client_monthly_targets` som grundlag for progress og pace-beregning.

## Ændringer

### 1. `src/components/forecast/ForecastProgressBar.tsx`
- Tilføj prop `clientTarget?: number | null`
- Brug `clientTarget` som `total` i stedet for `totalSalesExpected` (fallback til forecast hvis intet target er sat)
- Pace "behøves resten" beregnes ud fra target
- Vis "Intet kundetarget" besked hvis target mangler (i stedet for at bruge forecast)

### 2. `src/pages/Forecast.tsx`
- Send `clientTarget={targetData}` til `ForecastProgressBar`
- Skjul progress-bar hvis intet target er sat (eller vis med besked)

| Fil | Ændring |
|-----|---------|
| `src/components/forecast/ForecastProgressBar.tsx` | Brug `clientTarget` prop som mål for progress |
| `src/pages/Forecast.tsx` | Send `targetData` til ForecastProgressBar |

