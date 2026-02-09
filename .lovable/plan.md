

# Plan: Dashboard-adgang for Medarbejdere - Komplet Fix

## Problemanalyse

### Identificerede Problemer

| Problem | Årsag | Konsekvens |
|---------|-------|------------|
| **Medarbejdere kan ikke se dashboards** | Dashboard-routes bruger slettede permission keys (f.eks. `menu_dashboard_eesy_tm`) | Selv når team-rettigheder er sat til 'all', blokerer rute-beskyttelsen adgang |
| **Kan ikke vælge hvilke dashboards** | DashboardSettings siden kræver `menu_dashboard_settings` - som er slettet | Administratorer (undtagen ejer-hardcode) kan ikke tilgå rettighedssiden |
| **Inkonsistens mellem systemer** | Team-baseret adgang (`team_dashboard_permissions`) er implementeret, men routes bruger stadig rolle-baseret (`positionPermission`) | De to systemer modarbejder hinanden |

### Oscar Belcher's Situation

```text
Oscar Belcher (Rekruttering)
├── Team: Stab
├── team_dashboard_permissions:
│   └── cs-top-20 = 'all' ✓ (burde have adgang)
│
└── PROBLEM: Route /dashboards/cs-top-20 
    ├── positionPermission: "menu_dashboard_cs_top_20"
    └── Denne key eksisterer IKKE i databasen ❌
```

---

## Løsning: Skift til Team-baseret Routing

### Arkitektur-ændring

```text
NUVÆRENDE (BRUDT):
┌─────────────────────────────────────────────────────────────────┐
│ routes/config.tsx                                               │
│ ├── positionPermission: "menu_dashboard_*" ❌ (slettet)         │
│ └── Blokerer adgang selvom team-permission er sat              │
└─────────────────────────────────────────────────────────────────┘

NY ARKITEKTUR:
┌─────────────────────────────────────────────────────────────────┐
│ Dashboard Routes                                                │
│ ├── access: "protected" (kun kræver login)                     │
│ └── Runtime-check i komponenten via useCanViewDashboard()      │
│                                                                 │
│ useCanViewDashboard(slug):                                     │
│ ├── Ejer? → altid true                                         │
│ └── Check team_dashboard_permissions via useAccessibleDashboards│
└─────────────────────────────────────────────────────────────────┘
```

---

## Tekniske Ændringer

### Fase 1: Fjern Permission-krav fra Dashboard Routes

**Fil: `src/routes/config.tsx`**

Ændre alle dashboard-routes fra:
```typescript
{ 
  path: "/dashboards/cph-sales", 
  component: CphSalesDashboard, 
  access: "role", 
  positionPermission: "menu_dashboard_cph_sales" // ← FJERN
}
```

Til:
```typescript
{ 
  path: "/dashboards/cph-sales", 
  component: CphSalesDashboard, 
  access: "protected" // ← Kun login krævet
}
```

**Påvirkede routes:**
- `/dashboards/cph-sales`
- `/dashboards/fieldmarketing`
- `/dashboards/relatel`
- `/dashboards/tdc-erhverv`
- `/dashboards/eesy-tm`
- `/dashboards/mg-test`
- `/dashboards/united`
- `/dashboards/test`
- `/dashboards/cs-top-20`
- `/dashboards/design` → Behold som ejer-only
- `/dashboards/settings` → Behold som ejer-only

### Fase 2: Tilføj Runtime Access-check i Dashboard-komponenter

**Ny hook: `useRequireDashboardAccess(slug)`**

Denne hook redirecter brugeren hvis de ikke har adgang:

