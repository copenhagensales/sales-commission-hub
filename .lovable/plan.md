

## Problem: To parallelle rettighedssystemer for dashboards

Der er to uafhængige systemer der styrer dashboard-adgang:

1. **Rolle-baseret** (Permission Map / `role_page_permissions`): Styrer om en rute kan tilgås — det er her du har givet "Rekruttering" adgang
2. **Team-baseret** (`team_dashboard_permissions`): Styrer om dashboardet vises i sidebar og dashboard-oversigten — her har Rekrutterings teams **ikke** fået adgang

Når Oscar Belcher (Rekruttering) logger ind, tjekker sidebar og dashboardlisten kun det team-baserede system. Selv om hans rolle har fået grøn dot i Permission Map, vises dashboardet aldrig fordi hans teams ikke har `team_dashboard_permissions`-adgang.

### Løsning: Flet de to systemer i `useAccessibleDashboards`

Udvid `useAccessibleDashboards` så den også tjekker rolle-baserede rettigheder. Hvis brugerens rolle har `can_view: true` for et dashboards `permissionKey`, skal dashboardet vises — uanset team-indstillinger.

### Ændring

**Fil: `src/hooks/useTeamDashboardPermissions.ts`** — `useAccessibleDashboards`

1. Importer `usePagePermissions` fra `useUnifiedPermissions`
2. Hent brugerens rolle og tilhørende `role_page_permissions`
3. I filtreringslogikken: tilføj et ekstra tjek — hvis brugerens rolle har `can_view: true` for dashboardets `permissionKey`, returner `true` (dashboard er synligt)
4. Det eksisterende team-baserede tjek bevares som fallback

```text
Nuværende logik:
  globalAccess? → ja
  team_dashboard_permissions match? → ja
  ellers → nej

Ny logik:
  globalAccess? → ja
  role_page_permissions has can_view for permissionKey? → ja
  team_dashboard_permissions match? → ja
  ellers → nej
```

### Berørte filer
- `src/hooks/useTeamDashboardPermissions.ts` — tilføj rolle-tjek i `useAccessibleDashboards`

### Risiko
**Lav** — tilføjer kun en ekstra adgangsvej; eksisterende team-baseret logik forbliver uændret.

