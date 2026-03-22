

# Inkludér indeværende (ufuldstændig) uge i SPH for nye sælgere

## Problem
Kasper har 3 salg denne uge, men EWMA-beregningen kigger kun på **afsluttede** uger (uge -1 til -8). Da Kasper ikke har salg i nogen afsluttet uge, er hans SPH = 0 og forecast = 0 — selv om han tydeligvis sælger.

For indeværende måned fanges han af `actualSales = 3`, men for **næste måned** vises han med 0 forecast i "Ingen salgsdata"-sektionen.

## Løsning
Inkludér den **igangværende uge** i EWMA-beregningen for medarbejdere der ellers ville have 0 datapunkter. Den igangværende uge normaliseres til hele ugen (fx 3 salg på 2 dage → fremskrives til 5 dage).

### `src/hooks/useClientForecast.ts`

I EWMA-loopet (linje ~305-345):

1. **Efter** det eksisterende loop over afsluttede uger: tjek om `weeklySph` er tom
2. Hvis ja — beregn en **current-week fallback**:
   - Tæl salg og vagter for igangværende uge (mandag til i dag)
   - Normaliser til fuld uge: `adjustedSales = salesSoFar × (5 / daysWorkedSoFar)`
   - Beregn SPH fra det normaliserede tal
   - Brug dette som eneste datapunkt i EWMA
3. Denne fallback bruges KUN for medarbejdere uden historiske uger — etablerede sælgere med data påvirkes ikke

### Effekt
- Kasper ville få SPH baseret på denne uges performance → realistisk forecast for næste måned
- Medarbejdere med historik påvirkes ikke
- Nye sælgere får hurtigere en baseline-forventning

| Fil | Ændring |
|-----|---------|
| `src/hooks/useClientForecast.ts` | Tilføj current-week fallback i EWMA for medarbejdere uden historik |

