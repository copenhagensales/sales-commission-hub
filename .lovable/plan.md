
Brugeren vil ændre Code of Conduct-systemet:
1. Fjern email-påmindelse → erstat med in-app popup når admin trykker "Send påmindelse"
2. Popup kan udskydes max 24 timer
3. Efter 24 timer (eller hvis ikke besvaret) → fuld lås af systemet indtil bestået
4. Alle spørgsmål skal besvares korrekt for at bestå
5. Ved fejl: tag kun de forkerte spørgsmål om

Tjek nuværende state - quiz-logik er allerede sådan at man kun retager forkerte spørgsmål (set i CodeOfConduct.tsx). Lock-overlay eksisterer allerede (CodeOfConductLockOverlay). Skal verificere submit-logik passing-threshold + tilføje reminder-system.

## Plan

### 1. Fjern email-baseret påmindelse
- **`src/pages/CodeOfConductAdmin.tsx`**: Knappen "Send påmindelse" kalder ikke længere edge function. I stedet inserter den reminder-rækker i ny tabel `code_of_conduct_reminders` for hver berettiget medarbejder (manglende eller udløbet).
- **Edge function `send-code-of-conduct-reminder`**: Beholdes ikke aktivt — slet indhold/lad ligge ubrugt (eller fjern kald).

### 2. Ny tabel: `code_of_conduct_reminders`
Kolonner:
- `id`, `employee_id` (FK), `created_at`, `created_by`
- `snoozed_until` (timestamptz, nullable) — sat når brugeren udskyder
- `snooze_count` (int, default 0) — max 1 udskydelse tilladt
- `acknowledged_at` (timestamptz, nullable) — sat når brugeren går til testen
- RLS: brugere ser egne, admins kan oprette/se alle

### 3. Reminder-popup (ny komponent)
- **`src/components/code-of-conduct/CodeOfConductReminderPopup.tsx`**: Vises ved login/navigation hvis brugeren har en aktiv reminder uden completion. Viser knap "Tag testen nu" og "Udskyd 24 timer" (kun synlig hvis `snooze_count = 0`).
- Hook: **`src/hooks/useCodeOfConductReminder.ts`** — fetcher aktiv reminder for nuværende bruger.
- Indsættes i `MainLayout` ved siden af eksisterende popups.

### 4. Skærp lock-logik
- **`src/hooks/useCodeOfConduct.ts`** (`useCodeOfConductLock`): Lock aktiveres nu hvis:
  - (a) eksisterende 7-dages logik OR
  - (b) bruger har en reminder hvor `snoozed_until < now()` (eller aldrig snoozet og oprettet for >0 sekunder siden uden acknowledgment) — dvs. udskudt tid er udløbet
- `CodeOfConductLockOverlay` er allerede i brug via `LockOverlays.tsx` — verificeres.

### 5. Quiz-logik (verificering)
Allerede korrekt:
- `CODE_OF_CONDUCT_QUESTIONS` brugt i `CodeOfConduct.tsx`
- Submit returnerer `wrongQuestionNumbers` og kræver alle korrekte (`passed = wrongQuestionNumbers.length === 0`) — bekræfter ved at læse `useCodeOfConduct.ts`
- Næste forsøg viser kun forkerte spørgsmål (allerede implementeret via `currentAttempt.wrong_question_numbers`)

Hvis logikken ikke er 100% (alle korrekte krævet), opdateres `useSubmitCodeOfConduct` så `passed` kun er `true` når 0 forkerte.

### 6. Admin UI opdatering
- Knappen i `CodeOfConductAdmin.tsx` skifter tekst: "Send in-app påmindelse til X medarbejdere"
- Toast: "Påmindelse vist i systemet for X medarbejdere"
- Ingen email afsendes

### Tekniske ændringer
- **Migration**: Opret tabel `code_of_conduct_reminders` + RLS-policies + index på `(employee_id, acknowledged_at)`
- **Hook**: Ny `useCodeOfConductReminder` (fetch + snooze + acknowledge mutations)
- **Komponent**: `CodeOfConductReminderPopup`
- **Layout**: Tilføj popup i `MainLayout` (eller `LockOverlays`)
- **Lock-hook**: Udvid `useCodeOfConductLock` med reminder-baseret trigger
- **Admin-side**: Skift mutation fra edge function-kald til insert i ny tabel
- **Verificering**: Quiz-pass-tærskel = 100% korrekt

### Forventet effekt
- Admin trykker "Send påmindelse" → alle berettigede ser popup næste gang de er i appen
- Brugeren kan udskyde én gang (max 24t)
- Efter udskydelsen udløber → fuld lås indtil testen er bestået
- Alle spørgsmål skal være korrekte; forkerte skal retages alene
