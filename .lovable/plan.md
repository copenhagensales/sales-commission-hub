

## Fix: Auto-opret manglende permission-rækker ved klik

### Problem
Når en permission-key er defineret i `permissionKeys.ts` men ikke har en tilsvarende række i `role_page_permissions` for en given rolle, vises en grå dot med "Ingen permission-række" og man kan ikke ændre adgangen.

### Løsning
Gør de "tomme" dots klikbare: når man klikker, oprettes rækken automatisk via `INSERT` og det valgte adgangsniveau sættes med det samme.

### Ændringer

**Fil: `src/components/employees/permissions/PermissionMap.tsx`**

1. Tilføj en ny funktion `handleCreateAndSetAccess(roleKey, permKey, parentKey, level)` der:
   - Kører `supabase.from('role_page_permissions').insert({ role_key, permission_key, parent_key, permission_type: 'page', can_view, can_edit, visibility })`
   - Invaliderer `['page-permissions']` cache
   - Viser toast

2. Erstat den passive `<Tooltip><span cursor-not-allowed>` (linje 182-190) med en `<Popover>` der viser samme 4 adgangsniveauer som de eksisterende dots — men kalder `handleCreateAndSetAccess` i stedet for `handleUpdateAccess`

3. Den visuelle dot ændres fra `opacity-50 cursor-not-allowed` til `cursor-pointer` med en stiplet border for at indikere "kan oprettes"

### Resultat
- Alle dots i kortet bliver klikbare
- Manglende rækker oprettes on-demand med det valgte adgangsniveau
- Ændringer synkroniseres automatisk med "Rediger"-fanen via query invalidation
- Ingen bulk-migration nødvendig — rækker oprettes præcis når de behøves

### Risiko
**Lav** — bruger samme tabel og RLS-regler som eksisterende insert-logik i PermissionEditor.

