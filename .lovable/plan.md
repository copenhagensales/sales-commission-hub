
# Plan: Fix CS Top 20 Dashboard i Sidebar

## Problemanalyse

"CS Top 20" vises i dashboard-dropdown (DashboardHeader) men ikke i sidebaren fordi:

1. **Manglende permission i `usePositionPermissions.ts`**
   - Der er ingen `canViewDashboardCsTop20` defineret
   - Alle andre dashboards har deres egen permission, men CS Top 20 blev glemt

2. **Forkert permission-check i sidebaren**
   - Linjen `{p.canViewDashboardCphSales && (...)}` bruges fejlagtigt for CS Top 20
   - Det betyder at CS Top 20 kun vises hvis brugeren har adgang til CPH Sales dashboard

---

## Løsning

### Fil 1: `src/hooks/usePositionPermissions.ts`

Tilføj den manglende permission (efter linje 524):

```typescript
// Dashboards menu
canViewDashboardCphSales: canView("menu_dashboard_cph_sales"),
canViewDashboardCsTop20: canView("menu_dashboard_cs_top_20"),  // ← TILFØJ
canViewDashboardFieldmarketing: canView("menu_dashboard_fieldmarketing"),
// ... resten
```

### Fil 2: `src/components/layout/AppSidebar.tsx`

Ret permission-check for CS Top 20 (linje 1201):

**Før:**
```typescript
{p.canViewDashboardCphSales && (
  <NavLink to="/dashboards/cs-top-20" ...>
    CS Top 20
  </NavLink>
)}
```

**Efter:**
```typescript
{p.canViewDashboardCsTop20 && (
  <NavLink to="/dashboards/cs-top-20" ...>
    CS Top 20
  </NavLink>
)}
```

---

## Hvorfor Virker det i Dashboard-Dropdown?

`DashboardHeader.tsx` bruger en smartere, dynamisk tilgang:

```typescript
const accessibleDashboards = useMemo(() => {
  return DASHBOARD_LIST.filter(dashboard => {
    if (!dashboard.permissionKey) return true;
    return canView(dashboard.permissionKey);  // ← Direkte check
  });
}, [canView]);
```

Den itererer over `DASHBOARD_LIST` fra `src/config/dashboards.ts` og tjekker hver permission key direkte. Derfor virker det korrekt der.

---

## Anbefaling: Fremtidig Forbedring

For at undgå lignende fejl i fremtiden kunne sidebaren også bruge en dynamisk tilgang baseret på `DASHBOARD_LIST`, ligesom `DashboardHeader` gør. Dette ville sikre at nye dashboards automatisk vises korrekt begge steder.

---

## Implementeringsrækkefølge

1. Tilføj `canViewDashboardCsTop20` til `usePositionPermissions.ts`
2. Ret permission-check i `AppSidebar.tsx` fra `canViewDashboardCphSales` til `canViewDashboardCsTop20`
3. Test at CS Top 20 nu vises korrekt i sidebaren for brugere med den rette permission
