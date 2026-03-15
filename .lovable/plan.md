

## Tilføj 5 nye spørgsmål til pulsmålingen

### Nye kolonner i `pulse_survey_responses`
4 nye score-kolonner + 1 fritekst-kolonne:

| Kolonne | Type |
|---------|------|
| `product_competitiveness_score` | integer, nullable |
| `market_fit_score` | integer, nullable |
| `interest_creation_score` | integer, nullable |
| `campaign_attractiveness_score` | integer, nullable |
| `campaign_improvement_suggestions` | text, nullable |

### Filer der ændres

**1. Database migration** — Tilføj de 5 kolonner til `pulse_survey_responses`.

**2. `supabase/functions/submit-pulse-survey/index.ts`** — Tilføj de 4 nye score-kolonner til `KNOWN_SCORE_COLUMNS` og håndter `campaign_improvement_suggestions` som fritekstfelt.

**3. `src/hooks/usePulseSurvey.ts`** — Udvid `PulseSurveyResponse` interfacet med de 5 nye felter.

**4. `src/pages/PulseSurvey.tsx`** — Tilføj 4 nye scale-spørgsmål (nr. 12-15) og 1 fritekst (nr. 16) efter de eksisterende. Opdater validering til at kræve de nye scores. Opdater nummerering af "Forbedringsforslag" til nr. 17. Inkluder nye felter i draft-load/save.

**5. `src/pages/PulseSurveyResults.tsx`** — Tilføj de 4 nye score-spørgsmål til `INITIAL_DEFAULT_QUESTIONS` så de vises i resultatvisningen.

### Spørgsmålsnummerering (opdateret)
- 12: Produktkonkurrenceevne (1-10)
- 13: Markedsmatch (1-10)
- 14: Interesse for produkter (1-10)
- 15: Kampagneattraktivitet (1-10)
- 16: Kampagneforbedring (fritekst)
- 17: Forbedringsforslag (eksisterende, omnummereret)

