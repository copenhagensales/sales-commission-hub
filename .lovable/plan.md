
# Plan: Unified Permission System - Altid Opdateret

## Kerneproblem

Der er **tre steder** hvor rettigheder defineres i koden:

| Fil | Indhold | Problem |
|-----|---------|---------|
| `src/config/permissionKeys.ts` | `PERMISSION_KEYS` med labels og sections | Mangler parent/hierarki |
| `src/config/permissions.ts` | `PERMISSION_CATEGORIES[]` med kategorier | Duplikeret data |
| `PermissionEditorV2.tsx` | Lokal `PERMISSION_CATEGORIES` og `PERMISSION_HIERARCHY` | Hårdt kodet, ude af sync |

For dashboards:
| Fil | Indhold |
|-----|---------|
| `src/config/dashboards.ts` | `DASHBOARD_LIST` med slugs, paths, descriptions |
| `DashboardPermissionsTab.tsx` | Bruger `DASHBOARD_LIST` korrekt |

---

## Løsning: Single Source of Truth + Auto-Generering

### 1. Udvid `permissionKeys.ts` med Parent-felter

Tilføj `parent` felt til hver permission key, så hierarkiet kan genereres automatisk:

```typescript
export const PERMISSION_KEYS = {
  // Sektioner (top-level - har parent: null)
  menu_section_personal: { label: 'Mit Hjem', section: 'sections', parent: null },
  menu_section_personale: { label: 'Personale', section: 'sections', parent: null },
  
  // Children har parent reference
  menu_home: { label: 'Hjem', section: 'mit_hjem', parent: 'menu_section_personal' },
  menu_h2h: { label: 'Head-to-Head', section: 'mit_hjem', parent: 'menu_section_personal' },
  
  // Tabs har deres menu som parent
  tab_employees_all: { label: 'Fane: Alle medarbejdere', section: 'personale', parent: 'menu_employees' },
  // ...
} as const;
```

### 2. Auto-Generér Hierarki og Kategorier

Tilføj funktioner til `permissionKeys.ts`:

```typescript
// Generér PERMISSION_HIERARCHY automatisk
export function generatePermissionHierarchy(): Record<string, string | null> {
  const hierarchy: Record<string, string | null> = {};
  for (const [key, config] of Object.entries(PERMISSION_KEYS)) {
    hierarchy[key] = config.parent ?? null;
  }
  return hierarchy;
}

// Generér PERMISSION_CATEGORIES automatisk
export function generatePermissionCategories(): Record<string, { label: string; keys: string[] }> {
  const categories: Record<string, { label: string; keys: string[] }> = {};
  
  // Find alle section parents
  for (const [key, config] of Object.entries(PERMISSION_KEYS)) {
    if (config.parent === null && key.startsWith('menu_section_')) {
      categories[key] = { label: config.label, keys: [] };
    }
  }
  
  // Tilføj children til deres kategorier
  for (const [key, config] of Object.entries(PERMISSION_KEYS)) {
    const section = config.section;
    const parentSection = findParentSection(key);
    if (parentSection && categories[parentSection]) {
      categories[parentSection].keys.push(key);
    }
  }
  
  return categories;
}
```

### 3. Opdater PermissionEditorV2.tsx

Fjern de lokale definitioner og importér fra config:

```typescript
// FJERN disse lokale definitioner (linje 116-223):
// const PERMISSION_CATEGORIES = { ... }
// const PERMISSION_HIERARCHY = { ... }

// ERSTAT med:
import { 
  generatePermissionHierarchy, 
  generatePermissionCategories,
  getAllPermissionKeys 
} from "@/config/permissionKeys";

// Brug auto-genererede værdier
const PERMISSION_HIERARCHY = generatePermissionHierarchy();
const PERMISSION_CATEGORIES = generatePermissionCategories();
```

### 4. Dashboard-rettigheder

Dashboard-siden (`DashboardPermissionsTab.tsx`) bruger allerede `DASHBOARD_LIST` fra `src/config/dashboards.ts` korrekt. 

Problemet er at nye dashboards tilføjet til `DASHBOARD_LIST` automatisk vises i UI'et, men **eksisterende permissions i databasen opdateres ikke**.

