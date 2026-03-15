

## Test-knap til pulsmåling

### Tilgang
Tilføj en "Test survey" knap på resultat-siden (`/pulse-survey-results`) der åbner surveyen i test-tilstand. I test-tilstand:
- Surveyen vises normalt med alle spørgsmål
- Indsend-knappen siger "Afslut test (gemmes ikke)"
- Ingen data gemmes til databasen (hverken svar, drafts eller completion)
- En synlig banner viser at man er i test-tilstand

### Implementering

**1. `src/pages/PulseSurvey.tsx`**
- Læs URL-parameter `?test=true` via `useSearchParams`
- Hvis `test=true`:
  - Skip tjek for aktiv survey og completion-status — vis altid formularen
  - Vis en gul/orange banner øverst: "Du er i test-tilstand — svar gemmes ikke"
  - Deaktiver auto-save af drafts
  - Ved submit: Vis toast "Test afsluttet — ingen data blev gemt" og naviger tilbage til resultatsiden
  - Skip al database-interaktion

**2. `src/pages/PulseSurveyResults.tsx`**
- Tilføj en "Test pulsmåling" knap i header-området ved siden af andre handlinger
- Knappen navigerer til `/pulse-survey?test=true`

