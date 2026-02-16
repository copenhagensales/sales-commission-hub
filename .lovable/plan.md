

## Tilf distribution af besvarelser ved mouseover i gennemsnitsgrafen

### Hvad skal ændres
Lige nu viser tooltip'en på barcharten kun gennemsnittet og det fulde spørgsmål. Planen er at udvide tooltip'en, så den også viser fordelingen af individuelle svar -- fx "Score 1: 2 svar, Score 9: 4 svar".

### Ændringer

**Fil: `src/pages/PulseSurveyResults.tsx`**

1. Udvid `AveragesChart`-komponenten til også at modtage `filteredResponses` (de rå besvarelser) som prop.

2. For hvert spørgsmål i `data`-arrayet, beregn en histogram-fordeling (antal besvarelser per score-værdi) baseret på de rå responses.

3. Opdater den custom tooltip til at vise:
   - Gennemsnittet (som nu)
   - Det fulde spørgsmål (som nu)
   - En lille tabel/liste over fordelingen: "Score X: Y svar" for alle scores der har mindst 1 besvarelse, sorteret fra lavest til højest
   - Totalt antal besvarelser for det pågældende spørgsmål

4. Opdater kaldet til `AveragesChart` (ca. linje 430) til at sende `filteredResponses` med som prop.

### Tekniske detaljer

- `AveragesChart` props udvides med `responses: any[]`
- I `data`-mappingen tilføjes et `distribution`-objekt per spørgsmål:
  ```
  distribution: { [scoreValue: number]: count }
  ```
- Tooltip-indholdet udvides med en liste over fordelingen, kun for scores med mindst 1 besvarelse
- Ingen nye dependencies kræves -- alt bygger på eksisterende Recharts custom tooltip

