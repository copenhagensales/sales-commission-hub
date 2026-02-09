
# Plan: Fix Dashboard Navigation Between Accessible Dashboards

## Problemanalyse

Mathias har adgang til to dashboards (TDC Erhverv + CS Top 20), men får fejl når han prøver at skifte mellem dem.

### Årsagen
Når Mathias navigerer fra `/dashboards/tdc-erhverv` til `/dashboards/cs-top-20`:

1. Den nye dashboard-komponent mountes med `useRequireDashboardAccess("cs-top-20")`
2. `useAccessibleDashboards()` har **allerede cached data** fra forrige dashboard
3. Queryen returnerer `isLoading: false` med cached data
4. `useEffect` i `useRequireDashboardAccess` kører og ser `!isLoading && !canView`
5. Der vises fejl-toast og redirect sker

### Teknisk årsag
`useEffect` i `useRequireDashboardAccess` har ikke `dashboardSlug` som dependency, hvilket betyder:
- Effekten kører ved HVER mount
- Den sammenligner mod et potentielt stale `canView` resultat
- Navigation mellem to tilgængelige dashboards udløser falsk "ingen adgang" fejl

---

## Løsning

### Tilgang 1: Tilføj stabilitet med refs og slug-dependency

Opdater `useRequireDashboardAccess` til at:
1. Tracke det aktuelle `dashboardSlug` via ref
2. Kun redirect når slug er stabil OG data matcher
3. Nulstille redirect-logik ved slug-ændring

### Ændringer

**Fil: `src/hooks/useRequireDashboardAccess.ts`**

```typescript
import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useCanViewDashboard, useAccessibleDashboards } from "@/hooks/useTeamDashboardPermissions";
import { toast } from "sonner";

export function useRequireDashboardAccess(dashboardSlug: string) {
  const navigate = useNavigate();
  const { canView, isLoading: canViewLoading } = useCanViewDashboard(dashboardSlug);
  const { isLoading: accessLoading, data: accessibleDashboards = [] } = useAccessibleDashboards();

  // Track the slug to detect navigation between dashboards
  const currentSlugRef = useRef(dashboardSlug);
  const hasRedirectedRef = useRef(false);

  // Reset redirect flag when slug changes (user navigated to new dashboard)
  useEffect(() => {
    if (currentSlugRef.current !== dashboardSlug) {
      currentSlugRef.current = dashboardSlug;
      hasRedirectedRef.current = false;
    }
  }, [dashboardSlug]);

  const isLoading = canViewLoading || accessLoading;

  useEffect(() => {
    // Don't redirect if already redirected for this slug
    if (hasRedirectedRef.current) return;
    
    // Only redirect after data is fully loaded and we confirm no access
    if (!isLoading && !canView) {
      hasRedirectedRef.current = true;
      toast.error("Du har ikke adgang til dette dashboard");
      
      if (accessibleDashboards.length > 0) {
        navigate(accessibleDashboards[0].path, { replace: true });
      } else {
        navigate("/dashboards", { replace: true });
      }
    }
  }, [isLoading, canView, navigate, accessibleDashboards, dashboardSlug]);

  return { canView, isLoading };
}
```

---

## Forventet resultat

| Scenario | Før | Efter |
|----------|-----|-------|
| Mathias navigerer TDC → CS Top 20 | ❌ "Ingen adgang" toast, redirect | ✅ Smooth navigation |
| Bruger uden adgang åbner dashboard | ✅ Redirect virker | ✅ Redirect virker |
| Reload på dashboard man har adgang til | ✅ Dashboard vises | ✅ Dashboard vises |

---

## Implementeringsplan

| Trin | Fil | Handling |
|------|-----|----------|
| 1 | `src/hooks/useRequireDashboardAccess.ts` | Tilføj refs til at tracke slug og redirect-status |
| 2 | Test | Verificer navigation mellem TDC Erhverv og CS Top 20 |
