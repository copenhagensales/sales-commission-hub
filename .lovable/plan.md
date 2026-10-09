# Ny fane: Rapporter → "Eesy TM afstemning" (tom skal)

## Hvad der bygges
- Et nyt menupunkt "Eesy TM afstemning" under Rapporter. Det fører til en ny, tom side med overskrift og teksten "Indhold kommer snart". Indholdet promptes bagefter.
- Kun ejere samt teamledere og assisterende teamledere på Eesy TM-teamet kan se menupunktet og åbne siden. Andre, også teamledere på andre teams, ser intet. Hvis de skriver adressen direkte, får de "ingen adgang".

## Adgang (antagelse, ret mig hvis forkert)
- "Teamleder på Eesy TM" betyder: personen er teamleder, assisterende teamleder eller med-assistent på et team, der ejer kunden Eesy TM. Det er den samme regel som Opstart-siden bruger.
- Superadmin og ejer har altid adgang. Ingen ekstra personer (fx Karl Koppel) får adgang, medmindre du beder om det.

## Teknisk
- `permissionKeys.ts`: ny nøgle `menu_reports_eesy_tm_reconciliation` (label "Eesy TM afstemning", parent `menu_section_reports`). Rød zone, men en ren tilføjelse, og ingen eksisterende nøgler ændres.
- Migration: ny SECURITY DEFINER-funktion `can_view_eesy_tm_reconciliation()` (superadmin/ejer, eller leder/assistent på et team via `team_clients` → Eesy TM-kunden). Den slår kunden op på navn eller id, der læses én gang. Kun EXECUTE til authenticated.
- Hook `useCanViewEesyTmReconciliation` (React Query, kalder RPC'en).
- Ny side `src/pages/reports/EesyTmReconciliation.tsx` (MainLayout + tom tilstand). Route `/reports/eesy-tm-afstemning` i `routes/config.tsx` (protected). Siden viser kun indhold, når hooken returnerer true.
- `AppSidebar.tsx`: menupunktet vises, når hooken returnerer true. Rettighederne følger altså teamet, ikke en generel rolle. Ingen ændringer i `role_page_permissions`.
- Der læses ingen data og laves ingen beregninger endnu.
