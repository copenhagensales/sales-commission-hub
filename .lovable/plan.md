## Mål
Vis Switch/Omstilling-produkter i Rådata-fanen på Rapporter Ledelse → Relatel uden at påvirke Opsummering, dashboards eller løn.

## Ændring
Migration: drop og recreate begge overloads af `get_sales_report_raw`:
- `(p_client_id uuid, p_start text, p_end text)`
- `(p_client_id uuid, p_start text, p_end text, p_limit int, p_offset int)`

Eneste forskel fra nuværende version: linjen `AND COALESCE(p2.counts_as_sale, true) = true` fjernes fra WHERE. Alt andet (kolonner, joins, CVR, Tilskud, OPP-udtræk, sortering) er identisk.

`get_sales_report_detailed` røres ikke — Opsummering beholder filtret.

## Ikke rørt
- UI: `RawSalesTable.tsx` og `ReportsManagement.tsx` — ingen ændringer.
- Andre RPC'er, hooks, dashboards, KPI'er, leaderboards, løn.
- `sale_items`, `products`, `counts_as_sale`-værdier.

## Verifikation
Efter migration: opslag på Relatel for en periode med kendte Omstilling-salg skal returnere disse rækker med korrekt produktnavn, provision og revenue fra `sale_items`.

## Zone
Gul — kun rapport-RPC.