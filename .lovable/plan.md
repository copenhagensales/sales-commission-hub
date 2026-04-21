

## Hvorfor Jacob ikke ser dashboard-knappen

### Faktatjek for Jacob (fra DB lige nu)

- **Bruger:** Jacob Lykke Nielson, position `Salgskonsulent`, `system_role_key = medarbejder`, aktiv, har `auth_user_id` ✅
- **Team:** Medlem af **Relatel** (ikke leader, ikke assistent)
- **Rolle-permissions:** `medarbejder` har `can_view: true` på 8 dashboards (commission-league, cs-top-20, eesy-tm, fieldmarketing, powerdag, relatel, tdc-erhverv, united) + `menu_dashboards: true`
- **Team-permissions for Relatel:** `cs-top-20: all` + `relatel: all` → Jacob får adgang som menigt medlem til DISSE to uanset rolle
- Plus 5 `team_leader`/`leadership`-permissions han IKKE rammes af (han er menigt medlem)

**På papiret skal Jacobs `accessibleDashboards.length` være mindst 8 (rolle) — eller 2 (team-fallback alene). Knappen burde være der.**

### Hvorfor knappen alligevel kan mangle

`EnvironmentSwitcher` rendres KUN hvis både `canAccessDashboards && canAccessMainSystem` er sande (`EnvironmentSwitcher.tsx` linje 17-19). `canAccessDashboards = accessibleDashboards.length > 0` (`AppModeContext.tsx` linje 28). Hvis `useAccessibleDashboards` returnerer en tom liste én gang, gemmer den 0 i 30 sekunders cache → ingen knap.

To race conditions kan give tom liste for Jacob:

**1. `rolePermissions` undefined ved første kald**  
`useAccessibleDashboards` (linje 233) bruger `rolePermissions` fra `usePagePermissions()` til rolle-fallback, men:
- `rolePermissions` er IKKE i `queryKey` (linje 172)
- `rolePermissions` er IKKE i `enabled` (linje 276 har kun `!!user && isReady`)

Hvis `usePagePermissions` (paginerer via `fetchAllRows`) ikke er færdig når `useAccessibleDashboards` kører første gang, springes rolle-checket over → Jacob er afhængig af team-permissions alene.

**2. `team_dashboard_permissions`-query returnerer tom**  
Samme query (linje 216-218) henter ALLE team-permissions uden filtre — hvis den første gang får 0 rækker (RLS, netværk, race), falder Jacob til 0 dashboards.

Resultat caches i 30 sek → Jacob ser intet, refresher, ser intet, frustration.

**3. Jacobs rolle resolver ikke til `medarbejder`** (mindre sandsynligt)  
Hvis `useUnifiedPermissions().role` ikke kan resolve fra `position_id → job_positions.system_role_key` ved race, sammenligningen `p.role_key === role` fejler stille på linje 235 selv når `rolePermissions` ER loaded.

### Fix

**A. Gør `useAccessibleDashboards` race-safe (kerneårsag)**  
I `src/hooks/useTeamDashboardPermissions.ts`:
- Tilføj `rolePermissions` og `role` til `enabled`: `!!user && isReady && !!rolePermissions && !!role`
- Tilføj dem til `queryKey`: `["accessible-dashboards", user?.id, isOwner, role, rolePermissions?.length]`
- Cast tom liste til "vent endnu" i stedet for at cache 0 i 30 sek: drop `staleTime` til 0 mens `rolePermissions` lige er ankommet, eller invalider når de skifter

**B. Fjern hard-cache når listen er tom**  
Hvis `accessibleDashboards` returnerer `[]`, sæt `staleTime: 0` (kun ved tom liste) så vi ikke fastholder 0 i 30 sek mens permissions ankommer.

**C. Diagnostisk console.log**  
Log `[useAccessibleDashboards] role=X, rolePermissions=N, teamPerms=M, accessible=K` så vi fremover kan se for konkrete brugere hvor det går galt.

**D. (Valgfri) Fallback-knap**  
Hvis brugeren har `menu_dashboards: true` på rolle-niveau (Jacob HAR det), vis `EnvironmentSwitcher` selv hvis `accessibleDashboards.length === 0` ved første render — landingen `/dashboards` viser så en tom liste i stedet for at knappen forsvinder helt. Det er mere brugervenligt end "knappen er væk".

### Filer
- `src/hooks/useTeamDashboardPermissions.ts` — fix race + log
- (Valgfri) `src/components/layout/EnvironmentSwitcher.tsx` eller `AppModeContext.tsx` — gate knap på `menu_dashboards`-rolle-permission i stedet for kun `accessibleDashboards.length > 0`

### Verificering
- Jacob refresher `/home` 5+ gange → knap vises konsistent
- Console for Jacob: `role=medarbejder, rolePermissions=~120, accessible=8+`
- Klik knap → lander på `/dashboards` med 8+ kort

### Hvad jeg IKKE rør
- Database-permissions (Jacobs adgang er korrekt på papir)
- RLS, role_page_permissions
- AppSidebar (ingen ny "Dashboards"-menu — kun race-fix)

