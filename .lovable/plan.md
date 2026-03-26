
## Hvad der faktisk er galt

Jeg kan nu se, at problemet ikke kun er cache.

Der er to konkrete årsager:

1. `powerdag` findes ikke i `team_dashboard_permissions` i databasen  
   - `useAccessibleDashboards()` bygger listen over dashboards ud fra den tabel
   - Resultat: Powerdag kommer slet ikke med i dashboard-oversigten/sidebaren/dropdown for alle ikke-ejere
   - Det forklarer godt, hvorfor både Oscar Belcher og William Bornak “ikke kan se det”

2. `menu_powerdag_input` findes ikke i `role_page_permissions` endnu  
   - Resultat: selv de roller der skal kunne redigere, kan ikke få edit-adgang stabilt via det nuværende permissionsystem

Jeg har også verificeret, at Oscar Belcher og William Bornak er aktive brugere, så det ser ikke ud til at være deres medarbejderkort der er problemet.

## Plan

### 1. Gør Powerdag til et globalt synligt dashboard
Opdater dashboard-konfigurationen, så Powerdag ikke afhænger af team-baseret dashboard-adgang for at blive vist.

**Filer**
- `src/config/dashboards.ts`
- `src/hooks/useTeamDashboardPermissions.ts`

**Ændring**
- Tilføj en eksplicit visibilitetsregel på dashboard-config, fx at Powerdag er synlig for alle autentificerede brugere med dashboard-adgang
- Opdater `useAccessibleDashboards()` så den inkluderer Powerdag uden opslag i `team_dashboard_permissions`

Det løser:
- dashboard-kortet på `/dashboards`
- venstremenuen
- dashboard-dropdowns

### 2. Behold redigering bag rolle-rettighed
Powerdag-forsiden skal være åben for alle relevante brugere, men input/admin skal stadig være låst bag `menu_powerdag_input`.

**Filer**
- `src/routes/config.tsx`
- `src/pages/dashboards/PowerdagBoard.tsx`

**Status**
- Den del ser i store træk rigtig ud allerede
- Jeg vil bevare:
  - `/dashboards/powerdag` som synlig side
  - `/dashboards/powerdag/input` og `/dashboards/powerdag/admin` som rollebeskyttede

### 3. Backfill rettigheder i databasen for edit-adgang
Opret de manglende permission-rækker for `menu_powerdag_input`, så edit faktisk virker for de ønskede roller.

**Backend**
- `role_page_permissions`

**Tildeles**
- `teamleder`
- `assisterendetm`
- `assisterende_teamleder_fm`
- `rekruttering`
- `some`
- `ejer`

**Ikke edit**
- `medarbejder`
- øvrige roller der kun skal kunne se forsiden

### 4. Sørg for at Powerdag ikke falder ud igen senere
Lave en lille robusthedsforbedring, så nye dashboards ikke kun bliver synlige, hvis en admin manuelt åbner dashboard-permissions-siden.

**Filer**
- `src/components/dashboard/DashboardPermissionsTab.tsx`
- evt. `src/hooks/useTeamDashboardPermissions.ts`

**Ændring**
- Enten:
  - vis globale dashboards som “ikke team-styrede” i admin-UI
- eller:
  - behold seeding til team-styrede dashboards, men lad globale dashboards bypass’e team-tabellen helt

### 5. Verifikation efter ændringen
Jeg vil teste disse flows:

1. Sælger:
   - kan se Powerdag i oversigten
   - kan åbne `/dashboards/powerdag`
   - kan ikke se “Indtast salg”

2. Oscar Belcher (rekruttering):
   - kan se Powerdag i oversigten
   - kan åbne boardet
   - kan se og bruge input-siden

3. William Bornak:
   - kan som minimum se Powerdag-forsiden i oversigten og åbne boardet

## Tekniske noter
- Den nuværende kode siger “alle kan se boardet”, men navigationen styres stadig af `useAccessibleDashboards()`
- Derfor hjælper route-ændringen alene ikke, når `powerdag` mangler i `team_dashboard_permissions`
- Root cause er altså primært navigation/access-listen — ikke selve Powerdag-komponenten

## Resultat når dette er implementeret
- Powerdag bliver synlig for alle relevante brugere
- Kun leder-/specialroller kan rette
- Problemet bliver løst både i direkte adgang og i dashboard-oversigten
- Fremtidige dashboards bliver mindre sårbare over for samme fejl
