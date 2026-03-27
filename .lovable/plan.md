

## Powerdag: Separat visnings- og redigeringsrettighed

### Nuværende tilstand
- `menu_dashboard_powerdag` findes som permission key, men dashboardet har `globalAccess: true` — så **alle** kan se det uanset rettigheder
- Ruten `/dashboards/powerdag` er kun `access: "protected"` (kræver login, men ingen specifik rettighed)
- `menu_powerdag_input` eksisterer allerede og bruges til at vise/skjule redigerings-knapperne + beskytte `/input` og `/admin` ruterne

### Ændringer

**1. Fjern globalAccess fra Powerdag** (`src/config/dashboards.ts`)
- Sæt `globalAccess: false` (eller fjern feltet) på powerdag-dashboardet, så det styres af `menu_dashboard_powerdag` rettigheden ligesom de andre dashboards

**2. Tilføj rettighedscheck på ruten** (`src/routes/config.tsx`)
- Ændr powerdag-ruten fra `access: "protected"` til `access: "role", positionPermission: "menu_dashboard_powerdag"` — så kun brugere med visningsrettighed kan tilgå siden

**3. Opdater rettighedskortet: Dashboards-specifik logik** (`src/components/employees/permissions/PermissionMap.tsx`)
- `menu_dashboard_powerdag` bruger allerede det forenklede 2-niveau system (Fuld/Ingen) fra sidste ændring — det passer fint til "kan se dashboardet"
- `menu_powerdag_input` bevarer også 2 niveauer — "kan redigere point og taste salg"

### Resultat
- **Visning**: Kræver `menu_dashboard_powerdag` rettighed — uden den ser man ikke dashboardet i menuen og kan ikke tilgå det
- **Redigering**: Kræver derudover `menu_powerdag_input` — giver adgang til at taste salg, rette point/salg-værdier, og admin-siden
- Begge rettigheder kan tildeles per rolle via rettighedskortet

### Risiko
**Lav** — fjerner kun `globalAccess` og tilføjer et rettighedscheck der allerede bruges af andre dashboards.

