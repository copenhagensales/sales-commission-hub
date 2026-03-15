

## Opdater pulsmåling-skabelonen med de nye spørgsmål

### Problem
De 5 nye spørgsmål (produkt/kampagne) blev tilføjet som hardcoded felter i `PulseSurvey.tsx`, men skabelonen i databasen (`quiz_templates` tabellen) blev ikke opdateret. `PublicPulseSurvey.tsx` læser spørgsmål udelukkende fra skabelonen — så de nye spørgsmål vises ikke der.

### Ændringer

**1. `src/pages/PulseSurveyResults.tsx`** — Tilføj de 4 nye spørgsmål til `INITIAL_DEFAULT_QUESTIONS` (de er allerede der ✓). Sikre at når skabelonen gemmes, inkluderes de nye spørgsmål automatisk hvis de mangler i den eksisterende skabelon.

**2. `src/pages/PulseSurvey.tsx`** — Refaktorer så spørgsmålene læses fra skabelonen (ligesom `PublicPulseSurvey.tsx` gør) i stedet for at være hardcoded. Behold de hardcoded spørgsmål som fallback, men prioritér skabelon-data fra databasen.

**3. `src/pages/PublicPulseSurvey.tsx`** — Tilføj den nye fritekst-sektion for "Kampagneforbedring" (`campaign_improvement_suggestions`) da den offentlige survey kun renderer scale-spørgsmål fra skabelonen, men ikke det nye fritekst-felt. Opdater nummerering.

**4. Auto-migration af eksisterende skabelon** — I `PulseSurveyResults.tsx`, udvid initialiseringslogikken: Hvis skabelonen findes i DB men mangler de nye spørgsmål-id'er, tilføj dem automatisk og gem opdateringen. Dette sikrer at eksisterende installationer får de nye spørgsmål uden manuelt at skulle slette og genskabe skabelonen.

### Tekniske detaljer
- `PulseSurvey.tsx` bruger i dag et hardcoded `SCALE_QUESTIONS` array — det erstattes med skabelon-data + fallback
- `PublicPulseSurvey.tsx` har allerede skabelon-integration men mangler `campaign_improvement_suggestions` fritekst-felt
- Skabelon-auto-update: Tjek om `INITIAL_DEFAULT_QUESTIONS` har id'er der mangler i den gemte skabelon, og merge dem ind

