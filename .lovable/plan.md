
# Grundig Plan: Dashboard-miljø Fuldstændig Adskillelse

## Overblik

Denne plan adskiller dashboard-miljøet fuldstændigt fra hovedsystemet, så de fungerer som to selvstændige miljøer med separate rettigheder, navigation og layouts.

---

## Rettigheds-arkitektur

### Ny to-lags rettighedsstruktur

| Lag | Rettighed | Administreres hvor | Beskrivelse |
|-----|-----------|-------------------|-------------|
| **Hovedsystem** | `menu_section_dashboards` | PermissionEditorV2 | Én enkelt on/off switch for dashboard-miljø adgang |
| **Dashboard-miljø** | `menu_dashboard_*` | DashboardPermissionsTab | Individuelle dashboard-rettigheder |

**Brugeroplevelse:**
1. Administrator i hovedsystemet giver en rolle adgang til "Dashboards" (on/off)
2. Administrator i dashboard-miljøet under "Indstillinger → Rettigheder" bestemmer hvilke specifikke dashboards rollen kan se

---

## Fase 1: Fjern Dashboard-sektionen fra Hovedsystemets Sidebar

### Fil: `src/components/layout/AppSidebar.tsx`

**1.1 Fjern state variable (linje 66):**
```typescript
// FJERN denne linje:
const [dashboardsOpen, setDashboardsOpen] = useState(location.pathname.startsWith("/dashboards") || location.pathname === "/tdc-opsummering");
```

**1.2 Fjern hele Dashboard Collapsible (linje 1214-1323):**
Fjern hele denne sektion med ~110 linjer:
- Collapsible wrapper med condition check
- Alle individuelle dashboard NavLinks (CPH Sales, CS Top 20, Fieldmarketing, etc.)
- TDC Opsummering link

Brugere i hovedsystemet vil nu kun kunne skifte til dashboard-miljøet via EnvironmentSwitcher.

---

## Fase 2: Forenkl Permission Editor - Fjern Dashboard-børn

### Fil: `src/components/employees/permissions/PermissionEditorV2.tsx`

**2.1 Opdater PERMISSION_CATEGORIES (linje 152-156):**

```typescript
// NUVÆRENDE (med alle dashboard-børn):
menu_section_dashboards: {
  label: "Dashboards",
  icon: <BarChart3 className="h-4 w-4" />,
  keys: ['menu_dashboard_cph_sales', 'menu_dashboard_cs_top_20', 'menu_dashboard_fieldmarketing', 
         'menu_dashboard_eesy_tm', 'menu_dashboard_tdc_erhverv', 'menu_dashboard_relatel', 
         'menu_dashboard_mg_test', 'menu_dashboard_united', 'menu_dashboard_design', 
         'menu_dashboard_settings']
}

// NY (ingen børn - én enkelt toggle):
menu_section_dashboards: {
  label: "Dashboards",
  icon: <BarChart3 className="h-4 w-4" />,
  keys: [] // Administreres i dashboard-miljøet
}
```

**Resultat:** Dashboard-sektionen i PermissionEditorV2 viser nu kun én toggle for "Dashboards" i stedet for alle individuelle dashboards.

---

## Fase 3: Opdater Legacy Permission Editor

### Fil: `src/components/employees/PermissionsTab.tsx`

**3.1 Opdater sectionChildren (linje 260-264):**

```typescript
// NUVÆRENDE:
menu_section_dashboards: [
  'menu_dashboard_cph_sales', 'menu_dashboard_cs_top_20', 'menu_dashboard_fieldmarketing',
  'menu_dashboard_eesy_tm', 'menu_dashboard_tdc_erhverv', 'menu_dashboard_relatel',
  'menu_dashboard_united', 'menu_dashboard_design', 'menu_dashboard_settings'
]

// NY:
menu_section_dashboards: [] // Administreres i dashboard-miljøet
```

---

## Fase 4: Ret DashboardSettings Layout

### Fil: `src/pages/dashboards/DashboardSettings.tsx`

**4.1 Ændr import (linje 4):**
```typescript
// NUVÆRENDE:
import { MainLayout } from "@/components/layout/MainLayout";

// NY:
import { DashboardLayout } from "@/components/layout/DashboardLayout";
```

**4.2 Ændr layout wrapper (linje 501-503):**
```typescript
// NUVÆRENDE:
return (
  <MainLayout>
    ...
  </MainLayout>
);

// NY:
return (
  <DashboardLayout>
    ...
  </DashboardLayout>
);
```

**Resultat:** DashboardSettings vises nu med DashboardSidebar i stedet for hovedsystemets sidebar.

---

## Fase 5: Verificer Eksisterende Komponenter

### 5.1 AppModeContext - Allerede korrekt (ingen ændringer)
Filen `src/contexts/AppModeContext.tsx` (linje 32) har allerede korrekt logik:
```typescript
const canAccessDashboards = accessibleDashboards.length > 0 && canView("menu_section_dashboards");
```

