

## Analyse: Hvorfor pulsmålingen bliver ved med at dukke op

### Fundet (data-bevis)

| Måned | Besvarelser | Completions | Manglende |
|-------|------------|-------------|-----------|
| April 2026 | 52 | 50 | **2** |
| Marts 2026 | 58 | 55 | **3** |
| Feb 2026 | 37 | 0 | **37** |
| Jan 2026 | 66 | 0 | **66** |
| Dec 2025 | 58 | 1 | **57** |

I alt **103 besvarelser** mangler en completion-record. Det betyder, at brugeren har udfyldt og sendt pulsmålingen, men systemet "glemmer" det og viser den igen næste gang de logger ind.

### Hvorfor sker det?

I `useSubmitPulseSurvey` (`src/hooks/usePulseSurvey.ts`) udføres indsendelsen i to separate steps mod databasen fra klienten:

1. **INSERT i `pulse_survey_responses`** — anonymt svar (uden employee_id)
2. **INSERT i `pulse_survey_completions`** — markerer at brugeren har besvaret

To kritiske fejl:

**A. Race condition / RLS-fejl ved completion-insert**
Klient-koden bruger `private_email/work_email` for at finde `employee_id`, men RLS-policyen på `pulse_survey_completions` kræver, at `employee_id = get_current_employee_id()` (som kobler via `auth_user_id`). Hvis email-matchet returnerer en anden employee end den, RLS-funktionen finder via `auth_user_id`, vil insert-et fejle silently for brugeren (toast viser "Tak for din besvarelse" baseret på response 1, men step 2 fejler).

**B. Ingen transactionel sammenhæng**
Hvis netværket fejler mellem step 1 og step 2 (browser lukker fanen, mister wifi efter response, m.m.), gemmes besvarelsen, men completion'en gør ikke. Resultat: brugeren ser pop-up'en igen ved næste login.

**C. Ingen fallback / healing**
Der er ingen logik der siger: "Hvis der findes en response for denne survey + bruger, så betragt det som completed." Fordi `pulse_survey_responses` er anonym (ingen `employee_id`), kan man ikke direkte krydsreferere — men `pulse_survey_drafts` slettes først efter step 2, så draft-tabellen kan bruges som indikator (fjernes ved `deleteDraft.mutate()` i `handleSubmit`).

### Løsningsplan

**1. Flyt indsendelse til en edge function (atomisk)**
Lav en ny edge function `submit-employee-pulse-survey` (med service role) der i én transaktion:
- Finder employee_id via auth-bruger
- Inserter response (anonymt med team_id/department)
- Inserter completion-record
- Sletter draft

Hvis nogen del fejler → returner fejl, ingen orphaned data.

**2. Migrer client `useSubmitPulseSurvey`**
Brug `supabase.functions.invoke('submit-employee-pulse-survey', ...)` i stedet for to separate inserts.

**3. Healing for de 103 eksisterende manglende completions**
Migration der: For hvert udkast (`pulse_survey_drafts`) der IKKE eksisterer for en bruger + survey kombination MEN hvor brugeren har en draft der er blevet slettet — kan vi ikke nemt rekonstruere. **Bedre løsning:** Tilføj en `submitted_employee_id` kolonne der KUN bruges til completion-tracking (separat fra anonyme svar) — eller alternativt kør en engangs-migration der inserter completions for surveys der er afsluttede (closed-out måneder), så brugere ikke ser februar/januar igen.

→ Konkret forslag: kør en engangs SQL-migration der for **lukkede måneder** (alle undtagen aktiv) markerer alle medarbejdere som "completed" hvis de tilhørte teamet på det tidspunkt. Eller mere konservativt: deaktiver gamle surveys (`is_active = false`) så `useActivePulseSurvey` ikke længere returnerer dem.

**4. Tilføj retry/healing for fremtiden**
Ved login: hvis en bruger har en response uden completion (krydsreference via en ny audit-tabel eller `submission_log`), repair'es det. Eller simpler: tilføj en `last_submitted_at` kolonne på en `pulse_survey_user_state` tabel som er den enkelt-kilde-til-sandhed.

### Anbefalet minimal implementation

- **Edge function** `submit-employee-pulse-survey` — atomisk indsendelse (response + completion + draft-slet)
- **Opdater** `useSubmitPulseSurvey` til at kalde edge functionen
- **Engangs-fix:** Sæt `is_active = false` på alle surveys ældre end nuværende måned (jan, feb, dec, marts) — så aktive brugere ikke ser dem
- **Bonus:** Sæt completions for april's 2 manglende baseret på matching draft-historik hvis muligt, ellers lad være

Dette løser både den underliggende race condition fremover og fjerner de gamle "spøgelses-pulsmålinger" for brugere der allerede har besvaret.