**Løsning:** Tilføj auto-seeding for dashboard permissions ligesom main permissions:

```typescript
// I DashboardPermissionsTab.tsx
useEffect(() => {
  // Tjek om der mangler permissions for nogen dashboards
  const existingSlugs = new Set(permissions.map(p => p.dashboard_slug));
  const missingSlugs = DASHBOARD_LIST.filter(d => !existingSlugs.has(d.slug));
  
  if (missingSlugs.length > 0) {
    // Seed manglende permissions med 'none' niveau
    seedMissingDashboardPermissions(missingSlugs);
  }
}, [permissions, DASHBOARD_LIST]);
```

---

## Filer der ændres

| Fil | Ændring |
|-----|---------|
| `src/config/permissionKeys.ts` | Tilføj `parent` felt + generator funktioner |
| `src/components/employees/permissions/PermissionEditorV2.tsx` | Fjern lokale definitioner, importér fra config |
| `src/components/employees/permissions/PermissionEditor.tsx` | Fjern lokale definitioner, importér fra config |
| `src/config/permissions.ts` | Kan evt. depreceres/fjernes |
| `src/components/dashboard/DashboardPermissionsTab.tsx` | Tilføj auto-seed for manglende dashboard permissions |

---

## Fordele

1. **Én kilde** - Alle permission keys defineres ét sted
2. **Automatisk sync** - Hierarki og kategorier genereres fra data
3. **Compile-time checks** - TypeScript fanger ugyldige keys
4. **Nemt at vedligeholde** - Tilføj ny permission ét sted, den dukker op overalt
5. **Dashboard auto-seed** - Nye dashboards får automatisk permissions

---

## UI-fix for Dashboard Permissions

Det "mærkelige" udseende i skærmbilledet skyldes sandsynligvis:

1. **Manglende permissions** - Ikke alle team/dashboard kombinationer har en entry i databasen
2. **Stale data** - Cache er ikke opdateret

Fix:
- Tilføj auto-seed ved component mount for manglende kombinationer
- Sikr at alle teams har en entry for alle dashboards (med `none` som default)

---

## Teknisk Flow

```text
┌────────────────────────────────────────────────────────────────────┐
│                   PERMISSION_KEYS (Central Config)                 │
│  { menu_home: { label, section, parent: 'menu_section_personal' } }│
└──────────────────────────────┬─────────────────────────────────────┘
                               │
         ┌─────────────────────┴─────────────────────┐
         ▼                                           ▼
┌─────────────────────┐                   ┌─────────────────────┐
│generateHierarchy()  │                   │generateCategories() │
│  → Record<key, parent>                  │  → Record<section, keys[]>
└─────────────────────┘                   └─────────────────────┘
         │                                           │
         └─────────────────────┬─────────────────────┘
                               ▼
              ┌────────────────────────────────┐
              │   PermissionEditorV2.tsx       │
              │   (ingen lokale definitioner)  │
              └────────────────────────────────┘
```

```text
┌────────────────────────────────────────────────────────────────────┐
│                   DASHBOARD_LIST (Central Config)                  │
│  [{ slug, name, path, description, permissionKey }]                │
└──────────────────────────────┬─────────────────────────────────────┘
                               │
         ┌─────────────────────┴─────────────────────┐
         ▼                                           ▼
┌─────────────────────────────┐       ┌─────────────────────────────┐
│ DashboardPermissionsTab.tsx │       │ DashboardHome.tsx           │
│ (team-based permissions)    │       │ (accessible dashboards)     │
└─────────────────────────────┘       └─────────────────────────────┘
         │                                           ▲
         │     ┌────────────────────────────┐        │
         └────►│ team_dashboard_permissions │────────┘
               │ (database - auto-seeded)   │
               └────────────────────────────┘
```

---

## Implementeringsrækkefølge

1. Først: Udvid `permissionKeys.ts` med parent-felter og generator-funktioner
2. Dernæst: Opdater `PermissionEditorV2.tsx` til at bruge genererede værdier
3. Derefter: Opdater `PermissionEditor.tsx` på samme måde
4. Så: Tilføj auto-seed logik til `DashboardPermissionsTab.tsx`
5. Til sidst: Test begge permission-sider er synkroniserede