Dette sikrer at:
1. Brugeren har `menu_section_dashboards` rettighed (sat i hovedsystemet)
2. Brugeren har mindst ét specifikt dashboard aktiveret (sat i dashboard-miljøet)

Begge betingelser skal være opfyldt for at se EnvironmentSwitcher-knappen.

### 5.2 DashboardSidebar - Allerede korrekt (ingen ændringer)
Filen `src/components/layout/DashboardSidebar.tsx` filtrerer allerede dashboards baseret på permissions.

### 5.3 DashboardPermissionsTab - Allerede korrekt (ingen ændringer)
Filen `src/components/dashboard/DashboardPermissionsTab.tsx` håndterer allerede individuelle dashboard-rettigheder.

---

## Teknisk Oversigt

### Filer der ændres

| Fil | Ændring | Linjer |
|-----|---------|--------|
| `src/components/layout/AppSidebar.tsx` | Fjern dashboard-sektion | ~110 linjer fjernes |
| `src/components/employees/permissions/PermissionEditorV2.tsx` | Tøm dashboard keys array | 1-2 linjer |
| `src/components/employees/PermissionsTab.tsx` | Tøm dashboard children array | 1-2 linjer |
| `src/pages/dashboards/DashboardSettings.tsx` | Skift layout wrapper | 2 linjer |

### Filer der forbliver uændrede
- `src/contexts/AppModeContext.tsx` - Allerede korrekt logik
- `src/components/layout/DashboardSidebar.tsx` - Allerede korrekt
- `src/components/layout/DashboardLayout.tsx` - Allerede korrekt
- `src/components/dashboard/DashboardPermissionsTab.tsx` - Allerede korrekt
- `src/config/dashboards.ts` - Allerede korrekt

---

## Forventet Resultat

### Hovedsystem (`/home`, `/employees`, etc.)
- Ingen dashboard-links i sidebaren
- EnvironmentSwitcher-knap viser mulighed for at skifte til dashboards (hvis bruger har adgang)
- PermissionEditor viser kun én "Dashboards" toggle

### Dashboard-miljø (`/dashboards/*`)
- DashboardSidebar med alle tilgængelige dashboards
- Home-knap for at vende tilbage til hovedsystemet
- Konsistent layout med sidebar på alle dashboard-sider
- "Indstillinger → Rettigheder" tab til granulær dashboard-adgang

### Rettigheds-flow

```text
┌─────────────────────────────────────────────────────────────────┐
│                      HOVEDSYSTEM                                │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  PermissionEditorV2                                       │  │
│  │  ┌─────────────────────────────────────────────────────┐  │  │
│  │  │  [✓] Dashboards  ← Én enkelt toggle                 │  │  │
│  │  │      (giver adgang til hele dashboard-miljøet)      │  │  │
│  │  └─────────────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────────────┘  │
└──────────────────────────────┬──────────────────────────────────┘
                               │
                               ▼ EnvironmentSwitcher
┌─────────────────────────────────────────────────────────────────┐
│                    DASHBOARD-MILJØ                              │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  Indstillinger → Rettigheder (DashboardPermissionsTab)    │  │
│  │  ┌─────────────────────────────────────────────────────┐  │  │
│  │  │  Vælg rolle: [Teamleder ▼]                          │  │  │
│  │  │                                                     │  │  │
│  │  │  [✓] CPH Sales                                      │  │  │
│  │  │  [✓] CS Top 20                                      │  │  │
│  │  │  [ ] Fieldmarketing                                 │  │  │
│  │  │  [✓] TDC Erhverv                                    │  │  │
│  │  │  [ ] Relatel                                        │  │  │
│  │  │  ...                                                │  │  │
│  │  └─────────────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Test Plan

### 1. Verificer Hovedsystem
- [ ] Dashboards vises IKKE i AppSidebar
- [ ] PermissionEditor viser kun én "Dashboards" toggle
- [ ] EnvironmentSwitcher vises kun hvis bruger har `menu_section_dashboards` OG mindst ét dashboard

### 2. Verificer Dashboard-miljø
- [ ] DashboardSettings vises med DashboardSidebar (ikke MainLayout)
- [ ] Alle dashboards bruger DashboardLayout
- [ ] DashboardPermissionsTab fungerer korrekt

### 3. Verificer Rettigheder
- [ ] Bruger UDEN `menu_section_dashboards` kan ikke tilgå dashboards
- [ ] Bruger MED `menu_section_dashboards` men UDEN individuelle dashboards ser tom sidebar
- [ ] Bruger MED begge rettigheder ser kun de dashboards de har adgang til

### 4. Verificer Navigation
- [ ] Home-knap i dashboard-miljø navigerer til `/home`
- [ ] EnvironmentSwitcher skifter korrekt mellem miljøer
- [ ] URL'er fungerer korrekt (`/dashboards/cph-sales`, etc.)
