## Problem

`enrich_fm_sale`-triggeren matcher kun booking på `location_id + dato` når den udleder `client_campaign_id`. Når to teams (Eesy FM + Yousee) er bookede på samme lokation samme dag, vælges en tilfældig af deres bookinger — også selvom sælger har valgt korrekt klient i formularen.

Konkret evidens: Noras 4 salg 4. juni har `raw_payload.fm_client_id = Eesy FM` og produkt "Eesy uden første måned (Nuuday)", men trigger satte `client_campaign_id = Yousee gaden`, fordi der lå en parallel Yousee-booking på samme lokation.

Konsekvens: forkert kampagne → forkert pricing-regel → forkert provision/revenue → forkert team-attribution på dashboards og lønperiode.

## Fix

### 1. Opdater `enrich_fm_sale`-trigger (rød zone — kræver migration-godkendelse)

Tilføj `fm_client_id` som hård filtrering i booking-opslaget:

- **Step 1 (booking-match):** `WHERE b.location_id = v_location_id AND b.client_id = v_fm_client_id AND dato matcher`. Hvis sælgers valgte klient IKKE har booking på lokationen den dag → spring direkte til step 2 (lad være med at "låne" en anden klients booking).
- **Step 2 (smart product-match):** uændret, allerede filtreret på `client_id = v_fm_client_id`.
- **Step 3 (ultimate fallback):** uændret, allerede filtreret på `client_id = v_fm_client_id`.
- Bevar warning-loggen i `integration_logs` ved booking uden campaign_id.
- Tilføj ny warning-log hvis step 1 fejler pga. manglende client-match — så vi kan opdage formular-fejl fremover.

### 2. Backfill historiske fejl-attributioner

Find alle FM-salg hvor `client_campaign_id`s klient ≠ `raw_payload.fm_client_id`, og kør den rettede logik på dem.

Før migration kører tæller jeg op hvor mange historiske rækker der rammes og rapporterer tallet. Hvis det er stort (>100), beslutter du om vi tager alle eller kun en periode.

### 3. Re-trigger pricing for de berørte salg

Når `client_campaign_id` ændres skal `sale_items` (mapped_commission, revenue) regenereres — ellers står provisionen stadig forkert. Bruger eksisterende `create_fm_sale_items` / rematch-mekanismen (afklares i kode før migration).

## Tekniske detaljer

Filer/objekter rørt:
- DB-funktion `public.enrich_fm_sale()` (rød zone — pricing/attribution)
- Engangs-UPDATE på `public.sales` for fejlattribuerede rækker
- Sletning + regenerering af `public.sale_items` for samme rækker

Ingen frontend-kode ændres. `useCreateFieldmarketingSale` sender allerede `fm_client_id` i raw_payload — den behøver intet.

## Bekræftelse efter deploy

1. Noras 4 salg fra 4. juni: `client_campaign_id` skal være Eesy gaden, Yousee-dashboardet falder 4 → 0 i dag.
2. Eesy FM-dashboardet stiger tilsvarende.
3. Spot-check `sale_items.mapped_commission` på samme rækker.

## Åbne valg du skal tage stilling til

1. **Backfill-scope:** alle historiske fejl eller kun fra en bestemt dato (fx 1. jan 2026)?
2. **Hvis sælger har valgt en klient uden booking på lokationen:** skal triggeren (a) fortsætte til product-match-fallback inden for sælgers valgte klient — min default — eller (b) afvise salget med fejl så det håndteres manuelt?
