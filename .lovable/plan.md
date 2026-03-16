

## Tilføj "Overvejelser om frafald"-spørgsmålet til pulsmålingen

### Problem
Spørgsmålet `attrition_risk_score` ("Hvor sandsynligt er det, at du stadig arbejder i Copenhagen Sales om 6 måneder?") eksisterer i databasen og vises som kolonne i heatmappet, men det bliver aldrig stillet i selve surveyet. Derfor er kolonnen altid "-".

### Ændringer

**1. `src/pages/PulseSurvey.tsx`** — Tilføj spørgsmålet til QUESTIONS-arrayet
- Indsæt efter `psychological_safety_score` (linje 43):
  ```
  { key: 'attrition_risk_score', question: 'Hvor sandsynligt er det, at du stadig arbejder i Copenhagen Sales om 6 måneder?', lowLabel: 'Meget usandsynligt', highLabel: 'Meget sandsynligt', section: 'wellbeing' }
  ```

**2. `src/pages/PublicPulseSurvey.tsx`** — Tilføj til SECTION_CONFIG
- Tilføj `'attrition_risk_score'` til `wellbeing`-sektionens `questionIds` (linje 31)

**3. `src/hooks/usePulseSurvey.ts`** — Tilføj til PulseSurveyResponse interface
- Tilføj `attrition_risk_score: number;` til interfacet

**4. `supabase/functions/submit-pulse-survey/index.ts`** — Sikr at feltet gemmes
- Tilføj `attrition_risk_score` til insert-objektet i edge function

### Ingen database-ændringer
Kolonnen `attrition_risk_score` eksisterer allerede i `pulse_survey_responses`-tabellen.

