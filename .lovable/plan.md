## Årsag

TV-boards kører anonymt (ingen login — kun `verify_tv_board_code`). Al data på TV-skærmene hentes derfor via edge functions med service role, der bypass'er RLS (fx `tv-dashboard-data` med actions som `cs-top-20-data`, `relatel-data`, `celebration-data`).

De to nye fiber-hooks er derimod skrevet som direkte Supabase-klient-kald:

- `src/hooks/useFiberBoardStats.ts` → `supabase.from("sale_items")...`
- `src/hooks/useFiberSalesCount.ts` → `supabase.from("sale_items")...`

På TV bliver kaldene udført med anon-nøglen. RLS på `sale_items` tillader ikke anon-læsning, så begge queries returnerer 0 rækker. Derfor viser TV:

- Fiber salg / Fiber provi = 0 for alle sælgere
- `(+X fiber)`-suffix i toppen skjules (fordi `count === 0` ⇒ ingen render)

I det almindelige dashboard (hvor du er logget ind) virker det, fordi din session opfylder RLS.

## Løsning

Route fiber-forespørgslerne gennem `tv-dashboard-data` edge function når vi er i TV-mode. Samme mønster som de øvrige TV-boards allerede bruger. Ingen RLS-ændringer, ingen ny tabel, ingen ændring af beregningslogik.

### Trin

1. **`supabase/functions/tv-dashboard-data/index.ts`** — tilføj to nye actions:
   - `action=fiber-board-stats&start=<iso>&end=<iso>` → returnerer samme `FiberStatsMap` som hook'en bygger i dag (inkl. navn/avatar-lookup, agent_email → employee_id via `employee_agent_mapping`).
   - `action=fiber-sales-count&start=<iso>&end=<iso>` → returnerer `{ count: number }`.
   
   Begge bruger service-role-klienten der allerede er sat op i filen. Filtre og produkt-IDs kopieres fra `FIBER_PRODUCT_IDS` / `FIBER_SALE_PRODUCT_IDS` (hardkodes i edge function eller importeres — vi vælger hardkodning, da edge functions ikke deler `src/config/`).

2. **`src/hooks/useFiberBoardStats.ts`** — tilføj TV-mode gren:
   - Hvis `isTvMode()` (fra `@/utils/tvMode`) → kald edge function via `fetch(${VITE_SUPABASE_URL}/functions/v1/tv-dashboard-data?action=fiber-board-stats&start=...&end=...)`.
   - Ellers → nuværende direkte Supabase-kald (uændret).

3. **`src/hooks/useFiberSalesCount.ts`** — samme mønster:
   - TV-mode → edge function `action=fiber-sales-count`.
   - Ellers → nuværende paginerede kald (uændret).

### Zone

Grøn zone. Ingen ændring i beregningslogik, RLS, produktdefinitioner eller UI. Kun transport-lag.

### Verificering

Efter deploy: åbn TV-linket (`/t/<slug>` med kode) på en klient hvor der er fiber-salg i dag → værdier > 0 og `(+X fiber)` synligt.
