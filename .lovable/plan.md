

# Fix: Rebecca Hove mangler i næste måneds forecast

## Problem
Rebecca Hove (og potentielt andre) filtreres væk fra forecast-tabellen for næste måned. Det sker i to trin:

1. **EWMA = 0**: Rebecca har været på ferie/fridage næsten hele marts (uge 9-13). Alle 4 EWMA-uger springes over fordi hun arbejdede under 50% kapacitet. Resultat: `expectedSph = 0`.

2. **Tabelfiltrering**: `ForecastBreakdownTable` linje 62 filtrerer med:
   ```
   e.expectedSph > 0 || (e.actualSales || 0) > 0
   ```
   For næste måned (april) er `actualSales = 0` (ikke startet endnu), og `expectedSph = 0` (ingen EWMA-data). Rebecca forsvinder helt fra tabellen.

## Løsning

### 1. `useClientForecast.ts` -- Fallback SPH for medarbejdere med 0 gyldige uger
Når `weeklySph` er tom (alle uger sprunget over), brug en **ældre historik-fallback**:
- Udvid EWMA-vinduet til 8 uger bagud for at finde mindst 1 gyldig uge
- Hvis stadig 0: brug team-gennemsnittet for den periode som fallback
- Markér medarbejderen som "estimeret" så det er synligt i UI

### 2. `ForecastBreakdownTable.tsx` -- Vis alle etablerede medarbejdere
Fjern filtreringen der skjuler medarbejdere med `expectedSph = 0`. I stedet:
- Vis dem i tabellen med et "Ingen data" eller "Fravær"-badge
- De kan stadig have planlagte timer (shifts) i forecast-perioden, og bør vises med 0 eller et estimat

## Berørte filer

| Fil | Ændring |
|-----|---------|
| `src/hooks/useClientForecast.ts` | Tilføj fallback-SPH når alle EWMA-uger er tomme (udvid vindue eller brug team-snit) |
| `src/components/forecast/ForecastBreakdownTable.tsx` | Fjern `expectedSph > 0`-filter; vis alle etablerede med planlagte timer |

## Teknisk detalje

I `useClientForecast.ts` efter EWMA-loopet (ca. linje 530):
```typescript
// If no valid weeks found, try extending to 12 weeks back
if (weeklySph.length === 0) {
  // Try 4 more weeks back...
  // If still 0, use team average SPH as fallback
}
```

I `ForecastBreakdownTable.tsx` linje 62:
```typescript
// Before (hides Rebecca):
const activeEmployees = establishedMapped.filter(e => e.expectedSph > 0 || (e.actualSales || 0) > 0);

// After (show all with planned hours):
const activeEmployees = establishedMapped.filter(e => 
  e.expectedSph > 0 || (e.actualSales || 0) > 0 || e.plannedHours > 0
);
```

