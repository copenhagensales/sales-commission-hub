
# Fix: Adgangsproblem for William Bornak og Thomas Wehage på Booking-siden

## Problem Identificeret

Brugerne ser "Du har ikke adgang til denne side" selvom de har korrekte permissions i databasen.

### Årsag
Der er to forskellige permission hooks i systemet som ikke er synkroniserede:

1. **Rute-beskyttelse** (`RoleProtectedRoute`) bruger `usePositionPermissions` 
   - Checker `menu_fm_booking` → Giver adgang ✅

2. **Booking-komponenten** bruger `useUnifiedPermissions`
   - Checker tab-permissions (`tab_fm_bookings`, etc.)
   - Har en race condition: `isLoading=false` KAN forekomme FØR `pagePermissions` er klar
   - Resulterer i at `canView()` returnerer `false` → viser fejlbesked ❌

### Berørte sider
- `/vagt-flow/booking` (BookingManagement)
- Winback, Onboarding Dashboard, Fieldmarketing Dashboard (samme mønster)

## Løsning

### Trin 1: Ret `useUnifiedPermissions` hook

Tilføj robust loading-håndtering ligesom `usePositionPermissions`:

```typescript
// I useUnifiedPermissions.ts
export function useUnifiedPermissions() {
  const { user } = useAuth();
  const { data: currentRole, isLoading: roleLoading, isFetched: roleFetched } = useCurrentUserRole();
  const { data: pagePermissions, isLoading: permissionsLoading, isFetched: permissionsFetched } = usePagePermissions();
  
  // isLoading: Still fetching initial data
  const isLoading = roleLoading || permissionsLoading;
  
  // isReady: Data is ACTUALLY available for use
  // This prevents race conditions where isLoading=false but data is undefined
  const isReady = roleFetched && permissionsFetched && !!currentRole && !!pagePermissions;
  
  // ... rest of hook
  
  return {
    isLoading,
    isReady, // <-- Ny property
    // ...
  };
}
```

### Trin 2: Opdater BookingManagement komponenten

Brug `isReady` i stedet for kun `isLoading`:

```typescript
// I BookingManagement.tsx
const { canView, isLoading, isReady } = useUnifiedPermissions();

// Vis loading indtil data er FAKTISK tilgængelig
if (isLoading || !isReady) {
  return <Loader />;
}

// Nu er det sikkert at tjekke visibleTabs
if (visibleTabs.length === 0) {
  return "Du har ikke adgang...";
}
```

### Trin 3: Tilføj debugging logs

For at kunne verificere at rettelsen virker:

```typescript
console.log('[BookingManagement] Permission check:', {
  role: role,
  isLoading,
  isReady,
  pagePermissionsCount: pagePermissions?.length,
  tabChecks: allTabs.map(t => ({ key: t.permissionKey, hasAccess: canView(t.permissionKey) }))
});
```

## Tekniske detaljer

### Hvorfor sker dette?
React Query's `isLoading` flag indikerer kun "første gang loading" - ikke "data er tilgængelig". Når en bruger hard-refresher:

1. Cache ryddes
2. Queries starter
3. `isLoading` kan skifte til `false` før `data` er populated
4. Komponenten renderer med tomt `pagePermissions` array
5. `canView()` returnerer `false` for alt
6. Brugeren ser fejlbesked

### Verificering
Efter implementering kan vi teste ved at:
1. Logge ind som William Bornak
2. Navigere til `/vagt-flow/booking`
3. Verificere at alle 5 tabs vises korrekt
4. Hard-refresh (Ctrl+Shift+R) og verificere at siden stadig virker

## Filændringer

| Fil | Handling |
|-----|----------|
| `src/hooks/useUnifiedPermissions.ts` | Tilføj `isReady` flag og `isFetched` checks |
| `src/pages/vagt-flow/BookingManagement.tsx` | Brug `isReady` i loading check |
| Potentielt: Winback.tsx, OnboardingDashboard.tsx, FieldmarketingDashboardFull.tsx | Samme mønster |
