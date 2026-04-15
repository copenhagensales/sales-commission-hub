

## Problem

`CsTop20Dashboard` kalder `useRequireDashboardAccess("cs-top-20")` på linje 118. Denne hook kræver en autentificeret bruger for at tjekke team-baserede tilladelser. I TV-mode er der ingen session, så hooket returnerer `canView: false` og redirecter dashboardet til `/dashboards`.

## Løsning

Skip adgangstjekket når dashboardet kører i TV-mode. TV-adgang er allerede verificeret via access-koden i `TvBoardDirect.tsx`.

### Ændring

**File: `src/pages/CsTop20Dashboard.tsx`** (linje 118)

Ændr fra:
```tsx
const { canView, isLoading: accessLoading } = useRequireDashboardAccess("cs-top-20");
```

Til:
```tsx
const { canView, isLoading: accessLoading } = useRequireDashboardAccess("cs-top-20", { skip: tvMode });
```

**File: `src/hooks/useRequireDashboardAccess.ts`**

Tilføj en `skip` option der deaktiverer redirectet og returnerer `canView: true` med det samme. Dette sikrer at TV-dashboards aldrig bliver blokeret af bruger-auth.

