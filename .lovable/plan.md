
# Plan: Forbedret Dashboard-Rettighedsstyring

## Problemanalyse

Der er **to separate systemer** til at styre dashboard-adgang, som skaber forvirring:

| System | Placering | Hvad det styrer |
|--------|-----------|-----------------|
| **Permission Editor** | `/employees?tab=permissions` | Generel adgang til dashboard-sektionen (`menu_dashboards`, `menu_dashboard_admin`) |
| **Team Dashboard Permissions** | `/dashboards/settings` → Rettigheder | Specifikke dashboards per team (cph-sales, eesy-tm, etc.) |

### Hvorfor medarbejdere ikke ser Dashboard-knappen
Knappen "Dashboards" i sidebaren (via `EnvironmentSwitcher`) vises kun hvis brugeren har adgang til mindst ét dashboard. Dette afgøres af:

1. Brugerens **team-medlemskab** (via `team_members` tabel)
2. **Team Dashboard Permissions** hvor det pågældende team har `access_level = 'all'`

**Hvis medarbejderen ikke er medlem af et team med dashboard-adgang, ser de ikke knappen.**

---

## Løsning: Integrer Dashboard-Vælger i Permission Editor

### Arkitektur-ændring
Tilføj en ny komponent `DashboardRolePermissionsEditor` til Permission Editor, der viser:
- Liste over alle 9 dashboards fra `DASHBOARD_LIST`
- Checkboxes for hvert dashboard per rolle
- Gemmer som rolle-baseret config i en ny tabel

### Database-ændring
Ny tabel: `role_dashboard_permissions`

```text
┌─────────────────────────────────────────────────┐
│              role_dashboard_permissions          │
├─────────────────────────────────────────────────┤
│ id             UUID (PK)                        │
│ role_key       TEXT (FK → role_definitions)    │
│ dashboard_slug TEXT                             │
│ can_view       BOOLEAN                          │
│ created_at     TIMESTAMPTZ                      │
│ updated_at     TIMESTAMPTZ                      │
└─────────────────────────────────────────────────┘
```

### Ændret Adgangslogik
1. Behold eksisterende team-baseret system i `/dashboards/settings`
2. Tilføj rolle-baseret adgang som **supplement**
3. En bruger har adgang til et dashboard hvis:
   - **ENTEN** deres team har adgang (team_dashboard_permissions)
   - **ELLER** deres rolle har adgang (role_dashboard_permissions)

---

## Implementeringsplan

### Trin 1: Database
- Opret `role_dashboard_permissions` tabel
- Seed default permissions for alle roller (alle dashboards = false undtagen ejer)

### Trin 2: Backend Hook
- Opret `useRoleDashboardPermissions` hook
- Udvid `useAccessibleDashboards` til at inkludere rolle-baserede dashboards

### Trin 3: Permission Editor UI
- Tilføj ny sektion "Dashboard Adgang" i `PermissionsTab.tsx`
- Vis alle 9 dashboards med checkboxes per rolle
- Tillad multi-select (vælg dashboard 1, 2, 4 som ønsket)

### Trin 4: Test
- Verificer at medarbejdere nu ser Dashboard-knappen
- Verificer at de kun ser de specifikke dashboards de har adgang til

---

## Filer der ændres

| Fil | Ændring |
|-----|---------|
| `supabase/migrations/` | Ny tabel `role_dashboard_permissions` |
| `src/hooks/useRoleDashboardPermissions.ts` | Nyt hook til rolle-dashboard permissions |
| `src/hooks/useTeamDashboardPermissions.ts` | Udvid `useAccessibleDashboards` |
| `src/components/employees/PermissionsTab.tsx` | Tilføj dashboard-vælger UI |
| `src/components/employees/permissions/RoleDashboardEditor.tsx` | Ny komponent med dashboard checkboxes |

---

## UI-skitse: Dashboard-vælger i Permission Editor

```text
┌─────────────────────────────────────────────────────────────┐
│ Dashboards                                                   │
│ Vælg hvilke dashboards denne rolle har adgang til           │
├─────────────────────────────────────────────────────────────┤
│ ☑ CPH Sales              ☐ Fieldmarketing     ☑ Eesy TM     │
│ ☑ TDC Erhverv            ☐ Relatel            ☐ MG Test     │
│ ☐ United                 ☐ Test Dashboard     ☐ CS Top 20   │
└─────────────────────────────────────────────────────────────┘
```

---

## Tekniske Detaljer

### Ny tabel RLS
```sql
CREATE POLICY "Owners can manage role dashboard permissions"
  ON role_dashboard_permissions
  USING (public.is_owner());
```

### Udvidet useAccessibleDashboards
```typescript
// Eksisterende team-baseret logik...
const teamDashboards = // ...existing code...

// NY: Rolle-baseret logik
const { data: rolePerms } = await supabase
  .from("role_dashboard_permissions")
  .select("dashboard_slug")
  .eq("role_key", userRole)
  .eq("can_view", true);

const roleDashboards = DASHBOARD_LIST.filter(d => 
  rolePerms?.some(p => p.dashboard_slug === d.slug)
);

// Kombiner begge
return [...new Set([...teamDashboards, ...roleDashboards])];
```

### Forventet Resultat
- Administratorer kan vælge specifikke dashboards per rolle direkte i Permission Editor
- Medarbejdere ser Dashboard-knappen når de har mindst ét dashboard
- Både team-baseret OG rolle-baseret adgang fungerer side om side
