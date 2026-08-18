# Oliver kan ikke se salg under "TDC Erhverv - ret salg"

## Konklusion (verificeret)

Menupunktet og siden virker for Oliver — det er databasens adgangsregler (RLS) der blokerer selve salgene.

- Oliver Gonsalves Vatting Arentoft er aktiv, `job_title = 'Salgskonsulent'`, rolle `salgskonsulent_tdc_support`, ingen rækker i `user_roles`/`system_roles`.
- `sales` SELECT tillader kun: `is_manager_or_above(auth.uid())`, eget salg (`can_view_sale_as_employee`), eller FM-salg. `is_teamleder_or_above` kræver `system_roles`-række eller et af job-titlerne `ejer/teamleder/assisterende teamleder/...` — ingen af dem gælder Oliver. Derfor ser han kun sine egne salg (typisk ingen).
- Samme mønster på `sale_items` (SELECT kun manager/eget salg) og på UPDATE/DELETE for både `sales` og `sale_items`: udelukkende `is_manager_or_above`. Rettefunktionen ville derfor også fejle for ham, selv hvis han kunne se rækkerne.
- Rasmus og du kan se dem, fordi I resolver til teamleder/ejer.

Årsagen er altså, at siden læser og skriver direkte på `sales`/`sale_items` under brugerens egen RLS, mens adgangen til siden styres af rettigheden `menu_reports_tdc_edit_sales` — de to lag hænger ikke sammen i dag.

## Løsning

Bind RLS til den rettighed der allerede styrer siden, og afgræns den strengt til TDC Erhverv.

1. Ny SECURITY DEFINER-funktion `public.can_edit_tdc_erhverv_sales(_user_id uuid)`:
   - true hvis brugeren er aktiv medarbejder, og hans rolle (`employee_master_data.position_id → job_positions.system_role_key`) har `can_view` eller `can_edit` på `menu_reports_tdc_edit_sales` i `role_page_permissions`, eller hvis `is_owner()`.
   - Ingen hardkodede e-mails eller navne — adgang styres fortsat under Ledelse → Rettigheder.
2. Ny hjælpefunktion `public.sale_is_tdc_erhverv(_sale_id uuid)` (SECURITY DEFINER) der slår salget op via `client_campaigns.client_id = TDC Erhverv`.
3. Nye RLS-politikker, alle med begge betingelser (rettighed + TDC Erhverv-salg):
   - `sales`: SELECT, UPDATE, DELETE
   - `sale_items`: SELECT, INSERT, UPDATE, DELETE (via `sale_id`)
   Eksisterende politikker berøres ikke — de nye lægges oveni, så manager-adgang og medarbejderes egen-adgang er uændret.

Resultat: Oliver ser og kan rette/slette alle TDC Erhverv-salg, men intet salg fra andre klienter, og ingen andre sider åbnes.

## Teknisk note

- Ren migration, ingen frontend-ændringer. `useTdcErhvervSales` fungerer uændret.
- Funktionerne får `SET search_path = public` og `STABLE`, jf. hardening-linjen i systemet.
- Rettelser genberegnes fortsat af `rematch-pricing-rules` (service role, upåvirket af RLS).

## Zone og risiko

- Rød zone: RLS på `sales`/`sale_items`. Denne plan er godkendelsesgrundlaget.
- Ingen ændring af pricing, provision, løn eller eksisterende rettighedsrækker.
- Verifikation efter migration: kontrollér med Olivers bruger-id at (a) TDC Erhverv-salg er synlige, (b) et salg fra en anden klient ikke er synligt, (c) rettigheden slået fra i rettighedsmodulet fjerner adgangen igen.
