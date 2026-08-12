# Fix: ingen medarbejdere vises under "Alle medarbejdere" / "Personale"

## Symptom
Alle kald til `employee_master_data` fejler med HTTP 500:
`42P17: infinite recursion detected in policy for relation "employee_master_data"`.
Derfor er listerne tomme — det er ikke manglende rettigheder, men en databasefejl.

## Rod-årsag (verificeret)
Politikken `Employees can view active colleagues` (tilføjet i sidste sikkerhedsrunde) lyder:

```text
is_active = true AND EXISTS (
  SELECT 1 FROM employee_master_data me
  WHERE me.auth_user_id = auth.uid() AND me.is_active = true
)
```

Subqueryen læser samme tabel som politikken beskytter → Postgres evaluerer politikken rekursivt og afviser hele forespørgslen. Alle SELECT på tabellen fejler, uanset rolle (også ejer), fordi én fejlende politik nedlægger hele queryen.

## Løsning
Erstat den selv-refererende subquery med et `SECURITY DEFINER`-opslag, som er det mønster resten af Stork bruger (`can_view_employee`, `is_owner`, `get_employee_id_for_user`).

1. Ny funktion `public.is_active_employee(_user_id uuid)` — `SECURITY DEFINER`, `STABLE`, `set search_path = public`. Returnerer true hvis der findes en aktiv række i `employee_master_data` med `auth_user_id = _user_id` eller med matchende `private_email`/`work_email` fra JWT-mailen (samme fallback som `findEmployeeByAuth` i frontend).
2. `EXECUTE` gives kun til `authenticated` (ikke `anon`), i tråd med sidste rundes revokering.
3. Drop og genopret politikken `Employees can view active colleagues` som:
   `is_active = true AND public.is_active_employee(auth.uid())`.

Sikkerhedsniveauet er uændret: kun aktive, indloggede medarbejdere kan se aktive kollegaers rækker — præcis den intention den nuværende politik havde.

## Verifikation efter migration
- Kør en SELECT mod `employee_master_data` og bekræft 0 fejl og forventet rækkeantal.
- Kontrollér at headcount-tallene fortsat er 94 aktive ekskl. stab / 15 kommende / 16 stab.
- Bekræft i preview at "Alle medarbejdere", "Personale" og login-flowet (`must_change_password`) igen svarer 200.

## Zone
Rød zone (persondata + RLS på `employee_master_data`). Kun én migration, ingen frontend-ændringer, ingen kolonne- eller datamodelændringer.
