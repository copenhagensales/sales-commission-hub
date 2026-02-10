
# Fieldmarketing Rettighedsfix - Komplet Plan

## Identificerede Problemer

### Problem 1: Kritisk - Forkert rollemapping i useUnifiedPermissions
I filen `useUnifiedPermissions.ts` (linje 129) matcher "Assisterende Teamleder FM" det generiske `includes('teamleder')`-tjek foer det specifikke FM-tjek. Dette betyder at Assisterende Teamleder FM faar `teamleder`-rettigheder i stedet for `assisterende_teamleder_fm`-rettigheder.

`usePositionPermissions.ts` haandterer dette korrekt (linje 67 tjekker foer linje 73), men `useUnifiedPermissions.ts` har fejlen.

**Fix**: Tilfoej specifik check for "assisterende teamleder fm" FOER den generiske `includes('teamleder')` check.

### Problem 2: Manglende permission-raekkker i databasen
Foelgende permission keys mangler helt for `fm_leder` og `assisterende_teamleder_fm`:

| Permission Key | fm_leder | assisterende_teamleder_fm |
|---|---|---|
| `menu_fm_dashboard` | Sat til false | Mangler helt |
| `menu_fm_my_week` | Sat til false | Mangler helt |
| `menu_fm_vagtplan_fm` | Sat til false | Har can_view: true |

`menu_fm_dashboard` og `menu_fm_my_week` skal vaere aktiveret for begge roller.

### Problem 3: Sidebar mangler menupunkter
Sidebaren renderer IKKE foelgende FM-menupunkter, selvom de findes som permission keys:
- **Dashboard** (`menu_fm_dashboard`) - Der er ingen sidebar-entry der bruger denne permission. "Dashboard" linket bruger `canViewFmSalesRegistration` i stedet.
- **Vagtplan FM** (`menu_fm_vagtplan_fm`) - Ingen sidebar-entry
- **Min uge** (`menu_fm_my_week`) - Ingen sidebar-entry

Screenshottet viser at "Dashboard" bor vaere et separat menupunkt med sin egen permission.

### Problem 4: Sidebar mangler canViewFm-helpers
`usePositionPermissions.ts` returnerer IKKE `canViewFmDashboard` eller `canViewFmVagtplanFm` - disse properties mangler i return-objektet.

---

## Loesningsplan

### AEndring 1: Fix rollemapping i useUnifiedPermissions.ts
**Fil**: `src/hooks/useUnifiedPermissions.ts` (linje 124-133)

Tilfoej specifik check for "assisterende teamleder fm" foer den generiske teamleder-check:

```text
if (titleLower === 'ejer') return 'ejer';
if (titleLower === 'fieldmarketing leder') return 'fm_leder';
if (titleLower === 'assisterende teamleder fm') return 'assisterende_teamleder_fm';  // <-- NY
if (titleLower.includes('teamleder')) return 'teamleder';
if (titleLower === 'rekruttering') return 'rekruttering';
if (titleLower === 'some') return 'some';
if (titleLower === 'fieldmarketing') return 'fm_medarbejder_';
```

### AEndring 2: Database-migration - aktiver manglende permissions
Koer SQL for at aktivere de manglende/deaktiverede FM permission keys:

```text
-- Aktiver menu_fm_dashboard for fm_leder
UPDATE role_page_permissions 
SET can_view = true, can_edit = true 
WHERE role_key = 'fm_leder' AND permission_key = 'menu_fm_dashboard';

-- Aktiver menu_fm_vagtplan_fm for fm_leder
UPDATE role_page_permissions 
SET can_view = true, can_edit = true 
WHERE role_key = 'fm_leder' AND permission_key = 'menu_fm_vagtplan_fm';

-- Indsaet manglende raekkker for assisterende_teamleder_fm
INSERT INTO role_page_permissions (role_key, permission_key, can_view, can_edit, visibility)
VALUES 
  ('assisterende_teamleder_fm', 'menu_fm_dashboard', true, true, 'team'),
  ('assisterende_teamleder_fm', 'menu_fm_my_week', true, true, 'self')
ON CONFLICT DO NOTHING;
```

### AEndring 3: Tilfoej manglende sidebar-menupunkter
**Fil**: `src/components/layout/AppSidebar.tsx`

Tilfoej tre manglende menupunkter i Fieldmarketing-sektionen:
1. **Dashboard** (`canViewFmDashboard`) - peger paa `/vagt-flow/fieldmarketing-dashboard` med `menu_fm_dashboard` permission
2. **Vagtplan FM** (`canViewFmVagtplanFm`) - peger paa den relevante rute

Opdater ogsaa `showFieldmarketingMenu`-checket til at inkludere de nye permissions.

### AEndring 4: Tilfoej manglende permission helpers
**Fil**: `src/hooks/usePositionPermissions.ts`

Tilfoej de manglende `canView`/`canEdit` properties:
```text
canViewFmDashboard: canView("menu_fm_dashboard"),
canEditFmDashboard: canEdit("menu_fm_dashboard"),
canViewFmVagtplanFm: canView("menu_fm_vagtplan_fm"),
canEditFmVagtplanFm: canEdit("menu_fm_vagtplan_fm"),
```

---

## Filoversigt

| Fil | AEndring |
|---|---|
| `src/hooks/useUnifiedPermissions.ts` | Fix rollemapping for Assisterende Teamleder FM |
| `src/hooks/usePositionPermissions.ts` | Tilfoej canViewFmDashboard og canViewFmVagtplanFm |
| `src/components/layout/AppSidebar.tsx` | Tilfoej Dashboard og Vagtplan FM menupunkter |
| Database migration | Aktiver manglende permission-raekkker |

## Effekt
- Assisterende Teamleder FM faar korrekte FM-rettigheder (ikke generisk teamleder)
- Fieldmarketing leder og assistent kan se Dashboard og Vagtplan FM i sidebaren
- Alle FM-menupunkter fra screenshottet vil vaere synlige med korrekte rettigheder
- Eksisterende roller og rettigheder paavirkes ikke
