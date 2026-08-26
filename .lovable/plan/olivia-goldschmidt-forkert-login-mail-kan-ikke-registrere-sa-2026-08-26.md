# Olivia Goldschmidt: forkert login-mail + kan ikke registrere salg

## Verificeret årsag

Ja — det er samme årsag.

- Auth-brugeren (oprettet 25. aug, senest logget ind i dag) har mailen `oliviagoldschmidt@gmail.com`.
- Hendes medarbejderkort (`employee_master_data`, id `29b7a229…`) har `private_email = oliviaskiligoldschmidt@gmail.com` og `work_email = olgo@copenhagensales.dk`. Ingen af dem matcher login-mailen.
- `src/pages/vagt-flow/SalesRegistration.tsx:69-81` slår medarbejderen op **kun på mail** (`private_email.ilike / work_email.ilike`). Uden match bliver `currentEmployee = null`, og dagens vagt-tilknytning + registrering (linje 104, 201) kan ikke laves.
- Kortet har korrekt `auth_user_id = 6678b2cf…` (samme som auth-brugeren), så koblingen findes — den bruges blot ikke i denne side.

## Løsning i to trin

1. **Data-rettelse (fjerner problemet nu):** ret auth-brugerens mail fra `oliviagoldschmidt@gmail.com` til hendes rigtige private mail `oliviaskiligoldschmidt@gmail.com`, så login og medarbejderkort stemmer. Hun logger derefter ind med den mail (samme kodeord).
2. **Robusthed (fjerner fejlklassen):** lad `SalesRegistration.tsx` bruge den eksisterende fælles hjælper `findEmployeeByAuth` (`src/lib/employeeLookup.ts`), som først slår op på `auth_user_id` og kun falder tilbage til mail. Så bryder salgsregistrering ikke igen ved mail-uoverensstemmelse.

Ingen ændring i pricing, provision, løn eller RLS. Historiske data berøres ikke.

## Teknisk

- Trin 1: opdatering af én auth-brugers e-mail (rød zone: persondata — kun dette ene felt, ingen sletning). Alternativt kan vi i stedet tilføje login-mailen på medarbejderkortet, hvis I foretrækker at bevare login-mailen — men da den ifølge dig er forkert, retter vi auth-mailen.
- Trin 2: én fil, `src/pages/vagt-flow/SalesRegistration.tsx` — erstat det direkte `employee_master_data`-mail-opslag med `findEmployeeByAuth(user, "id, first_name, last_name, work_email", { activeOnly: true })`. Query-key udvides med `user?.id`. Ingen ændring i selve indsend-logikken (`useFieldmarketingSales`), hvor `agent_email` fortsat sættes fra `work_email`.
- Efter trin 1 bør vi kontrollere, om hun har forsøgt registreringer der ikke blev gemt (ingen fundet endnu — verificeres før/efter).
