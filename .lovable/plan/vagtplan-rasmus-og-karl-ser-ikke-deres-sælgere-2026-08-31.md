# Vagtplan: Rasmus og Karl ser ikke deres sælgere

## Status på undersøgelsen

Databasesiden er gennemgået og ser korrekt ud for begge. Det betyder, at årsagen med stor sandsynlighed ligger i frontend-flowet (klientkald/hook), ikke i rettigheder. Det er **ikke** verificeret endnu, og første skridt i planen er derfor en reproduktion med deres egen session — ikke et gæt.

Bekræftet ved direkte forespørgsler:

- Karl Koppel (leder Relatel, 11 aktive medlemmer) og Rasmus Emil Hansen (leder TDC Erhverv, 12 aktive medlemmer) er aktive, har `job_title = Teamleder`, har `auth_user_id` sat, og deres login-mail matcher præcis én medarbejderrække hver.
- `teams.team_leader_id` peger direkte på dem, så de rammer "led teams"-grenen i `useEmployeesForShifts`.
- Rollen `teamleder` har `menu_absence` og `menu_shift_overview` med view+edit og `visibility = team` i `role_page_permissions`, og `menu_employees = team`, som er det `get_user_manager_scope` læser.
- `can_view_employee` giver adgang ved scope `team`, når medarbejderen er medlem af et team, hvor brugeren er `team_leader_id`. Alle kolonner funktionen bruger findes.
- RLS på `absence_request_v2` tillader teamledere at oprette/rette fravær for medarbejdere de kan se; `employee_absence` tillader `is_vagt_admin_or_planner`, som dækker `Teamleder`; `shift` tillader `is_manager_or_above`.
- Alle relevante funktioner (`is_owner`, `get_current_employee_id`, `can_view_employee`, `get_user_manager_scope`) har EXECUTE til `authenticated`.

## Plan

### 1. Reproducér med Rasmus' og Karls egen session (før noget ændres)

Log ind i preview som hver af de to via en mintet session og åbn Vagtoversigt og Fraværshåndtering. Log præcist:

- hvad `is_owner` og `get_current_employee_id` returnerer for dem
- hvor mange team-medlemmer hooket finder
- eventuelle PostgREST-fejl (403/400) fra `employee_master_data`, `team_members`, `teams`, `team_assistant_leaders`, `employee_salary_details`, `absence_request_v2`

Det afgør, om fejlen er: tom liste (datafiltrering), fejlende kald (rettigheder på et enkelt kald), eller manglende knap (UI-gating).

### 2. Fjern den fejlkilde vi kan se i koden uanset udfald

`fetchEmployeesByIds` og lønberigelsen kaster ved fejl, hvilket får hele medarbejderlisten til at blive tom, selv når kun løndata er utilgængelige. Efter superadmin-beskyttelsen af løndata er det et realistisk scenarie for en teamleder. Løsningen er, at manglende løndata giver `null` i lønfeltet i stedet for at vælte listen, og at hooket viser en tydelig fejl i UI'et hvis medarbejderkaldet selv fejler.

### 3. Ret det, reproduktionen peger på

Fix laves først når trin 1 har givet konkret evidens. Ingen ændring af rettighedsmodellen uden at fejlen er set.

### 4. Ryd op i debug-logning

`useEmployeesForShifts` skriver i dag bruger-id, ejerstatus, medarbejder-id og ledede teams til browserkonsollen. De fjernes som del af leverancen.

### 5. Kendt sidegevinst at afklare (ikke en del af fixet uden godkendelse)

`can_view_employee` kigger kun på `teams.team_leader_id` og `teams.assistant_team_leader_id` — ikke på junction-tabellen `team_assistant_leaders`. Assisterende teamledere, der kun står i junction-tabellen, kan derfor blive afvist af RLS, selvom frontend viser dem teamet. Det rammer ikke Rasmus og Karl, men bør besluttes særskilt.

## Teknisk resume

- Berørte filer: `src/hooks/useShiftPlanning.ts` (hook + logning), `src/lib/salary/salaryDetails.ts` (kun hvis lønopslag skal gøres endnu mere fejltolerant).
- Ingen ændringer i lønberegning, ingen migrationer i trin 1-4.
- Verifikation: gentag trin 1 efter fixet og bekræft, at begge ser deres respektive 11 og 12 sælgere og kan oprette fravær.
