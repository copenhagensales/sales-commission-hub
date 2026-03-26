

## Adgangsstyring for Powerdag Board

### Mål
- Alle autentificerede brugere kan **se** Powerdag-boardet (forsiden)
- Kun teamledere, assisterende teamledere, rekruttering og SOME kan **rette** (se "Indtast salg"-knappen og tilgå input/admin-siderne)
- Ejere har altid fuld adgang

### Ændringer

**1. Tilføj permission keys (`src/config/permissionKeys.ts`)**
- Tilføj `menu_powerdag_input` under dashboards-sektionen med label "Powerdag Indtastning"

**2. Opdater routes (`src/routes/config.tsx`)**
- Powerdag board (`/dashboards/powerdag`) forbliver `access: "protected"` — alle kan se
- Powerdag input (`/dashboards/powerdag/input`) ændres til `access: "role", positionPermission: "menu_powerdag_input"`
- Powerdag admin (`/dashboards/powerdag/admin`) ændres til `access: "role", positionPermission: "menu_powerdag_input"`

**3. Skjul "Indtast salg"-knappen for sælgere (`src/pages/dashboards/PowerdagBoard.tsx`)**
- Importer `useUnifiedPermissions`
- Brug `canView("menu_powerdag_input")` til at betinget vise "Indtast salg"-knappen og TV-generator
- Sælgere ser kun boardet uden redigeringsknapper

### Opsætning efter deploy
Du skal tildele `menu_powerdag_input` rettigheden (can_view = true) til rollerne: `teamleder`, `assisterende_teamleder_fm`, `rekruttering`, `some` og `ejer` via Rettighedseditoren (/employees/permissions).

