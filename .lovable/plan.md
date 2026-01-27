

# Problem: William Bornak kan ikke se Bookinger - Root Cause Analysis

## Årsag identificeret

Problemet er **24-timers localStorage caching** i `usePositionPermissions.ts`:

```typescript
const PERMISSIONS_CACHE_KEY = 'cached-permissions-v1';
const CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours
```

### Hvad skete der

1. Før rettelsen blev `role_page_permissions` kun hentet med max 1000 rækker (Supabase default limit)
2. `tab_fm_bookings` for `fm_leder` ligger på række 1062 - uden for de første 1000
3. William Bornaks browser cachede de ufuldstændige permissions i localStorage
4. Selvom koden nu er rettet med `.range(0, 2000)`, bruger hans browser stadig den gamle cache

### Databasen er korrekt

Verificeret at `fm_leder` har alle nødvendige permissions:
- `menu_fm_booking`: can_view=true, can_edit=true
- `tab_fm_bookings`: can_view=true, can_edit=true
- `tab_fm_book_week`: can_view=true, can_edit=true
- Alle andre FM-relaterede permissions er korrekte

## Løsninger

### Umiddelbar fix (anbefalet)
Bed William Bornak om at:
1. Gå til login-siden (/auth)
2. Klik på "Ryd cache og genindlæs" knappen (findes allerede)

Alternativt: Ryd localStorage manuelt i browserens Developer Tools.

### Systemisk fix (plan)
For at forhindre lignende problemer i fremtiden:

**Opdatér cache-versionen** når permission-systemet ændres:
- Ændre `cached-permissions-v1` til `cached-permissions-v2` i `usePositionPermissions.ts`
- Dette vil tvinge alle brugere til at hente friske permissions ved næste login

**Kodeændringer:**

```
Fil: src/hooks/usePositionPermissions.ts
Linje 91

FØR:
const PERMISSIONS_CACHE_KEY = 'cached-permissions-v1';

EFTER:
const PERMISSIONS_CACHE_KEY = 'cached-permissions-v2';
```

### Teknisk detalje

Systemet har to parallelle cache-lag:
1. React Query cache (15 min) - ryddes ved refresh
2. localStorage cache (24 timer) - persisterer på tværs af sessioner

Ved at bumpe cache-versionen vil den gamle `v1` cache ignoreres, og brugere vil automatisk hente friske data.

## Implementeringsplan

1. Opdatér cache-nøglen fra `v1` til `v2` i `usePositionPermissions.ts`
2. Alle brugere vil automatisk få friske permissions ved næste besøg
3. Ingen manuel intervention nødvendig for individuelle brugere

## Risiko

Meget lav risiko - dette er en simpel ændring der kun påvirker cache-invalidering. Alle brugere vil opleve en enkelt ekstra database-forespørgsel ved deres næste login.

