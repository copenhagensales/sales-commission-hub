# Nyt menupunkt: "Tryg - Ret salg"

Tilføjer et nyt punkt i Rapporter-menuen lige under "TDC Erhverv - ret salg", som fører til en tom placeholder-side. Indholdet prompter vi bagefter.

## Adgang

Kun ejere samt Filip Kirketerp Møller og Annika Søndergaard. Deres adresser findes allerede i den eksisterende allowlist (`src/config/bulkSalesAccess.ts`: `fk@copenhagensales.dk`, `filipkirketerp@gmail.com`, `anni@copenhagensales.dk`, `sondergaardannika@gmail.com`), så adgangen genbruger den liste — ingen nye hardkodede navne.

Gating sker to steder: menupunktet vises kun for dem, og selve siden viser en "ingen adgang"-besked for alle andre.

## Teknisk

1. Ny rettighedsnøgle `menu_reports_tryg_edit_sales` i `src/config/permissionKeys.ts` (label "Tryg - Ret salg", section `reports`, parent `menu_section_reports`) og i `src/config/permissions.ts` — samme mønster som `menu_reports_tdc_edit_sales`.
2. `src/hooks/usePositionPermissions.ts`: eksponer `canViewReportsTrygEditSales` / `canEditReportsTrygEditSales`.
3. Ny hook `src/hooks/useTrygEditAccess.ts`: adgang = ejer (`is_owner`) ELLER e-mail i `BULK_SALES_EMAILS`. Bruges af både sidebar og side.
4. Ny side `src/pages/reports/TrygEditSales.tsx`: `MainLayout` + overskrift "Tryg - Ret salg" + tom Card ("Indhold tilføjes"). Uden adgang: kort besked i stedet.
5. Rute i `src/routes/pages.ts` + `src/routes/config.tsx`: `/reports/tryg-edit-sales`, `access: "role"`, `positionPermission: "menu_reports_tryg_edit_sales"`.
6. `src/components/layout/AppSidebar.tsx`: NavLink umiddelbart efter TDC-punktet, ikon `PencilLine`, samme styling.
7. Migration: rækker i `role_page_permissions` for `menu_reports_tryg_edit_sales` med `can_view = true` for `ejer`. Øvrige roller ingen adgang; Filip og Annika får adgang via allowlist-tjekket, som også gælder for menuvisningen.

Ingen salgsdata, pricing, provision eller lønlogik røres — kun navigation, rettighedsnøgle og en tom side.
