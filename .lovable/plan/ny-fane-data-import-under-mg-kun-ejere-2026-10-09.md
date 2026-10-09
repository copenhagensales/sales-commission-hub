# Ny fane "Data import" under MG (kun ejere)

## Hvad der bygges
- Nyt menupunkt "Data import" under MG-menuen, lige under "MG Test".
- Ny side på `/mg/data-import` med en enkel placeholder: titel "Data import" og teksten "Indhold kommer snart."
- Kun ejere kan se menupunktet og åbne siden. Andre, der går direkte til adressen, afvises som ved andre beskyttede sider.

## Teknisk
- `src/config/permissionKeys.ts` (rød zone, godkendes med denne plan): ny nøgle `menu_mg_data_import` med parent `menu_section_mg`. Ejer får den automatisk via den eksisterende ejer-bypass; der gives ingen andre roller adgang (ingen rækker i `role_page_permissions`).
- `src/routes/config.tsx`: rute `{ path: "/mg/data-import", access: "role", positionPermission: "menu_mg_data_import" }`, samme mønster som `/mg-test`.
- `src/pages/mg/DataImport.tsx`: placeholderside, ingen datakald.
- `src/components/layout/AppSidebar.tsx`: NavLink under MG styret af `p.canView("menu_mg_data_import")`; MG-menuen vises også, når kun denne er tilladt. Ingen hardkodet rolle-tjek.
- Ingen databaseændringer, ingen ændringer i andre rettigheder.

## Test
- Typecheck, og kontrol i browser som ejer, at fanen vises og siden åbner.
