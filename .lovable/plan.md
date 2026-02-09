

# Plan: Fix Dashboard Access Race Condition

## Problemanalyse

Der er et timing/race condition problem i dashboard-adgangssystemet som forhindrer medarbejdere i at se deres tildelte dashboards.

### Hvad går galt

1. Brugeren (f.eks. Matias) navigerer til `/dashboards/tdc-erhverv`
2. `useRequireDashboardAccess("tdc-erhverv")` køres
3. Den kalder `useCanViewDashboard` og `useAccessibleDashboards` separat
4. Pga. timing-forskelle returnerer `useCanViewDashboard` `false` FØR dataen er klar
5. `useRequireDashboardAccess` ser `isLoading: false` og `canView: false`
6. Den viser toast "Du har ikke adgang" og redirecter til `/dashboards`

### Teknisk årsag

I `useCanViewDashboard` (linje 271-281):
```typescript
export function useCanViewDashboard(dashboardSlug: string): boolean {
  const { data: accessibleDashboards = [], isLoading } = useAccessibleDashboards();
  const { isOwner } = useUnifiedPermissions();
  
  if (isOwner) return true;
  if (isLoading) return false;  // ← Problemet!
  
  return accessibleDashboards.some(d => d.slug === dashboardSlug);
}
```

Når `isLoading` er `true`, returneres `false` i stedet for at indikere "ukendt tilstand". 

I `useAccessibleDashboards` (linje 264):
```typescript
enabled: !!user && !unifiedLoading
```

Queryen afhænger af `unifiedLoading` fra `useUnifiedPermissions`, men bruger ikke `isReady`. Det betyder queryen kan køre mens `isOwner` stadig har sin default værdi.

---

## Løsning

### Ændring 1: `useCanViewDashboard` skal returnere et objekt med loading state

Fra:
```typescript
export function useCanViewDashboard(dashboardSlug: string): boolean
```

Til:
```typescript
export function useCanViewDashboard(dashboardSlug: string): { canView: boolean; isLoading: boolean }
```

### Ændring 2: Brug `isReady` i stedet for `isLoading` i `useAccessibleDashboards`

Sikre at queryen IKKE kører før `useUnifiedPermissions` er fuldt klar:

```typescript
const { isOwner, isLoading: unifiedLoading, isReady } = useUnifiedPermissions();
// ...
enabled: !!user && isReady,  // ← Brug isReady i stedet for !unifiedLoading
```

### Ændring 3: Opdater `useRequireDashboardAccess` til at håndtere begge loading states

```typescript
export function useRequireDashboardAccess(dashboardSlug: string) {
  const navigate = useNavigate();
  const { canView, isLoading: canViewLoading } = useCanViewDashboard(dashboardSlug);
  const { isLoading, data: accessibleDashboards = [] } = useAccessibleDashboards();

  // Kombiner begge loading states
  const isFullyLoaded = !canViewLoading && !isLoading;

  useEffect(() => {
    if (isFullyLoaded && !canView) {
      toast.error("Du har ikke adgang til dette dashboard");
      // ... redirect logic
    }
  }, [isFullyLoaded, canView, navigate, accessibleDashboards]);

  return { canView, isLoading: !isFullyLoaded };
}
```

---

## Filer der ændres

| Fil | Ændring |
|-----|---------|
| `src/hooks/useTeamDashboardPermissions.ts` | Opdater `useCanViewDashboard` til at returnere objekt med loading state; Brug `isReady` i `useAccessibleDashboards` |
| `src/hooks/useRequireDashboardAccess.ts` | Håndter nye return type fra `useCanViewDashboard` |
| `src/hooks/useUnifiedPermissions.ts` | Eksporter `isReady` (allerede eksporteret, men verificer) |

---

## Teknisk Implementation

### useTeamDashboardPermissions.ts

```typescript
// Opdater useAccessibleDashboards (linje 165-268)
export function useAccessibleDashboards() {
  const { user } = useAuth();
  const { isOwner, isReady } = useUnifiedPermissions();  // ← Brug isReady
  const { data: assistantRelations } = useTeamAssistantLeaders();
  
  return useQuery({
    queryKey: ["accessible-dashboards", user?.id, isOwner],
    queryFn: async () => {
      // ... eksisterende queryFn
    },
    enabled: !!user && isReady,  // ← Vent på isReady
    staleTime: 30 * 1000,
    refetchOnMount: true,
  });
}

// Opdater useCanViewDashboard (linje 270-281)
export function useCanViewDashboard(dashboardSlug: string): { canView: boolean; isLoading: boolean } {
  const { data: accessibleDashboards = [], isLoading } = useAccessibleDashboards();
  const { isOwner, isReady } = useUnifiedPermissions();
  
  // Ikke klar endnu
  if (!isReady || isLoading) {
    return { canView: false, isLoading: true };
  }
  
  // Ejere har altid adgang
  if (isOwner) {
    return { canView: true, isLoading: false };
  }
  
  const canView = accessibleDashboards.some(d => d.slug === dashboardSlug);
  return { canView, isLoading: false };
}
```

### useRequireDashboardAccess.ts

```typescript
export function useRequireDashboardAccess(dashboardSlug: string) {
  const navigate = useNavigate();
  const { canView, isLoading: canViewLoading } = useCanViewDashboard(dashboardSlug);
  const { isLoading: accessLoading, data: accessibleDashboards = [] } = useAccessibleDashboards();

  const isLoading = canViewLoading || accessLoading;

  useEffect(() => {
    if (!isLoading && !canView) {
      toast.error("Du har ikke adgang til dette dashboard");
      
      if (accessibleDashboards.length > 0) {
        navigate(accessibleDashboards[0].path, { replace: true });
      } else {
        navigate("/dashboards", { replace: true });
      }
    }
  }, [isLoading, canView, navigate, accessibleDashboards]);

  return { canView, isLoading };
}
```

---

## Forventet resultat

- Medarbejdere som Matias ser nu korrekt deres tildelte dashboards (TDC Erhverv, CS Top 20)
- Ingen falske "Du har ikke adgang" toasts
- Loading spinner vises korrekt mens data indlæses
- Ejere har stadig fuld adgang til alle dashboards

