# Adgang til månedsmål-boards for teamledelsen

## Hvad der er fundet (bekræftet)

- Boardet "Relatel Månedsmål" findes og virker (`src/config/dashboards.ts:49-55`, rute `/dashboards/relatel-monthly-goal`).
- Synlighed styres af `useAccessibleDashboards` (`src/hooks/useTeamDashboardPermissions.ts:166-283`): ejere ser alt; alle andre kræver enten en rolle-rettighed på `permissionKey` eller en række i `team_dashboard_permissions` for et af deres teams.
- Databasetjek: der findes **ingen** rækker i `role_page_permissions` for `menu_dashboard_relatel_monthly_goal` eller `menu_dashboard_tdc_monthly_goal`, og **ingen** rækker i `team_dashboard_permissions` for `relatel-monthly-goal` på Karls teams.
- Karl Koppel (`kk@cph-sales.dk`, aktiv, rolle `teamleder`) er teamleder på team **Relatel**.

Konklusion: de to månedsmål-boards er aldrig blevet tildelt nogen. Kun ejere kan se dem i dag. Det er derfor Karl ikke kan se boardet — ikke en fejl i selve boardet.

## Hvad der ændres

Ren datatildeling (ingen kode, ingen skemaændring, ingen ændring i rettighedssystemet):

- Team **Relatel** får adgangsniveau **Ledelse (TL + ATL)** til `relatel-monthly-goal`.
- Team **TDC Erhverv** får adgangsniveau **Ledelse (TL + ATL)** til `tdc-monthly-goal`.

Det betyder: teamleder og assisterende teamledere på de to teams får boardet i menuen under Boards. Sælgere får det ikke.

## Teknisk

- `run_sql`-upsert af to rækker i `team_dashboard_permissions` (`team_id`, `dashboard_slug`, `access_level = 'leadership'`), med `ON CONFLICT (team_id, dashboard_slug)` så eksisterende rækker blot opdateres.
  - Relatel: `f4210d48-5062-4e3a-b945-7ff1d5a874dd` → `relatel-monthly-goal`
  - TDC Erhverv: `ee967dfd-04c8-465e-bda7-f1c47094bae0` → `tdc-monthly-goal`
- Ingen andre boards, teams eller roller berøres.
- Verifikation: læs rækkerne tilbage og bekræft, at Karl er teamleder på Relatel (allerede bekræftet), så `leadership`-grenen i `useAccessibleDashboards` rammer.
- Karl skal genindlæse siden (cache er 30 sek.) før boardet vises.
