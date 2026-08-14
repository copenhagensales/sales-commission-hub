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

## Beslutning der skal tages

Vælg hvordan aktivering skal opføre sig:

**A. Bevar altid eksisterende startdato**
Aktivering sætter kun `is_active = true` og rydder slutdato. Startdato sættes kun hvis feltet er tomt (da falder den tilbage til i dag).
Fordel: fremtidige opstarter bevares automatisk. Risiko: en genansat beholder sin gamle startdato, medmindre man selv retter den.

**B. Spørg ved aktivering**
Aktivering åbner en lille dialog: "Startdato for ansættelsen?" med i dag som forudfyldt værdi.
Fordel: eksplicit og korrekt både ved nyansættelse og genansættelse. Ulempe: et ekstra klik hver gang.

**C. Bevar fremtidig dato, overskriv fortidig**
Er den gemte startdato i fremtiden, bevares den. Er den i fortiden eller tom, sættes i dag (genansættelse).
Fordel: ingen ekstra klik, løser den konkrete fejl. Ulempe: implicit regel man skal kende.

Uanset valg bør de fire hardkodede steder samles i én delt hjælpefunktion, så listen, stab-listen og medarbejderkortet ikke kan drifte fra hinanden (Bibel §8 — én sandhed).

## Zone
`employment_start_date` bruges af løn-, timer- og forecast-beregninger. Ændringen er derfor gul/rød zone og kræver din godkendelse af den valgte model, før noget implementeres. Denne plan er kun information — ingen kodeændringer er lavet.
