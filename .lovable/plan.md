
# Plan: Auto-opdatering af Dashboard Rettigheder

## Problem

Dashboard-rettighederne på forsiden opdaterer ikke automatisk når de ændres i permission-tabben, fordi:

1. **Komponenten er ikke aktiv** - `DashboardHome` er ikke mounted når du er på `/employees?tab=permissions`
2. **5 minutters cache** - `staleTime: 5 * 60 * 1000` betyder data betragtes som "frisk" i 5 minutter
3. **Query key matcher ikke helt** - Der mangler potentielle bruger-dependencies i invalidation

---

## Løsning

### 1. Reducer staleTime for accessible-dashboards

Reducer cache-tiden så data refetches hurtigere:

```typescript
// useTeamDashboardPermissions.ts
export function useAccessibleDashboards() {
  // ...
  return useQuery({
    // ...
    staleTime: 30 * 1000, // 30 sekunder i stedet for 5 minutter
    refetchOnMount: true, // Refetch når komponenten mounts
  });
}
```

### 2. Forbedret invalidation

Brug `invalidateQueries` med `refetchType: 'all'` for at sikre at ALLE matchende queries refetches - også inactive:

```typescript
// useTeamDashboardPermissions.ts
onSuccess: () => {
  queryClient.invalidateQueries({ 
    queryKey: ["team-dashboard-permissions"],
    refetchType: 'all' 
  });
  queryClient.invalidateQueries({ 
    queryKey: ["accessible-dashboards"],
    refetchType: 'all'  // Refetch også inactive queries
  });
},
```

### 3. Fix batch mutation for setAllTeams

Brug `Promise.all` for at vente på alle mutationer:

```typescript
// DashboardPermissionsTab.tsx
const setAllTeams = async (dashboardSlug: string, level: DashboardAccessLevel) => {
  const teamsToUpdate = teams.filter(
    team => getPermission(team.id, dashboardSlug) !== level
  );
  
  if (teamsToUpdate.length === 0) return;
  
  try {
    await Promise.all(
      teamsToUpdate.map(team => 
        updatePermission.mutateAsync({ teamId: team.id, dashboardSlug, accessLevel: level })
      )
    );
    toast({
      title: "Alle teams opdateret",
      description: `${teamsToUpdate.length} teams sat til "${accessLevels.find(l => l.value === level)?.label}"`,
    });
  } catch (error) {
    toast({
      title: "Fejl",
      description: "Nogle rettigheder kunne ikke opdateres",
      variant: "destructive",
    });
  }
};
```

---

## Filer der ændres

| Fil | Ændring |
|-----|---------|
| `src/hooks/useTeamDashboardPermissions.ts` | Reducer staleTime, tilføj `refetchType: 'all'` |
| `src/components/dashboard/DashboardPermissionsTab.tsx` | Fix `setAllTeams` til at bruge `Promise.all` |

---

## Alternativ: Real-time updates (Avanceret)

For øjeblikkelige opdateringer kunne vi tilføje Supabase Realtime subscription:

```typescript
useEffect(() => {
  const subscription = supabase
    .channel('team-dashboard-permissions')
    .on('postgres_changes', 
      { event: '*', schema: 'public', table: 'team_dashboard_permissions' },
      () => queryClient.invalidateQueries({ queryKey: ["accessible-dashboards"] })
    )
    .subscribe();
    
  return () => subscription.unsubscribe();
}, []);
```

Dette kræver at tabellen tilføjes til realtime publication i databasen.

---

## Forventet resultat

Efter ændringerne vil:
- Dashboard-forsiden automatisk refetche rettigheder når den mounts
- Cache-tiden reduceres fra 5 min til 30 sek
- Batch-opdateringer venter på alle mutationer er færdige
- (Valgfrit) Real-time sync giver øjeblikkelige opdateringer
