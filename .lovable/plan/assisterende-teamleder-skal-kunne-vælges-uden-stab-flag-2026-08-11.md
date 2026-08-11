# Assisterende teamleder skal kunne vælges uden Stab-flag

## Hvad der er galt

Sebastian Viktor Bangsbo Petersen har allerede den rigtige stilling (`job_title = "Assisterende Teamleder TM"`, aktiv), men han står ikke som stab (`is_staff_employee = false`) og har intet team.

Begge dropdowns i "Rediger team" — både **Teamleder** og **Ass. Teamledere** — henter kun medarbejdere med stab-flag (`TeamsTab.tsx:92-105`, filter `is_staff_employee = true`). Derfor dukker han ikke op. Hjælpeteksten "Kun backoffice medarbejdere vises her" er reelt "kun stab-medarbejdere".

## Løsning

Udvid udvalget for **Ass. Teamledere** til også at omfatte aktive medarbejdere med lederstilling, uanset stab-flag:

- Stillinger der kvalificerer: Teamleder, Assisterende Teamleder TM, Assisterende Teamleder FM, Fieldmarketing leder, Ejer — plus alle stab-medarbejdere som i dag.
- Samme udvidelse for **Teamleder**-dropdownen, så billedet er konsistent.
- Opdatér hjælpeteksten til "Stab og medarbejdere med lederstilling vises her".

Ingen ændring i databasen, ingen ændring i rettigheder, ingen ændring af stab-flaget. Assisterende-koblingen (`team_assistant_leaders`) er ikke bundet af ét-team-reglen, så han kan sættes på Eesy TM uden at hans egen teamtilknytning ændres.

## Teknisk

- `src/components/employees/TeamsTab.tsx`: query `staff-employees-for-teams` ændres fra `.eq("is_staff_employee", true)` til `.or("is_staff_employee.eq.true,job_title.in.(...)")` og sorteres på fornavn. Query-key bumpes så cachen ikke rammer forkert.
- Titel-listen lægges i en konstant i samme fil (ingen ny hardkodning af rolle-keys — der bruges stillingsnavne, som allerede er UI-niveau).
- Zone: gul (team-management). Ingen løn-, pricing- eller RLS-berøring.

## Bagefter

Du sætter ham på under Medarbejdere → Teams → Eesy TM → Redigér → Ass. Teamledere → Gem.
