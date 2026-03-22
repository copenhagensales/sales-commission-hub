

# Momentum-korrektion i forecast

## Problem
EWMA bruger kun afsluttede uger (uge -1 til -8). Hvis teamet er i en opadgående trend — fx de seneste 2 uger er markant bedre end EWMA-gennemsnittet — ignorerer næste måneds forecast dette momentum. Kunder ser et fald som virker urealistisk.

## Løsning
Tilføj en **momentum-faktor** der sammenligner de seneste 2 ugers SPH med den fulde EWMA. Hvis der er positiv trend, justér SPH op (med et loft så det ikke eksploderer).

### Beregning
```text
recentSph = gennemsnit af de 2 nyeste ugers SPH
ewmaSph   = standard EWMA over alle 8 uger
ratio     = recentSph / ewmaSph

Hvis ratio > 1.05 (5% over gennemsnit):
  momentumFactor = min(ratio, 1.25)  // max 25% boost
  adjustedSph = ewmaSph × momentumFactor
Ellers:
  adjustedSph = ewmaSph (ingen ændring)
```

Momentum-korrektionen anvendes **kun for fremtidige perioder** (næste måned+). For indeværende måned bruges actual + remaining som i dag.

### Ændringer

**`src/lib/calculations/forecast.ts`**
- Ny funktion `applyMomentum(weeklySph, ewmaSph)` → returnerer justeret SPH + momentumFactor
- Opdater `forecastEstablishedEmployee`: kald `applyMomentum` og brug justeret SPH til forecast-beregning
- Tilføj `momentumFactor` til `EmployeeForecastResult` (optional)
- Tilføj en "Momentum"-driver i `calculateFullForecast` når gennemsnitlig momentum > 1.05

**`src/types/forecast.ts`**
- Tilføj `momentumFactor?: number` til `EmployeeForecastResult`

**`src/components/forecast/ForecastBreakdownTable.tsx`**
- Vis momentum-indikator (fx "↑12%") ved siden af SPH for medarbejdere med momentum > 1.05

### Effekt
- Hvis teamet sælger 15% over historisk gennemsnit de seneste 2 uger → næste måneds forecast justeres op med 15%
- Maksimalt 25% boost for at undgå overoptimistiske tal
- Kun nedad-trend ignoreres (vi justerer ikke ned — EWMA håndterer det allerede via decay)

| Fil | Ændring |
|-----|---------|
| `src/lib/calculations/forecast.ts` | Ny `applyMomentum` funktion, brug i established forecast + driver |
| `src/types/forecast.ts` | Tilføj `momentumFactor` felt |
| `src/components/forecast/ForecastBreakdownTable.tsx` | Vis momentum-indikator per medarbejder |

