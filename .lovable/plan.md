

# Separér medarbejdere uden salgshistorik

## Problem
Medarbejdere som Kasper og Max har korrekt agent-mapping, men 0 salg for den valgte kampagne. De vises i hovedtabellen med "Churn-risiko" badge — misvisende, da problemet er manglende salgsdata, ikke dårlig performance.

## Løsning
Tilføj en tredje gruppe i breakdown-tabellen: "Ingen salgsdata" — for medarbejdere der er mappet men har 0 SPH og 0 salg.

### `src/components/forecast/ForecastBreakdownTable.tsx`

1. Split `mappedEmployees` i to undergrupper:
   - `activeEmployees`: har `expectedSph > 0` ELLER `actualSales > 0`
   - `noDataEmployees`: har `expectedSph === 0` OG `(actualSales || 0) === 0`

2. Vis `noDataEmployees` i en separat sektion (blå/neutral farve) med:
   - Info-ikon + "Ingen salgsdata for denne kampagne"
   - Forklaring: "Disse medarbejdere er korrekt opsat, men har ingen registrerede salg for den valgte kampagne i de seneste 8 uger."
   - Vis navn, team, planlagte timer

3. Fjern dem fra `activeEmployees`-tabellen og fra gennemsnits-SPH beregning

### Effekt
- Kasper og Max flyttes ud af hovedtabellen → ingen misvisende "Churn-risiko"
- Hovedtabellens gennemsnit forvrænges ikke af 0-SPH medarbejdere
- Klar kommunikation om hvad der mangler

| Fil | Ændring |
|-----|---------|
| `src/components/forecast/ForecastBreakdownTable.tsx` | Tilføj tredje gruppe for mapped-men-ingen-data |

