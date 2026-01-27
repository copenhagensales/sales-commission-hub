
# Plan: Tilføj manglende dashboard-permissions til PERMISSION_CATEGORIES

## Problemet
Kasper Mikkelsen (Ejer) redirectes til `/home` når han prøver at åbne CS Top 20 dashboardet.

**Rod-årsag:** `menu_dashboard_cs_top_20` og `menu_dashboard_mg_test` mangler i `PERMISSION_CATEGORIES` i `src/config/permissions.ts`.

Ejere får deres tilladelser genereret automatisk via `generateOwnerPermissions()`, som kun inkluderer keys fra `PERMISSION_CATEGORIES`. Uden disse keys returnerer `canView("menu_dashboard_cs_top_20")` altid `false` for ejeren.

## Flow-analyse

```text
1. Kasper navigerer til /dashboards/cs-top-20
2. RoleProtectedRoute tjekker: canView("menu_dashboard_cs_top_20")
3. usePermissions henter ejer-permissions fra generateOwnerPermissions()
4. generateOwnerPermissions() itererer PERMISSION_CATEGORIES
5. menu_dashboard_cs_top_20 findes IKKE i PERMISSION_CATEGORIES
6. canView() returnerer false → redirect til /home
```

## Løsning
Tilføj de manglende dashboard-permissions til `PERMISSION_CATEGORIES` i `src/config/permissions.ts`.

## Ændringer

### Fil: src/config/permissions.ts
Tilføj to manglende dashboard-permissions til `menu_dashboards` kategorien (omkring linje 620):

```typescript
{
  key: "menu_dashboard_cs_top_20",
  label: "CS Top 20 Dashboard",
  description: "Adgang til CS Top 20 dashboard",
  hasEditOption: false,
},
{
  key: "menu_dashboard_mg_test",
  label: "MG Test Dashboard", 
  description: "Adgang til MG Test dashboard",
  hasEditOption: false,
},
```

## Påvirkede områder

| Komponent | Effekt |
|-----------|--------|
| `generateOwnerPermissions()` | Inkluderer nu CS Top 20 og MG Test |
| `RoleProtectedRoute` | `canView()` returnerer `true` for ejere |
| `AppSidebar` | Dashboard links vises for ejere |
| `DashboardHeader dropdown` | Dashboards vises i dropdown for ejere |

## Teknisk sektion

### Hvorfor fejlen opstår
`generateAllPermissions()` (linje 954-973) itererer kun over `PERMISSION_CATEGORIES`:

```typescript
export const generateAllPermissions = (excludeKeys: string[] = []) => {
  const allPermissions = {};
  PERMISSION_CATEGORIES.forEach((category) => {
    category.permissions.forEach((permission) => {
      // Keys der ikke er defineret her, bliver ALDRIG tilføjet
      allPermissions[permission.key] = ...;
    });
  });
  return allPermissions;
};
```

### Placering af ændring
Indsæt efter `menu_dashboard_united` (linje 620-624) i `menu_dashboards` kategorien.

### Risiko
Minimal - tilføjer kun manglende metadata. Ingen breaking changes.

## Forventet resultat
- Kasper Mikkelsen og andre ejere kan tilgå CS Top 20 dashboard
- Dashboard vises i sidebar under "Dashboards"
- Dashboard vises i dropdown-menuen på dashboard-sider
