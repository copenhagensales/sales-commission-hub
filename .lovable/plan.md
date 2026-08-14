# Hvorfor startdato bliver "i dag" når en medarbejder aktiveres

## Kort svar
Startdatoen bliver ikke overskrevet af registreringslinket, men af **aktiverings-switchen**. Tre steder i UI'et er det hardkodet, at "aktiv = true" altid sætter `employment_start_date = i dag` og nulstiller slutdatoen — uanset hvad der står i feltet Startdato.

## Hvad er hardkodet (evidens)

1. `src/pages/EmployeeMasterData.tsx:457-459` (medarbejderlisten)
   `const today = new Date().toISOString().split("T")[0]` →
   `is_active ? { is_active, employment_start_date: today, employment_end_date: null } : ...`

2. `src/components/employees/StaffEmployeesTab.tsx:167-170` (stab-listen)
   Præcis samme logik, egen kopi.

3. `src/pages/EmployeeDetail.tsx:444-451` (medarbejderkortet)
   `handleSave("is_active", true)` → `update({ is_active: true, employment_start_date: today, employment_end_date: null })`

4. `src/pages/EmployeeMasterData.tsx:565-571` (opret bruger med adgangskode)
   Efter oprettelse sættes `employment_start_date` altid til dagens dato — feltet spørges ikke.

## Hvad der IKKE sætter startdato
- `supabase/functions/send-employee-invitation` rører hverken `is_active` eller `employment_start_date`.
- `supabase/functions/complete-employee-registration` sætter kun `auth_user_id`, `invitation_status`, `onboarding_data_complete` — ikke datoer.
- `EmployeeFormDialog` (redigér-dialogen) gemmer den dato Oscar selv skriver, uden overskrivning (`:510-511`).
- Kandidat/hold-flowet bruger holdets startdato (`src/lib/cohortMemberProcessing.ts:63`).

## Konsekvensen i praksis
Oscar udfylder Startdato = næste mandag i dialogen → gemmes korrekt. Bagefter slår han medarbejderen aktiv via switchen i listen eller på medarbejderkortet → koden overskriver datoen med i dag. Derfor forsvinder den fremtidige startdato, og medarbejderen tælles som "på teamet nu" i stedet for "starter senere".

## Valgt løsning (B med hold-dato som udgangspunkt)

Når en medarbejder aktiveres, åbnes en lille dialog "Startdato for ansættelsen?" med datoen forudfyldt:

1. Startdatoen fra det opstartshold medarbejderen er tilknyttet under Kommende opstarter (`onboarding_cohorts.start_date` via `cohort_members.employee_id`).
2. Ellers den startdato der allerede står på medarbejderen.
3. Ellers dagens dato.

Under datofeltet vises en note, når datoen kommer fra et hold, fx:
"Datoen kommer fra opstartsholdet «Hold 18. august» under Kommende opstarter."

Datoen kan rettes manuelt i dialogen. Bekræft → `is_active = true`, `employment_start_date` = valgt dato, `employment_end_date` ryddes. Annullér → ingen ændring.

## Teknisk
- Ny fælles komponent + hjælpefunktion (fx `src/components/employees/ActivateEmployeeDialog.tsx` og `src/lib/employees/activateEmployee.ts`), så al aktiveringslogik ligger ét sted.
- De fire hardkodede steder erstattes af den fælles løsning:
  - `src/pages/EmployeeMasterData.tsx:457-459` (medarbejderlisten)
  - `src/components/employees/StaffEmployeesTab.tsx:167-170` (stab-listen)
  - `src/pages/EmployeeDetail.tsx:444-451` (medarbejderkortet)
  - `src/pages/EmployeeMasterData.tsx:565-571` (opret bruger med adgangskode — forudfyldes på samme måde)
- Hold-datoen hentes via `cohort_members` → `onboarding_cohorts.start_date` (nyeste hold hvis flere).
- Deaktivering ændres ikke: slutdato = i dag, notifikationer som i dag.


## Zone
`employment_start_date` bruges af løn-, timer- og forecast-beregninger. Ændringen er derfor gul/rød zone og kræver din godkendelse af den valgte model, før noget implementeres. Denne plan er kun information — ingen kodeændringer er lavet.
