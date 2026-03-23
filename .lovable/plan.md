

# Fix: Ekskludér uger med delvist fravær fra SPH-beregning

## Problem
Når en medarbejder har haft ferie, springer koden kun uger med **0 vagter** over. Men uger med delvist fravær (fx 1-2 vagter ud af 5) tælles stadig med — og giver kunstigt lav SPH som trækker EWMA'en ned. Desuden påvirker ferieperioden attendance factor negativt.

## Løsning
Hæv tærsklen for hvornår en uge medtages i SPH-beregningen: en uge skal have mindst 50% af normal kapacitet for at tælle. Derudover ekskludér godkendt ferie fra attendance factor-beregningen (kun sygdom/no_show skal reducere fremmøde).

## Ændringer

### `src/hooks/useClientForecast.ts`

**1. SPH-ugefiltrering (linje 340-356):**
- Beregn medarbejderens "normale" ugekapacitet (fra standard-vagtplan)
- Skip uger hvor `shiftsInWeek < normalWeekShifts * 0.5` — ikke kun 0
- Det sikrer at ferieuger med 1-2 dage ikke forurener SPH

**2. Attendance factor (linje 370-375):**
- Ændr beregningen så kun `sick` og `no_show` fravær tæller som reduceret fremmøde
- `vacation` er planlagt og allerede håndteret via vagtplanen — det skal ikke dobbelt-straffe

| Fil | Ændring |
|-----|---------|
| `src/hooks/useClientForecast.ts` | Strengere ugefilter i SPH + ekskludér ferie fra attendance factor |