```typescript
// src/hooks/useRequireDashboardAccess.ts
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useCanViewDashboard } from "@/hooks/useTeamDashboardPermissions";
import { useAccessibleDashboards } from "@/hooks/useTeamDashboardPermissions";
import { toast } from "sonner";

export function useRequireDashboardAccess(dashboardSlug: string) {
  const navigate = useNavigate();
  const canView = useCanViewDashboard(dashboardSlug);
  const { isLoading, data: accessibleDashboards = [] } = useAccessibleDashboards();

  useEffect(() => {
    if (!isLoading && !canView) {
      toast.error("Du har ikke adgang til dette dashboard");
      // Redirect til dashboard-oversigt eller første tilgængelige
      if (accessibleDashboards.length > 0) {
        navigate(accessibleDashboards[0].path);
      } else {
        navigate("/dashboards");
      }
    }
  }, [isLoading, canView, navigate, accessibleDashboards]);

  return { canView, isLoading };
}
```

**Implementer i hver dashboard-komponent:**

```typescript
// Eksempel: CphSalesDashboard.tsx
export default function CphSalesDashboard() {
  const { canView, isLoading } = useRequireDashboardAccess("cph-sales");
  
  if (isLoading) return <LoadingSpinner />;
  if (!canView) return null; // Redirect håndteres af hook
  
  // ... resten af komponenten
}
```

### Fase 3: Behold Ejer-adgang til Settings/Design

Dashboard Settings og Design dashboardet skal kun være tilgængeligt for ejere. Da `menu_dashboard_settings` er slettet, tilføj en ny permission key:

**Fil: `src/config/permissionKeys.ts`**

```typescript
// Under DASHBOARDS section
menu_dashboard_admin: { label: 'Dashboard Administration', section: 'dashboards', parent: 'menu_section_dashboards' },
```

**Opdater routes:**
```typescript
{ path: "/dashboards/settings", component: DashboardSettings, access: "role", positionPermission: "menu_dashboard_admin" },
{ path: "/dashboards/design", component: DesignDashboard, access: "role", positionPermission: "menu_dashboard_admin" },
```

### Fase 4: Tilføj Settings-link til Dashboard-sidebar

**Fil: `src/components/layout/DashboardSidebar.tsx`**

Tilføj et settings-link i bunden af sidebaren (kun synlig for ejere):

```typescript
{isOwner && (
  <NavLink to="/dashboards/settings" className="...">
    <Settings className="h-4 w-4" />
    {!isCollapsed && <span>Indstillinger</span>}
  </NavLink>
)}
```

---

## Filer der Ændres

| Fil | Ændring |
|-----|---------|
| `src/routes/config.tsx` | Fjern positionPermission fra dashboard routes, brug "protected" |
| `src/hooks/useRequireDashboardAccess.ts` | **NY FIL** - Runtime access check hook |
| `src/pages/dashboards/CphSalesDashboard.tsx` | Tilføj access check |
| `src/pages/dashboards/FieldmarketingDashboardFull.tsx` | Tilføj access check |
| `src/pages/dashboards/*.tsx` | Tilføj access check til alle dashboard-sider |
| `src/config/permissionKeys.ts` | Tilføj `menu_dashboard_admin` |
| `src/components/layout/DashboardSidebar.tsx` | Tilføj settings-link for ejere |

---

## Test-scenarie efter Implementering

### Oscar Belcher (team: Stab)

| Route | Forventet Resultat |
|-------|-------------------|
| `/dashboards` | ✓ Viser oversigt med cs-top-20 |
| `/dashboards/cs-top-20` | ✓ Viser dashboard (Stab har 'all' access) |
| `/dashboards/cph-sales` | ✗ Redirect + toast "Ingen adgang" |
| `/dashboards/settings` | ✗ Blokeret (ikke ejer) |

### Ejer

| Route | Forventet Resultat |
|-------|-------------------|
| `/dashboards` | ✓ Viser alle dashboards |
| `/dashboards/settings` | ✓ Kan administrere rettigheder |

---

## Sammenfatning

Denne plan:

1. **Fjerner blokeringen** - Dashboard-routes kræver kun login, ikke specifikke permissions
2. **Bevarer sikkerhed** - Runtime-check via `useCanViewDashboard()` sikrer team-baseret adgang
3. **Genopretter admin-adgang** - Ny `menu_dashboard_admin` key til Settings/Design
4. **Konsistent arkitektur** - Team-baseret adgang styrer alt, ingen konflikt med rolle-baseret

