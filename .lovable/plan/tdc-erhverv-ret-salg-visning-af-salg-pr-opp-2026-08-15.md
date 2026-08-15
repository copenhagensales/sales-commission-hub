# TDC Erhverv – ret salg: visning af salg pr. OPP

Målet i dette trin: siden `Rapporter → TDC Erhverv - ret salg` skal vise dagens TDC Erhverv-salg grupperet pr. OPP-nummer, med handlingsknapper som under Eesy FM afvigelser.

## Sådan bliver boksen

Én række pr. OPP-nummer med kolonnerne:

- OPP nr.
- Sælgernavn
- Produktnavn (inkl. antal) — alle produkter under OPP'en, fx `Professionel mobil (100GB) 0% tilskud x2, Omstilling x1`
- Handlinger (længst til højre): `Rediger` og `Slet`

Standardperiode er **i dag**, med datovælger så man kan se andre dage.

`Slet` sletter **hele OPP'en** (alle salgsrækker under nummeret) og vises kun efter en bekræftelses-popup ("Er du sikker?") — samme mønster som Eesy FM afvigelser. Sletningen er permanent og fjerner provision og omsætning fra rapporter.

`Rediger` er i dette trin en knap uden funktion endnu (åbner ikke dialog) — redigeringsdialogen bygges i næste trin, når vi ved hvilke felter der skal kunne rettes.

## Adgang

Kun ejer samt teamleder og assisterende teamleder på TDC Erhverv-teamet. Adgangen bindes til TDC Erhverv-teamet, så andre teamledere ikke ser siden.

## Teknisk

- Nyt hook `src/hooks/useTdcErhvervSales.ts`:
  - Henter `sales` joinet på `client_campaigns` hvor `client_id = 20744525-7466-4b2c-afa7-6ee09a9112b0`, filtreret på valgt dag (`sale_datetime`).
  - OPP-nummer udtrækkes med den eksisterende `extractOpp(raw_payload)` i `src/components/cancellations/utils/extractOpp.ts` (læser `leadResultFields["OPP nr"]` → `leadResultData` → top-level → `legacy_opp_number`). Ingen ændring i den fil.
  - Produkter og antal læses fra `sale_items` (join til `products.name`, felt `quantity`), da `sale_items` er sandheden for mapped provision/omsætning.
  - Sælgernavn resolves fra `sales.agent_email` via `employee_master_data` (work_email) med fallback til `employee_agent_mapping`/`agents.username`, jf. den etablerede identity-resolution.
  - Gruppering pr. OPP i hooket; rækker uden OPP samles som "Uden OPP".
  - Mutation `useDeleteTdcErhvervOpp` sletter alle `sales`-rækker i gruppen og invaliderer `["tdc-erhverv-sales"]`, `["sales-aggregates"]`, `["fm-sales-edit"]`.
- `src/pages/reports/TdcErhvervEditSales.tsx`: erstatter placeholder-kortet med tabel-kort, datovælger, loading/empty-states og `AlertDialog`-bekræftelse på Slet. Knapper som `Button size="sm" variant="outline"` (Rediger) og `variant="destructive"` (Slet), samme som Eesy FM.
- Adgang: opdater `role_page_permissions` for `menu_reports_tdc_edit_sales` (migration), så `teamleder` ikke får bred adgang; siden gates i UI på TDC Erhverv-teamtilknytning via eksisterende team-hooks. Ingen ændringer i `permissionKeys.ts`-nøglen ud over det, der allerede er oprettet.
- Ingen ændringer i pricing- eller lønberegning. Sletning er hard delete i `sales` — samme adfærd som eksisterende slet-knapper.

## Åbent til næste trin

Hvilke felter skal `Rediger` kunne rette (sælger, dato, produkt/antal, OPP nr.)? Afklares før dialogen bygges.
