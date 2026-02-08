

# Plan: Komplet Rettighedssystem Synkronisering og Oprydning

## Systemanalyse - Nuværende Arkitektur

### To Separate Rettighedsmiljøer

| Miljø | Placering | Styring | UI |
|-------|-----------|---------|-----|
| **Hovedsiden** | `/employees?tab=permissions` | Rolle-baseret via `role_page_permissions` | `PermissionEditorV2.tsx` |
| **Dashboard-miljøet** | Dashboard-indstillinger | Team-baseret via `team_dashboard_permissions` | `DashboardPermissionsTab.tsx` |

### Identificerede Problemer

#### Problem 1: Dashboard-rettigheder vises på hovedsidens permission editor
**Årsag:** `permissionKeys.ts` (linje 186-202) indeholder individuelle dashboard-keys (`menu_dashboard_cph_sales`, etc.)

**Effekt:** Disse rettigheder har INGEN reel effekt - dashboard-adgang styres udelukkende via team-systemet i `DashboardPermissionsTab.tsx`

**Forvirring:** Administratorer ser rettigheder der ikke gør noget

#### Problem 2: TDC Opsummering mangler i sidebaren
**Årsag:** 
- `menu_tdc_opsummering` er defineret i `permissionKeys.ts` (linje 121) under MG-sektionen
- `canViewTdcOpsummering` er eksporteret fra `usePositionPermissions.ts` (linje 557)
- Ruten `/tdc-opsummering` eksisterer i `routes/config.tsx` (linje 404)

**Problem:** MG-menuen i `AppSidebar.tsx` (linje 1225-1236) viser KUN `menu_mg_test`! TDC Opsummering er aldrig tilføjet.

**Brugerens ønske:** TDC Opsummering skal vises i **Mit Hjem** menuen, ikke MG.

#### Problem 3: showMgMenu logik er for restriktiv
**Nuværende (linje 437):**
```typescript
const showMgMenu = p.canView("menu_section_mg") && p.canViewMgTest;
```

**Problem:** MG-menuen vises KUN hvis brugeren har adgang til `menu_mg_test`, men mange andre MG-elementer eksisterer.

#### Problem 4: Inkonsistens i `permissions.ts`
- `menu_tdc_opsummering` er placeret i "Dashboards menu" kategorien (linje 620)
- Men i `permissionKeys.ts` er den under MG-sektionen
- Denne inkonsistens skaber forvirring

---

## Løsning: Central "Source of Truth" med Automatisk Synkronisering

### Princip: Tilføj ét sted → Vises automatisk overalt

```text
┌─────────────────────────────────────────────────────────────────────────┐
│             CENTRAL KONFIGURATION (Single Source of Truth)              │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  src/config/permissionKeys.ts                                           │
│  ├── PERMISSION_KEYS (alle menu/tab keys med parent, section, label)   │
│  ├── generatePermissionHierarchy() → auto-genererer hierarki            │
│  └── generatePermissionCategories() → auto-genererer UI-kategorier      │
│                                                                         │
│  src/config/dashboards.ts                                               │
│  └── DASHBOARD_LIST (alle dashboards med slug, name, path)              │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
           ┌────────────────────────┴────────────────────────┐
           ▼                                                 ▼
┌──────────────────────────────────────┐  ┌──────────────────────────────────────┐
│        HOVEDSIDEN (rolle-baseret)     │  │   DASHBOARD-MILJØET (team-baseret)   │
├───────────────────────────────────────┤  ├───────────────────────────────────────┤
│ PermissionEditorV2.tsx                │  │ DashboardPermissionsTab.tsx           │
│ • Importerer fra permissionKeys.ts    │  │ • Importerer fra dashboards.ts        │
│ • Auto-seed ved rolle-valg            │  │ • Auto-seed ved mount                 │
│ • INGEN individuelle dashboard-keys   │  │ • Team-baseret adgangsniveau          │
│                                       │  │                                       │
│ AppSidebar.tsx                        │  │ DashboardSidebar.tsx                  │
│ • Viser menupunkter baseret på perms  │  │ • Viser dashboards baseret på team    │
└───────────────────────────────────────┘  └───────────────────────────────────────┘
```

---

## Tekniske Ændringer

### Fase 1: Flyt TDC Opsummering til Mit Hjem

#### 1.1 Opdater `src/config/permissionKeys.ts`

**Ændre linje 121 fra:**
```typescript
menu_tdc_opsummering: { label: 'TDC Opsummering', section: 'mg', parent: 'menu_section_mg' },
```

**Til:**
```typescript
menu_tdc_opsummering: { label: 'TDC Opsummering', section: 'mit_hjem', parent: 'menu_section_personal' },
```

#### 1.2 Opdater `src/components/layout/AppSidebar.tsx`

