

## Tilfoej "Min vagtplan" til rettighedssystemet

### Problem
`menu_fm_my_schedule` er registreret i `permissionKeys.ts` (som rettighedseditoren bruger), men mangler i `permissions.ts` (som bruges til ejers automatiske rettigheder og RolePreview). Derudover er rettigheden ikke blevet seedet til eksisterende roller, fordi den blev tilføjet efter roller allerede var oprettet.

### Aendringer

**1. `src/config/permissions.ts`** - Tilfoej `menu_fm_my_schedule` under FIELDMARKETING-sektionen
- Placeres som foerste element i `menu_fieldmarketing` permissions-arrayet
- Label: "Min vagtplan", description: "Adgang til personlig vagtplan"
- `hasEditOption: false` (read-only)

**2. `src/pages/RolePreview.tsx`** - Tilfoej `menu_fm_my_schedule: true` i `generateAllPermissions()`
- Sikrer at ejere ser menupunktet i preview-tilstand

**3. Database seed** - Indsaet rettigheden for relevante roller
- Brug insert-tool til at tilfoeje `menu_fm_my_schedule` med `can_view = true` for rollerne: `fm_medarbejder_`, `fm_leder`, `assisterende_teamleder_fm`, `ejer`, `teamleder`, `medarbejder`, `backoffice`
- Saetter `can_edit = false` (read-only vagtplan)
- Saetter `parent_key = menu_section_fieldmarketing`

Efter disse aendringer vil rettigheden vaere synlig i rettighedseditoren og automatisk tildelt de relevante roller.

