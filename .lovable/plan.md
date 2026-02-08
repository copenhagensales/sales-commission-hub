# Plan: Unified Permission System - IMPLEMENTERET ✅

## Status: KOMPLET

Alle opgaver er implementeret og systemet er nu konfigureret med en central "single source of truth" for alle rettigheder.

---

## Implementerede Ændringer

### 1. ✅ Central Permission Config (`src/config/permissionKeys.ts`)

**Udvidet med:**
- `parent` felt til alle permission keys for hierarki-generering
- `generatePermissionHierarchy()` - auto-genererer hierarki fra data
- `generatePermissionCategories()` - auto-genererer UI-kategorier fra data
- `SECTION_ICONS` - ikoner til sektioner i UI
- `getPermissionTypeFromKey()` - central type-bestemmelse
- `getPermissionChildren()` og `hasPermissionChildren()` - hjælpefunktioner

**Fordele:**
- Tilføj nye rettigheder ét sted → de vises automatisk i UI
- TypeScript fanger ugyldige nøgler compile-time
- Ingen duplikerede definitioner

### 2. ✅ PermissionEditorV2.tsx

**Ændringer:**
- Importerer `PERMISSION_HIERARCHY`, `PERMISSION_CATEGORIES`, `getPermissionTypeFromKey`, `getAllPermissionKeys` fra central config
- Fjernet 100+ linjer duplikerede lokale definitioner
- Bygger `PERMISSION_CATEGORIES` med ikoner dynamisk fra config

### 3. ✅ PermissionEditor.tsx

**Ændringer:**
- Importerer `permissionKeyLabels`, `PERMISSION_HIERARCHY`, `getPermissionTypeFromKey`, `getAllPermissionKeys` fra central config
- Fjernet 200+ linjer duplikerede lokale definitioner

### 4. ✅ Dashboard Permissions Auto-Seed

**Nye funktioner i `useTeamDashboardPermissions.ts`:**
- `useSeedMissingDashboardPermissions()` - mutation hook til auto-seeding

**Ændringer i `DashboardPermissionsTab.tsx`:**
- Auto-seeder manglende team/dashboard kombinationer ved mount
- Bruger `useRef` til at sikre seeding kun sker én gang

---

## Arkitektur Flow

```
┌─────────────────────────────────────────────────────────────┐
│              src/config/permissionKeys.ts                   │
│   PERMISSION_KEYS (med parent, label, section felter)       │
└───────────────────────────┬─────────────────────────────────┘
                            │
    ┌───────────────────────┼───────────────────────┐
    ▼                       ▼                       ▼
┌───────────────┐   ┌───────────────────┐   ┌─────────────────┐
│PermissionKeyLabels│ │PERMISSION_HIERARCHY│ │PERMISSION_CATEGORIES│
│ (auto-genereret) │ │ (auto-genereret)   │ │ (auto-genereret)    │
└───────┬───────┘   └────────┬──────────┘   └────────┬────────┘
        │                    │                       │
        └────────────────────┼───────────────────────┘
                             ▼
         ┌──────────────────────────────────────┐
         │  PermissionEditorV2 / PermissionEditor  │
         │  (ingen lokale definitioner mere)      │
         └──────────────────────────────────────┘
```

```
┌─────────────────────────────────────────────────────────────┐
│                  src/config/dashboards.ts                   │
│     DASHBOARD_LIST (slug, name, path, permissionKey)        │
└───────────────────────────┬─────────────────────────────────┘
                            │
        ┌───────────────────┴───────────────────┐
        ▼                                       ▼
┌─────────────────────────────┐   ┌─────────────────────────────┐
│ DashboardPermissionsTab.tsx │   │ DashboardHome.tsx           │
│ (auto-seeds manglende perms)│   │ (viser tilgængelige dashboards)│
└─────────────────────────────┘   └─────────────────────────────┘
```

---

## Sådan Tilføjer Du Nye Rettigheder

### For Menu/Tab Rettigheder:

1. **Tilføj til `src/config/permissionKeys.ts`:**
```typescript
export const PERMISSION_KEYS = {
  // ...eksisterende
  menu_ny_feature: { label: 'Ny Feature', section: 'din_sektion', parent: 'menu_section_xxx' },
  tab_ny_feature_detaljer: { label: 'Fane: Detaljer', section: 'din_sektion', parent: 'menu_ny_feature' },
};
```

2. **Det er det!** UI opdateres automatisk ved næste role-valg i permission editor.

### For Dashboards:

1. **Tilføj til `src/config/dashboards.ts`:**
```typescript
export const DASHBOARD_LIST: DashboardConfig[] = [
  // ...eksisterende
  { 
    slug: "nyt-dashboard", 
    name: "Nyt Dashboard", 
    path: "/dashboards/nyt-dashboard",
    permissionKey: "menu_dashboard_nyt" 
  },
];
```

2. **Auto-seeding** opretter automatisk `team_dashboard_permissions` rækker ved næste visit til rettigheds-tabben.

---

## Filer Ændret

| Fil | Ændring |
|-----|---------|
| `src/config/permissionKeys.ts` | Tilføjet parent felt + generator-funktioner |
| `src/components/employees/permissions/PermissionEditorV2.tsx` | Importerer fra central config |
| `src/components/employees/permissions/PermissionEditor.tsx` | Importerer fra central config |
| `src/hooks/useTeamDashboardPermissions.ts` | Tilføjet `useSeedMissingDashboardPermissions` |
| `src/components/dashboard/DashboardPermissionsTab.tsx` | Auto-seed ved mount |

---

## Næste Skridt (Valgfrit)

1. **Real-time sync**: Tilføj Supabase Realtime subscription for øjeblikkelige opdateringer
2. **Deprecer `src/config/permissions.ts`**: Kan fjernes når alt er migreret
3. **Audit log**: Log ændringer til rettigheder for compliance
