

## Kladde-funktionalitet til pulsmålingen

### Oversigt
Tilføj en ny tabel `pulse_survey_drafts` der gemmer delvise besvarelser pr. medarbejder pr. survey. Surveyen auto-gemmer løbende og genindlæser kladden når medarbejderen vender tilbage.

### Database
Ny tabel `pulse_survey_drafts`:
- `id` (uuid, PK)
- `survey_id` (uuid, FK → pulse_surveys)
- `employee_id` (uuid, FK → employee_master_data)
- `draft_data` (jsonb) — alle formfelter serialiseret
- `updated_at` (timestamptz)
- Unique constraint på `(survey_id, employee_id)`
- RLS: medarbejdere kan kun læse/skrive egne kladder

### Frontend-ændringer

**Ny hook i `src/hooks/usePulseSurvey.ts`:**
- `usePulseSurveyDraft(surveyId)` — henter eksisterende kladde ved load
- `useSavePulseSurveyDraft()` — upsert kladde
- `useDeletePulseSurveyDraft()` — slet kladde efter endelig indsendelse

**Ændringer i `src/pages/PulseSurvey.tsx`:**
- Ved mount: hent kladde og populer `formData`, `npsComment`, `improvementSuggestions`
- Auto-gem kladde med debounce (3 sek) ved enhver ændring
- Vis "Kladde gemt" indikator
- Slet kladde efter succesfuld indsendelse
- Vis info-tekst om at svar gemmes automatisk

### Tekniske detaljer
- Debounce via `useEffect` + `setTimeout` for at undgå for mange writes
- Kladden gemmes som ét JSON-objekt med alle svar
- Kladden slettes automatisk ved final submit (i `useSubmitPulseSurvey`)

