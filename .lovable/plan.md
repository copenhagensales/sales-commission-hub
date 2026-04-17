
Brugeren vil sikre at Code of Conduct (CoC) systemet ikke ender i samme "loop"-fejl som pulsmålingerne, hvor brugere blev låst ude pga. mismatch mellem completion-data og employee-id'er.

## Identificerede risici (samme mønster som pulse)

Lad mig liste de konkrete fejlkilder fra pulse og tjekke om CoC har samme:

### 1. Employee-id mismatch via auth_user_id vs email
**Pulse-problemet**: `has_completed_pulse_survey` brugte kun `get_current_employee_id()` → hvis bruger havde duplikat employee-record (én med `auth_user_id`, én med email-match), kunne completion ligge på den ene mens RPC kiggede på den anden → "loop".
**CoC-status**: `useCodeOfConductCompletion` og `useCodeOfConductLock` skal tjekkes — bruger de email-fallback ELLER kun `auth_user_id`? Sandsynligvis kun `auth_user_id` → samme risiko.

### 2. Hard-lock uden sikkerhedsventil
**Pulse-problemet**: Hvis completion-check fejlede stille (RLS, network, race), blev brugeren låst og kunne ikke komme ud. Vi måtte deaktivere hard-locken.
**CoC-status**: `CodeOfConductLockOverlay` er en hard-lock med kun "Gå til testen"-knap. Hvis completion-record findes på en skygge-employee, kan brugeren tage testen igen og igen uden at låsen forsvinder.

### 3. Completion gemmes på forkert employee_id
**Pulse-problemet**: Submit-edge-function fandt employee via `auth_user_id` ELLER email — hvis duplikater fandtes, kunne completion ende på "skygge"-employee.
**CoC-status**: `useSubmitCodeOfConduct` skal tjekkes — hvilken employee_id bruges ved insert i `code_of_conduct_completions`?

### 4. Ingen idempotency / duplikat-completions
**Pulse-problemet**: Edge function tjekkede idempotency korrekt (efter fix). 
**CoC-status**: Tjekkes — har submit en idempotency-guard?

### 5. Reminder-snooze giver permanent lås
**Nyt CoC-problem**: Vi tilføjede netop reminder + snooze-baseret lock. Hvis snooze-timestamp er sat og brugeren tager testen, men `acknowledged_at` ikke sættes korrekt → permanent lås selvom test er bestået.

## Plan: hærdning af CoC-systemet

### A. Hærd `has_valid_code_of_conduct_completion` RPC (eller tilsvarende)
- Opret/opdater RPC der tjekker completion via `auth.uid()` UNION email-matchede employees (samme mønster som `has_completed_pulse_survey`).
- `useCodeOfConductCompletion` og `useCodeOfConductLock` skifter til denne RPC i stedet for direkte tabel-query.

### B. Lock skal aldrig udløses hvis test ER bestået
- I `useCodeOfConductLock`: hvis der findes en gyldig (ikke-udløbet) completion via email-fallback → `isLocked: false` UANSET reminder/snooze-state.
- Acknowledged_at sættes automatisk når en completion oprettes, så reminder ikke hænger fast efter bestået test.

### C. Heal eksisterende mismatches
- Migration: For alle aktive medarbejdere med duplikat-employee-records, sammenflet completion-historik (eller log advarsel hvis manuel oprydning kræves).
- For brugere med en åben reminder MEN en gyldig completion → auto-sæt `acknowledged_at = now()`.

### D. Submit-flow rettes
- `useSubmitCodeOfConduct`: brug samme employee-resolution som RPC (auth.uid → email-fallback), så completion altid lander på "korrekt" employee. Idempotency: hvis completion allerede findes i samme periode → skip insert, returner success.
- Trigger eller logik der auto-acknowledger åbne reminders ved ny completion.

### E. Sikkerhedsventil i overlay
- `CodeOfConductLockOverlay` får en "log ud / kontakt support"-knap (samme mønster som `PulseSurveyLockOverlay`) så brugeren aldrig er fuldstændig fanget hvis noget går galt.

### F. Diagnostik
- SQL-tjek for: (1) brugere med åben reminder + gyldig completion, (2) employees med duplikat `auth_user_id`/email, (3) completions uden matchende employee.
- Tilføj logging i submit-flow så vi kan diagnosticere fremtidige issues hurtigt.

## Tekniske ændringer

- **Migration**: Ny/opdateret RPC `has_valid_code_of_conduct_completion(_user_id uuid)` med email-fallback UNION; heal-script for åbne reminders med eksisterende completions; trigger/logik til auto-acknowledge af reminders ved completion-insert.
- **`src/hooks/useCodeOfConduct.ts`**: Skift `useCodeOfConductCompletion` og `useCodeOfConductLock` til at bruge ny RPC. Sørg for at `isLocked` aldrig kan være `true` hvis gyldig completion findes.
- **`src/hooks/useCodeOfConductReminder.ts`**: Tjek completion FØR popup vises — hvis bestået, skjul popup permanent.
- **`useSubmitCodeOfConduct`**: Robust employee-resolution + idempotency + auto-acknowledge åbne reminders ved succes.
- **`src/components/layout/CodeOfConductLockOverlay.tsx`**: Tilføj "Log ud"-fallback-knap.
- **Diagnostisk SQL-kørsel** for at finde nuværende mismatches og heale dem inden den nye logik aktiveres.

## Forventet effekt

- Ingen brugere kan låses ude pga. duplikate employee-records eller skygge-completions
- Completion bestået → lock og popup forsvinder garanteret (også hvis reminder-snooze er udløbet)
- Hvis noget alligevel går galt, har brugeren en udvej (log ud)
- Vi har diagnostik-data så fremtidige fejl kan opdages og fixes proaktivt
