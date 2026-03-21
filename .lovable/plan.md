

# Fix: Forecast underpredicts — 801 vs 886 faktiske salg

## Root cause analyse

### Problem 1: EWMA tæller ferie/fridage som "0 produktivitet" (STØRSTE PROBLEM)
Når en sælger har fri (ferie, dag_off, sygdom), har de 0 salg den uge. Men hooket antager stadig 5 vagter × 7.5t = 37.5 timer, hvilket giver SPH = 0 for den uge.

**Eksempel — Hans (topperformer):**
- Uge 26/1: 62 salg → SPH 1.65
- Uge 23/2: 0 salg (3 fridage + sygdom) → SPH **0.00**
- Denne uge med SPH=0 trækker hans EWMA fra ~1.1 ned mod ~0.9

Det rammer ALLE medarbejdere der har haft bare én ferieuge i de 8 EWMA-uger.

### Problem 2: `day_off` absencer ignoreres
Hooket henter kun `["sick", "vacation", "no_show"]`, men mange absencer er type `day_off`. Disse tælles hverken i SPH-beregning eller forecast-timer. Der er **14 day_offs** i perioden for Eesy TM.

### Problem 3: 2 medarbejdere mangler agent-mapping
Kasper Vestergaard og Max Ammitzbøll Andersen har INGEN `employee_agent_mapping`. Deres salg (10 salg tilsammen denne md via `kave@` og `maaa@`) tælles ikke i EWMA, og de forecaster 0 salg.

## Ændringer

### 1. `src/hooks/useClientForecast.ts` — Brug absence-justeret timer til SPH

**Nu:** `countShifts(emp.id, ws, we, false)` — tæller vagter UDEN at fjerne fravær
**Fix:** `countShifts(emp.id, ws, we, true)` — tæller vagter MED fravær fjernet

Så en uge med 3 fridage giver 2 shifts × 7.5t = 15t, ikke 5 × 7.5t = 37.5t.
SPH = 0/15 forbliver 0 men EWMA håndterer det bedre.

**Bedre fix:** Skip uger helt hvor medarbejderen har 0 effektive vagter (fuld ferie):
```typescript
if (shiftsInWeek === 0) continue; // Skip week, don't include in EWMA
```

### 2. `src/hooks/useClientForecast.ts` — Inkluder `day_off` i absence-query

**Nu:** `.in("type", ["sick", "vacation", "no_show"])`
**Fix:** `.in("type", ["sick", "vacation", "no_show", "day_off"])`

### 3. `src/lib/calculations/forecast.ts` — EWMA skal ignorere tomme uger

Opdater `calculateEwmaSph` til at acceptere et `skipZeroHourWeeks` parameter eller modifiker hooket til at filtrere 0-uger fra `weeklySph` arrayet inden det sendes til EWMA.

**Vigtigst:** Uger hvor `shiftsInWeek === 0` efter absence-justering skal IKKE inkluderes i SPH-arrayet. De repræsenterer fravær, ikke lav performance.

### Samlet effekt
- Hans' EWMA: ~0.90 → ~1.05 (hans 0-uge fjernes)
- Lignende forbedring for alle medarbejdere med fridage/ferie i EWMA-vinduet
- 10 ekstra salg fra de 2 unmapped medarbejdere
- `day_off` fravær reducerer planlagte timer korrekt

### Estimat
Med disse fixes: ~950-1050 forecast for marts (realistisk ift. 886 allerede + 8 arbejdsdage tilbage)

| Fil | Ændring |
|-----|---------|
| `src/hooks/useClientForecast.ts` | Brug absence-justerede vagter til SPH, inkluder `day_off`, skip 0-uger |
| `src/lib/calculations/forecast.ts` | EWMA håndterer filtrerede uger korrekt |

