

## Tilføj altid-synlig "Dashboards"-knap på desktop

### Problemet
Når Jacob (og andre med dashboard-adgang) kollapser sidebaren på PC, forsvinder "Dashboards"-knappen helt, fordi den lever inde i `AppSidebar`. På mobil ligger den i den faste topbar og er derfor altid synlig.

### Løsningen
Tilføj `EnvironmentSwitcher` til den eksisterende kollapsede topbar-zone i `MainLayout.tsx`, lige ved siden af `PanelLeft`-udfoldknappen. Komponenten skjuler sig selv hvis brugeren ikke har dashboard-adgang, så ingen ekstra checks er nødvendige.

### Implementering i `src/components/layout/MainLayout.tsx`

Den nuværende kollapsede knap (linje 69-78) står alene i `top-4 left-4`. Jeg ændrer det til en lille flex-container på samme position der indeholder:
1. Den eksisterende `PanelLeft`-knap (udfold sidebar)
2. En ny `<EnvironmentSwitcher compact />` til højre for den

Begge sidder samlet i top-venstre hjørnet, kun synlige på desktop når `isCollapsed === true`. Knappen ligger ved siden af — ikke ovenpå — den sammenklappede menu, så de ikke overlapper.

### Hvad jeg ikke rører
- `AppSidebar` (den udfoldede placering forbliver uændret)
- `DashboardSidebar` / dashboard-layoutet
- Mobil-headeren
- Permissions / `useAccessibleDashboards`

### Verificering
- Jacob på PC med kollapset sidebar → ser både udfold-knap og "Dashboards"-knap øverst til venstre
- Bruger uden dashboard-adgang → ser kun udfold-knappen (EnvironmentSwitcher returnerer `null`)
- Udfoldet sidebar → uændret, knap ligger som før inde i sidebaren
- Mobil → uændret

