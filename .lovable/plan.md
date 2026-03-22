

# Hvorfor næste måned viser færre salg trods 11 nye fra opstartshold

## Analyse

Jeg har gennemgået beregningslogikken og fundet **to hovedårsager**:

### 1. Indeværende måned er "boosted" af faktiske salg over pace
For marts bruges modellen "Actual + Remaining": de 150+ faktiske salg til dato låses ind, og kun de resterende dage forecasts med EWMA. Hvis teamet sælger over deres historiske gennemsnit (EWMA), bliver totalen højere end en ren projektion.

For april bruges **kun** EWMA-projektion for hele måneden — ingen "boost" fra over-performance.

### 2. Cohort-bidraget er lavere end forventet pga. ramp + survival
De 11 nye bidrager ikke med fuld kapacitet:
- **Hold 1** (5 pers, start 31/3): Ramp-faktor ~60%, survival ~85% → arbejder effektivt som ~2.5 sælgere
- **Hold 2** (6 pers, start 14/4): Kun ~2.3 uger i april, ramp ~35%, survival ~92% → effektivt som ~1.5 sælgere
- **Samlet cohort-bidrag**: ~50 salg (i stedet for ~150 som 11 fuldt produktive sælgere ville give)

## Løsningsforslag

For at gøre dette mere gennemsigtigt og potentielt mere retvisende:

### A. Vis "Kapacitetssammenligning" i drivers (anbefalet)
Tilføj en driver i næste-måned-forecast der forklarer forskellen:
- "Denne måned: X faktiske + Y remaining = Z total"  
- "Næste måned: Ren projektion baseret på historisk SPH + cohorts"
- Gør det tydeligt at forskellen skyldes at marts-salg er over pace

### B. Alternativ: Juster næste-måned-projektion for momentum
Hvis EWMA under-estimerer fordi teamet er i en opadgående trend, kan vi tilføje en **trend-korrektion**: sammenlign seneste 2 ugers SPH med EWMA og justér op hvis der er positiv momentum.

## Anbefaling
Start med **A** (transparens) — det er en ren UI-ændring der ikke ændrer beregninger, men gør det klart hvorfor tallene ser ud som de gør. **B** kan tilføjes som fase 2 hvis forecasts konsekvent er for konservative.

| Fil | Ændring |
|-----|---------|
| `src/lib/calculations/forecast.ts` | Tilføj "kapacitetssammenligning"-driver for non-current periods |
| `src/hooks/useClientForecast.ts` | Send denne-måneds-total med som kontekst til drivers |

