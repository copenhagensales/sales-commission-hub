# Rasmus Emil Hansen ser ikke "TDC Erhverv - ret salg" i Rapporter

## Hvad der er verificeret i databasen

- Rasmus Emil Hansen (`rh@copenhagensales.dk`, privat `rasmus@bjerrum.nu`) er aktiv, `position_id` peger på Teamleder, og `job_positions.system_role_key = 'teamleder'`.
- `role_page_permissions` har `menu_reports_tdc_edit_sales` med `can_view = true, can_edit = true` for `ejer`, `teamleder` og `assisterendetm` (rækkerne blev oprettet 15/8 22:53).
- RLS på `role_page_permissions` tillader alle authenticated at læse rækkerne.
- Menupunktet i `AppSidebar.tsx:1361` er kun gated af `p.canViewReportsTdcEditSales` inde i Rapporter-blokken, og `sidebar_menu_config` indeholder ingen række der skjuler det.

Konklusion: rettighedsdataene er korrekte for hans rolle. Årsagen til at han ikke ser punktet er derfor **ikke bekræftet endnu** — den mest sandsynlige forklaring er klient-side cache af rettigheder (`localStorage`-nøglen `cached-permissions-v5` + React Query `staleTime` 15 min), men det skal verificeres før vi ændrer noget.

## Plan

1. **Verificér først (ingen kodeændring).** Log preview ind som Rasmus og læs den faktisk resolvede rolle og rettighed:
   - Bekræft `usePositionPermissions`-loggen viser `roleKey: teamleder`.
   - Bekræft om `menu_reports_tdc_edit_sales` findes i det hentede permission-objekt.
   - Bekræft om Rapporter-menuen i det hele taget vises for ham.
2. **Fix afhængigt af resultat:**
   - Hvis rettigheden er der, men punktet mangler i UI: fejlen ligger i sidebar-gaten — rettes der.
   - Hvis rettigheden mangler i det hentede objekt, mens DB har den: det er stale cache. Fix = bump cache-nøglen til `cached-permissions-v6` i `src/hooks/usePositionPermissions.ts` (og ryd v5), så alle brugere får friske rettigheder ved næste load.
   - Hvis rollen resolver til noget andet end `teamleder`: rettes i hans position/rolle-opsætning, ikke i koden.
3. **Efterprøv** at han både ser menupunktet og kan åbne siden med indhold (han står allerede på allowlisten i `src/config/tdcErhvervEditAccess.ts`, så indholdsgaten burde være åben).

## Uden for scope

Ingen ændring af pricing, løn, salgsdata eller andre rollers rettigheder.
