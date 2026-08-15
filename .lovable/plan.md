# Ny menupunkt: "TDC Erhverv - ret salg"

Tilføjer et nyt punkt nederst i Rapporter-menuen (under Annulleringer) med ikon, som fører til en tom placeholder-side klar til indhold senere.

## Hvad der bygges

- Nyt menupunkt "TDC Erhverv - ret salg" nederst i Rapporter, ikon: `PencilLine` (redigering af salg).
- Ny side på `/reports/tdc-erhverv-edit-sales` med standard-layout, overskrift og en tom kort-boks ("Indhold tilføjes").
- Adgang styres af permission-systemet som de øvrige rapportpunkter — ny nøgle `menu_reports_tdc_edit_sales`.

## Teknisk

1. `src/config/permissionKeys.ts` + `src/config/permissions.ts`: ny nøgle `menu_reports_tdc_edit_sales` (label "TDC Erhverv - ret salg", section `reports`, parent `menu_section_reports`).
2. `src/hooks/usePositionPermissions.ts`: eksponer `canViewReportsTdcEditSales`.
3. `src/pages/reports/TdcErhvervEditSales.tsx`: ny placeholder-side (MainLayout + Card).
4. `src/routes/pages.ts` + `src/routes/config.tsx`: lazy-import og rute `/reports/tdc-erhverv-edit-sales` med `positionPermission: "menu_reports_tdc_edit_sales"`.
5. `src/components/layout/AppSidebar.tsx`: NavLink nederst i Rapporter-blokken (efter Annulleringer), samme styling som de øvrige.
6. Migration: indsæt rækker i `role_page_permissions` for `menu_reports_tdc_edit_sales` med `can_view = true` for `ejer` og `teamleder` (øvrige roller ingen adgang indtil andet aftales). Ejer har i forvejen fuld adgang via bypass.

Ingen forretningslogik eller salgsdata røres — kun navigation, rettighedsnøgle og en tom side.