**A) Tilføj TDC Opsummering i Mit Hjem menuen (efter linje 645):**
```typescript
{/* TDC Opsummering */}
{p.canViewTdcOpsummering && (
  <NavLink
    to="/tdc-opsummering"
    onClick={handleNavClick}
    className={cn(
      "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
      location.pathname === "/tdc-opsummering" 
        ? "bg-sidebar-accent text-sidebar-accent-foreground" 
        : "text-sidebar-foreground hover:bg-sidebar-accent/50"
    )}
  >
    <FileText className="h-4 w-4" />
    TDC Opsummering
  </NavLink>
)}
```

**B) Opdater mitHjemOpen state trigger (linje 55-57):**
```typescript
const [mitHjemOpen, setMitHjemOpen] = useState(
  ["/home", "/messages", "/my-profile", "/my-feedback", "/refer-a-friend", 
   "/my-goals", "/immediate-payment-ase", "/tdc-opsummering"].some(
    path => location.pathname === path || location.pathname.startsWith(path)
  )
);
```

#### 1.3 Opdater `src/components/layout/PreviewSidebar.tsx`

Tilføj til `PERSONAL_MENU_ITEMS` (linje 32-38):
```typescript
const PERSONAL_MENU_ITEMS = {
  menu_my_schedule: { name: "Min kalender", href: "/my-schedule", icon: UserCheck },
  menu_my_profile: { name: "Min profil", href: "/my-profile", icon: User },
  menu_my_contracts: { name: "Mine kontrakter", href: "/my-contracts", icon: FileText },
  menu_career_wishes: { name: "Karriereønsker", href: "/career-wishes", icon: Sparkles },
  menu_time_stamp: { name: "Stempel ind/ud", href: "/time-stamp", icon: Clock },
  menu_tdc_opsummering: { name: "TDC Opsummering", href: "/tdc-opsummering", icon: FileText }, // NY
};
```

---

### Fase 2: Fjern Dashboard-rettigheder fra Hovedsidens Permission Editor

#### 2.1 Opdater `src/config/permissionKeys.ts`

**Fjern disse keys helt (linje 186-202):**
```typescript
// FJERNES - styres via team_dashboard_permissions:
menu_dashboard_cph_sales
menu_dashboard_cs_top_20
menu_dashboard_fieldmarketing
menu_dashboard_eesy_tm
menu_dashboard_tdc_erhverv
menu_dashboard_relatel
menu_dashboard_tryg
menu_dashboard_ase
menu_dashboard_test
menu_dashboard_united
menu_dashboard_design
menu_dashboard_settings
tab_dashboard_widgets
tab_dashboard_kpis
tab_dashboard_designs
```

**Behold kun:**
```typescript
menu_dashboards: { label: 'Dashboards', section: 'dashboards', parent: 'menu_section_dashboards' },
```

#### 2.2 Opdater `src/config/permissions.ts`

Fjern eller kommenter ud dashboard-kategorierne (linje 559-666):
- "Dashboards menu" kategorien
- "Dashboard Indstillinger faner" kategorien

Behold kun `menu_dashboards` for generel miljø-adgang.

#### 2.3 Opdater `src/hooks/usePositionPermissions.ts`

Fjern ubrugte dashboard permission exports (linje 610-618):
```typescript
// FJERNES - ikke længere brugt:
canViewDashboardCphSales
canViewDashboardCsTop20
canViewDashboardFieldmarketing
canViewDashboardEesyTm
canViewDashboardTdcErhverv
canViewDashboardRelatel
canViewDashboardUnited
canViewDashboardDesign
canViewDashboardSettings
```

---

### Fase 3: Forbedre MG-menuen (valgfrit)

#### 3.1 Opdater showMgMenu logik i `AppSidebar.tsx` (linje 437)

**Fra:**
```typescript
const showMgMenu = p.canView("menu_section_mg") && p.canViewMgTest;
```

**Til:**
```typescript
const showMgMenu = p.canView("menu_section_mg") && 
  (p.canViewMgTest || p.canViewPayroll || p.canViewTdcErhverv || 
   p.canViewCodan || p.canViewDialerData || p.canViewCallsData || p.canViewAdversusData);
```

#### 3.2 Tilføj flere MG-elementer til sidebar

MG-sektionen i `AppSidebar.tsx` viser kun `menu_mg_test`. Tilføj:
- TDC Erhverv (`canViewTdcErhverv`)
- Payroll (`canViewPayroll`)
- Codan (`canViewCodan`)
- Dialer Data (`canViewDialerData`)
- Opkaldsdata (`canViewCallsData`)
- Adversus Data (`canViewAdversusData`)

---

## Synkroniseringsmekanismer

