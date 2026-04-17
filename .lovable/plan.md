

## Hvorfor kommer fejlen tilbage?

### Faktuelt fra databasen lige nu

| Måned | Responses | Completions | Gap |
|-------|-----------|-------------|-----|
| April 2026 (aktiv) | 54 | 52 | **2** |
| Marts 2026 (lukket) | 58 | 55 | 3 |

**Vigtig observation**: Siden den nye edge function gik live d. 16/4 kl. 06:58 har vi kun 2 nye gaps i april. Dvs. de fleste rapporter om "loop" siden vores fix handler om **gamle besvarelser** der aldrig blev korrekt registreret som completion (før 16/4) — IKKE om brugere som lige nu indsender og bliver låst.

### De 2 nye gaps siden fix

Der er 8 responses i april med `submitted_team_id = NULL`. Edge function'en validerer `selected_team_id` som påkrævet og inserter den som `team_id`, men `submitted_team_id` (separat kolonne) sættes ikke. Ikke kritisk i sig selv. Edge function'en har korrekt rollback hvis completion fejler — så de 2 gaps må stamme fra noget andet:

**Mulig forklaring**: Brugere der har submittet TIDLIGERE (før fix), hvor response blev gemt men completion fejlede. De prøver nu igen, men edge function'en ser idempotency-tjek først — den finder ingen completion, bygger ny response, inserter, og hvis completion-RLS af en eller anden grund fejler igen ruller den tilbage. Vi bør tjekke edge-logs for konkrete fejl i dag.

### Hvor "loop"-følelsen kommer fra

Der er **2 separate UI-flow** der begge tjekker completion:

1. **PulseSurveyPopup** (popup på home) — bruger `useShouldShowPulseSurvey` → `useHasCompletedSurvey` (RPC)
2. **PulseSurveyLockOverlay** (fuld-skærm lås) — bruger `usePulseSurveyLock` der fyrer **efter** completion ER `false` og så tjekker dismissal-historik. Hvis bruger har snoozet 1+ gang OG snooze er udløbet → **lås hele appen**

Det betyder: en bruger der har trykket "påmind mig i morgen" én gang, og hvis der er **én eneste hændelse** (RLS-afvigelse, networktimeout, edge function fejler midt i, eller deres tidligere response gik tabt) → de ser låsen, kan ikke komme videre, og deres nye besvarelse kan stadig fejle stille.

### Specifikke risici jeg har identificeret

1. **RLS på pulse_survey_completions**: Policy bruger `employee_id = get_current_employee_id()`. Edge function'en bruger service role, så RLS bypasses ved insert. **MEN** `useHasCompletedSurvey` bruger RPC der kører som den indloggede bruger via `get_current_employee_id()`. Hvis `auth_user_id` aldrig blev linket til employee → RPC returnerer `false` selv om completion eksisterer.

2. **Race på auth_user_id linking**: Edge function linker `auth_user_id` ved fallback (linje 86-89), men kun når den finder employee via email. Hvis brugeren har kun fundet via `auth_user_id` direkte (linje 75) er ingen healing nødvendig — men hvis `auth_user_id` matcher EN employee, og email matcher EN ANDEN (duplikat), inserter vi completion på den forkerte employee.

3. **De 2 brugere der lige har svaret i dag (08:27 og 07:14)** har korrekte completions med matchende employees. Så for dem virker flowet — men de var aldrig "låst". De brugere der RAPPORTERER loopet er sandsynligvis dem der allerede er låst pga. gamle gaps + dismissal-historik.

### Plan: stop loopet definitivt + verificer

**1. Quick win — fjern lock-overlay fuldstændigt eller kraftigt blødgør den**
Det er låsen, ikke popup'en, der gør "systemet kører i ring" for sælgerne. Forslag: i stedet for at låse hele appen, vis kun popup'en (kan dismisses). Pulsmålingen er anonym frivillig feedback — ikke kritisk for systemets drift. Ændr `usePulseSurveyLock` til altid at returnere `isLocked: false` (eller fjern lock-overlayet helt fra `LockOverlays.tsx`). Behold popup'en som påmindelse.

**2. Heal de 2 manglende april-completions**
Vi kan ikke vide hvilke 2 brugere der mangler (responses er anonyme). Bedste tilgang: find brugere der har en SLETTET draft i `pulse_survey_drafts` audit-trail, eller alternativt: indsæt completions for ALLE aktive medarbejdere som har en tidligere dismissal-record OG ingen completion (de har bevisligt set dialog'en). Sikrer at ingen i dag bliver låst uretfærdigt.

**3. Diagnostisk tjek af edge-logs**
Hent edge function logs for `submit-employee-pulse-survey` de sidste 48 timer for at se om der er stille fejl (rollbacks, "Employee not found", duplicate auth_user_id). Det vil vise OS, ikke gætte.

**4. Auth_user_id duplikat-tjek**
Kør en query der finder employees hvor `auth_user_id` peger på samme `auth.users.id` (duplikater) — det vil afsløre om completion bliver indsat på en "skygge"-employee mens RPC kigger på en anden.

**5. Hærd RPC med email-fallback**
Opdater `has_completed_pulse_survey` til ALSO at tjekke completions via email-matchede employees, ikke kun via `get_current_employee_id()`. Det fanger ALLE historiske scenarier hvor completion blev registreret på en anden employee-id end den nuværende RPC returnerer.

### Anbefalet rækkefølge

A. **Hærd RPC'en** med email-fallback (ingen UI-ændring, fanger 100% af historiske mismatches)
B. **Fjern eller blødgør lock-overlay** (popup er nok — låsen er det der skaber loop-oplevelsen)
C. **Indkør diagnostisk SQL** der finder duplikate auth_user_id og potentielle mismatches
D. **Heal kendte gaps** ved at indsætte completions for medarbejdere med dismissal-historik uden completion

### Tekniske ændringer

- `supabase/migrations/...sql`: Opdater `has_completed_pulse_survey` til at slå op via auth.uid + email-matched employee_ids (UNION) → fanger duplikater
- `src/components/layout/LockOverlays.tsx` eller `src/hooks/usePulseSurveyLock.ts`: Deaktiver hard-lock; behold kun popup
- En heal-migration der inserter manglende completions hvor vi har bevis (dismissal eller draft)
- Frivillig: tilføj `auth_user_id` duplikat-detection som en advarsel

### Forventet effekt

- Ingen brugere kan låses ude pga. pulsmåling igen
- Eventuelt mismatch mellem RPC og lagret completion bliver tilgivende (email-fallback)
- Vi får faktisk diagnostik på hvor mange brugere der har duplikat auth_user_id (root cause for tidligere mismatches)
- Popup forsvinder stadig korrekt for dem der har svaret

