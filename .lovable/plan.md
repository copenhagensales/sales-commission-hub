

## Fix: Tilføj "Min vagtplan" til den rigtige sidebar

### Problem
"Min vagtplan" (`menu_fm_my_schedule`) er korrekt oprettet i rettighedseditoren og databasen, men **mangler i den faktiske sidebar** (`AppSidebar.tsx`) og i permission-hooket (`usePositionPermissions.ts`). Derfor vises menupunktet aldrig, uanset om rettigheden er slået til.

### Ændringer

**1. `src/hooks/usePositionPermissions.ts`** (linje ~576)
- Tilføj `canViewFmMySchedule: canView("menu_fm_my_schedule")` under Fieldmarketing-sektionen

**2. `src/components/layout/AppSidebar.tsx`**
- Tilføj `canViewFmMySchedule` til `showFieldmarketingMenu`-checken (linje ~440), så FM-sektionen vises hvis brugeren har denne rettighed
- Tilføj en NavLink til `/vagt-flow/my-schedule` med "Min vagtplan" label og `UserCheck`-ikon, placeret øverst i Fieldmarketing-menuen (før "Oversigt")

**3. Database fix**
- Opdater `fm_medarbejder_` rollen så `can_view = true` for `menu_fm_my_schedule` (den står pt. som `false` i databasen)

### Resultat
FM-medarbejdere vil kunne se "Min vagtplan" i sidebaren under Fieldmarketing og navigere til deres personlige vagtplan.