### Hovedsidens Permission Editor

| Handling | Mekanisme |
|----------|-----------|
| Ny rolle vælges | `seedPermissionsForRole()` auto-seeder manglende keys fra `getAllPermissionKeys()` |
| Ny permission key tilføjes i config | Næste gang rollen vælges, auto-seedes den nye key |
| Hierarki ændres | `PERMISSION_HIERARCHY` regenereres fra `parent` felter |
| Kategorier ændres | `PERMISSION_CATEGORIES` regenereres fra `section` og `parent` felter |

### Dashboard-miljøets Permission Tab

| Handling | Mekanisme |
|----------|-----------|
| Tab mountes | `useSeedMissingDashboardPermissions` auto-seeder manglende team/dashboard kombinationer |
| Nyt dashboard tilføjes i DASHBOARD_LIST | Næste mount seeder det for alle teams med `none` niveau |
| Nyt team oprettes | Næste mount seeder alle dashboards for det nye team |

---

## Sådan Tilføjer Du Nye Rettigheder

### For Menu/Tab på Hovedsiden:

1. **Tilføj til `src/config/permissionKeys.ts`:**
```typescript
export const PERMISSION_KEYS = {
  // ...eksisterende
  menu_ny_feature: { label: 'Ny Feature', section: 'din_sektion', parent: 'menu_section_xxx' },
  tab_ny_feature_detaljer: { label: 'Fane: Detaljer', section: 'din_sektion', parent: 'menu_ny_feature' },
};
```

2. **Tilføj NavLink i relevant sidebar (AppSidebar.tsx):**
```typescript
{p.canViewNyFeature && (
  <NavLink to="/ny-feature" ...>
    Ny Feature
  </NavLink>
)}
```

3. **Det er det!** Auto-seeding opretter database-rækker ved næste rolle-valg.

### For Dashboards:

1. **Tilføj til `src/config/dashboards.ts`:**
```typescript
export const DASHBOARD_LIST: DashboardConfig[] = [
  // ...eksisterende
  { 
    slug: "nyt-dashboard", 
    name: "Nyt Dashboard", 
    path: "/dashboards/nyt-dashboard",
    description: "Beskrivelse af det nye dashboard"
  },
];
```

2. **Det er det!** Auto-seeding opretter `team_dashboard_permissions` rækker ved næste visit.

---

## Filer der Ændres

| Fil | Ændring |
|-----|---------|
| `src/config/permissionKeys.ts` | Flyt TDC Opsummering + fjern 15 dashboard-keys |
| `src/config/permissions.ts` | Fjern dashboard-kategorier |
| `src/components/layout/AppSidebar.tsx` | Tilføj TDC Opsummering i Mit Hjem + opdater state |
| `src/components/layout/PreviewSidebar.tsx` | Tilføj TDC Opsummering til PERSONAL_MENU_ITEMS |
| `src/hooks/usePositionPermissions.ts` | Fjern ubrugte dashboard permission exports |

---

## Forventet Resultat

### Mit Hjem Menu (efter ændring):
```
MIT HJEM
├── Hjem
├── Beskeder
├── Min Profil
├── Min Feedback
├── Løn & Mål
├── Anbefal en ven
├── Straksbetaling (ASE)
└── TDC Opsummering  ← NY PLACERING
```

### Permission Editor Hovedsiden (efter ændring):
```
Dashboards sektion:
└── menu_dashboards (kun generel miljø-adgang)
    ← INGEN individuelle dashboard-rettigheder

Dashboard-rettigheder administreres nu KUN via
Dashboard-miljøets rettighedsside (team-baseret)
```

### Dashboard Permissions Tab (uændret, fungerer som forventet):
```
For hvert dashboard:
├── Team 1: [Ingen] [TL] [Ledelse] [Alle]
├── Team 2: [Ingen] [TL] [Ledelse] [Alle]
└── ...
```

---

## Databaseoprydning (Valgfrit)

For at fjerne eksisterende ubrugte permission-rækker:

```sql
-- Fjern individuelle dashboard-rettigheder der ikke længere bruges
DELETE FROM role_page_permissions 
WHERE permission_key LIKE 'menu_dashboard_%'
   OR permission_key LIKE 'tab_dashboard_%';
```

---

## Sammenfatning

Denne plan sikrer:

1. **TDC Opsummering** vises korrekt i Mit Hjem menuen
2. **Dashboard-rettigheder** fjernes fra hovedsidens editor (de styres i dashboard-miljøet)
3. **Central konfiguration** - tilføj nye rettigheder ét sted, de vises automatisk overalt
4. **Auto-sync** - begge rettighedssider synkroniseres automatisk med konfigurationen
5. **Ingen duplikater** - hvert system har én kilde til sandhed

